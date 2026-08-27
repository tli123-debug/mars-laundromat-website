-- Dry Cleaning & Ironing expansion. Backward-compatible with the currently
-- deployed app: every new column is nullable or defaulted, service_speed's
-- CHECK only widens the previously valid set, and no existing row's data or
-- behavior changes. Not purely additive at the schema level, though — it
-- intentionally drops and recreates two existing objects that can't be
-- altered in place: bookings_same_day_fee_check (replaced under the same
-- name with a stronger rule, §3) and the quote_total_cents generated
-- column (recreated with one more summed term, §4). The whole file runs in
-- one transaction, so if anything after a drop fails, that drop rolls back
-- with everything else and the original object is restored automatically.
begin;

-- 1. Service type. Every booking that exists today is Wash & Fold, which is
-- exactly what the DEFAULT backfills every existing row to automatically —
-- no separate UPDATE needed.
alter table public.bookings
  add column service_type text not null default 'wash_and_fold';

alter table public.bookings
  add constraint bookings_service_type_check
    check (service_type in ('wash_and_fold', 'dry_cleaning', 'both'));

-- 2. Dry-cleaning item description (customer-provided), its best-effort
-- Chinese translation, staff-entered subtotal/notes, and the effective
-- charge after the $30-minimum-or-waived rule is applied.
--
-- dry_cleaning_effective_charge_cents is a plain, app-written column — like
-- laundry_charge_cents already is — not itself a generated column, because
-- quote_total_cents (below) is a generated column and PostgreSQL does not
-- allow a generated column's expression to reference another generated
-- column.
alter table public.bookings
  add column dry_cleaning_item_description text,
  add column dry_cleaning_item_description_zh text,
  add column dry_cleaning_item_subtotal_cents integer,
  add column dry_cleaning_effective_charge_cents integer,
  add column dry_cleaning_notes text;

-- Every approved garment price is positive (the cheapest listed item is
-- $3) — a real dry-cleaning order can never legitimately subtotal to
-- exactly $0. $0 can only mean "nothing entered," so it's excluded here,
-- not treated as a real order that happens to hit the $30 minimum.
--
-- The two amount columns must also move together in lockstep with
-- service_type, not just be individually non-negative: for wash_and_fold,
-- BOTH must be null, always; for dry_cleaning/both, EITHER both are still
-- null (not yet quoted) OR the subtotal is positive AND the effective
-- charge is exactly its correct derivation from that subtotal. This is what
-- actually prevents drift — a row can no longer have a real subtotal with a
-- null/stale effective charge (which would make quote_total_cents silently
-- omit the dry-cleaning portion), and a wash_and_fold row can no longer
-- carry stray dry-cleaning amounts left over from a service-type
-- correction (see the changeServiceType admin action).
alter table public.bookings
  add constraint bookings_dry_cleaning_amounts_check check (
    case service_type
      when 'wash_and_fold' then
        dry_cleaning_item_subtotal_cents is null
        and dry_cleaning_effective_charge_cents is null
      when 'dry_cleaning' then
        (dry_cleaning_item_subtotal_cents is null and dry_cleaning_effective_charge_cents is null)
        or (
          dry_cleaning_item_subtotal_cents > 0
          and dry_cleaning_effective_charge_cents = greatest(dry_cleaning_item_subtotal_cents, 3000)
        )
      when 'both' then
        (dry_cleaning_item_subtotal_cents is null and dry_cleaning_effective_charge_cents is null)
        or (
          dry_cleaning_item_subtotal_cents > 0
          and dry_cleaning_effective_charge_cents = dry_cleaning_item_subtotal_cents
        )
      else true
    end
  );
-- $30 (3000 cents) is the owner-approved dry-cleaning-only minimum — if
-- that figure ever changes, this CHECK and
-- calculateDryCleaningEffectiveCharge() in
-- src/lib/pricing/dry-cleaning-charge.ts both need updating together.

-- 3. Dry-cleaning and combined orders have a fixed 3-4 calendar-day
-- turnaround, not a customer-chosen speed tier — reusing 'flexible' would
-- misrepresent that as a 24-48-hour choice. service_speed is widened with a
-- fourth value ('dry_cleaning_timeline', deliberately distinct from
-- service_type's own 'dry_cleaning' value in the other column) that every
-- dry_cleaning/both booking must be normalized to server-side.
-- wash_and_fold bookings are untouched, still choosing among the original
-- three.
alter table public.bookings drop constraint bookings_service_speed_check;
alter table public.bookings add constraint bookings_service_speed_check
  check (service_speed in ('standard', 'flexible', 'same_day', 'dry_cleaning_timeline'));

-- Structural guarantee, not just app-layer discipline: a dry_cleaning/both
-- booking can never carry a wash-and-fold speed value, and in particular
-- can never carry 'same_day'.
alter table public.bookings
  add constraint bookings_service_type_speed_consistency_check check (
    (service_type = 'wash_and_fold' and service_speed in ('standard', 'flexible', 'same_day'))
    or (service_type in ('dry_cleaning', 'both') and service_speed = 'dry_cleaning_timeline')
  );

-- bookings_same_day_fee_check already exists (added in
-- 20260822000000_pickup_delivery_v1.sql as: same_day_fee_cents is null or
-- same_day_fee_cents >= 0) — it must be dropped before it can be recreated
-- under the same name; PostgreSQL rejects adding a constraint whose name is
-- already taken. The new rule: a nonzero same_day_fee_cents is only ever
-- allowed when EVERY one of the following holds: the booking is actually
-- wash_and_fold, its service_speed actually is 'same_day' (not just
-- permitted to be, per the constraint above, but actually is), and the
-- amount is exactly the one owner-approved fee. Null and zero both remain
-- allowed on any booking (not yet quoted, or staff declined/waived the
-- request) — this only closes off every OTHER nonzero value on a booking
-- that isn't a real, actual same-day wash-and-fold order.
alter table public.bookings drop constraint bookings_same_day_fee_check;
alter table public.bookings
  add constraint bookings_same_day_fee_check check (
    same_day_fee_cents is null
    or same_day_fee_cents = 0
    or (service_type = 'wash_and_fold' and service_speed = 'same_day' and same_day_fee_cents = 1000)
  );
-- 1000 cents ($10) is the owner-approved Same-Day Rush fee — keep in sync
-- with SAME_DAY_FEE_CENTS in src/lib/pricing/calculate-quote.ts.

-- 4. quote_total_cents must now also include the effective dry-cleaning
-- charge. PostgreSQL has no ALTER COLUMN...SET EXPRESSION for generated
-- columns — the only way to change the formula is to drop and re-add it.
-- STORED means it recomputes immediately for every existing row from that
-- row's own columns: service_type defaults to 'wash_and_fold' and
-- dry_cleaning_effective_charge_cents is null (new column, no default) on
-- every pre-existing row, so coalesce(...,0) contributes nothing and every
-- existing total is completely unchanged by this migration.
alter table public.bookings drop column quote_total_cents;
alter table public.bookings
  add column quote_total_cents integer generated always as (
    coalesce(laundry_charge_cents, 0)
    + coalesce(dry_cleaning_effective_charge_cents, 0)
    + coalesce(same_day_fee_cents, 0)
    + surcharge_total_cents
  ) stored;

-- 5. RLS: extend the hardened anon INSERT policy. service_type and the
-- customer-provided description/translation join the already-freely-
-- settable customer fields (governed only by their own CHECK constraints,
-- same treatment service_speed/contact_preference/sms_consent already get);
-- the three staff-only dry-cleaning fields join the exhaustive must-be-null
-- list alongside every other staff-controlled column. Every existing
-- authenticated policy, the public SELECT restriction, and the no-DELETE
-- posture are all untouched.
--
-- Note for whoever writes the actual INSERT: service_speed still defaults
-- to 'standard', so any insert that sets service_type to 'dry_cleaning' or
-- 'both' MUST also explicitly set service_speed = 'dry_cleaning_timeline'
-- (see resolveServiceSpeed() in src/lib/service-type.ts) or
-- bookings_service_type_speed_consistency_check above rejects the whole
-- row.
alter policy "anon can create pending bookings" on public.bookings
  with check (
    status = 'pending'
    and paid = false
    and booking_source = 'website'
    and admin_notes is null
    and confirmed_pickup_date is null
    and confirmed_pickup_time is null
    and confirmed_delivery_date is null
    and confirmed_delivery_time is null
    and actual_weight_lb is null
    and billable_weight_lb is null
    and laundry_charge_cents is null
    and same_day_fee_cents is null
    and surcharge_total_cents = 0
    and surcharge_notes is null
    and quote_status = 'not_started'
    and quote_sent_at is null
    and payment_method is null
    and paid_at is null
    and payment_verified_by is null
    and created_by is null
    and updated_by is null
    and dry_cleaning_item_subtotal_cents is null
    and dry_cleaning_effective_charge_cents is null
    and dry_cleaning_notes is null
  );

commit;
