-- Milestone 1 of the pickup/delivery operating system expansion. Purely additive:
-- every new column is nullable-or-defaulted, the one changed constraint (status)
-- only widens the set of previously-valid values, and nothing existing is renamed
-- or dropped. This is deliberate — the migration runs before any new application
-- code is deployed, so the currently-live code and RLS policies must keep working
-- completely unaffected, both before and after this runs.
begin;

-- 1. Expand `status` in place rather than adding a parallel `fulfillment_status`
-- column — one source of truth. Every existing value stays valid, so the anon
-- RLS policy (`with check (status = 'pending')`) and all current code are
-- unaffected; no backfill needed. "Awaiting customer" and "at store" are
-- deliberately not separate statuses — quote/message state (quote_status,
-- quote_sent_at) communicates the former, and reaching picked_up + having
-- actual_weight_lb set communicates the latter.
alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'picked_up', 'ready_for_delivery',
                     'out_for_delivery', 'completed', 'cancelled'));

-- 2. Confirmed pickup/delivery date + time. `preferred_*` is untouched and keeps
-- meaning "what the customer asked for"; these new columns are "what staff
-- committed to," null until confirmed. Each is a one-hour window's start time;
-- the end is derived (+1 hour) in application code, not stored.
--
-- No CHECK constraint here on purpose. The existing preferred_*_time constraint
-- permissively allows up to 8:00 PM, already looser than the real close time
-- (7:00 PM) — that shouldn't be propagated forward. The real rule (weekday
-- opens 8:00 vs weekend 8:30, every day closes 7:00, so the last valid window
-- start is 6:00 PM) depends on day-of-week and can't be expressed correctly in
-- a portable CHECK, and a DB constraint would apply even to a legitimate staff
-- override. That validation belongs in Zod (Milestone 3), scoped per form.
alter table public.bookings
  add column confirmed_pickup_date date,
  add column confirmed_pickup_time time,
  add column confirmed_delivery_date date,
  add column confirmed_delivery_time time;

-- 3. Booking source, contact preference, service speed.
alter table public.bookings
  add column booking_source text not null default 'website',
  add column contact_preference text not null default 'call',
  add column sms_consent boolean not null default false,
  add column sms_consent_at timestamptz,
  add column service_speed text not null default 'standard';

alter table public.bookings
  add constraint bookings_booking_source_check check (booking_source in ('website', 'phone')),
  add constraint bookings_contact_preference_check check (contact_preference in ('text', 'call')),
  add constraint bookings_service_speed_check check (service_speed in ('standard', 'flexible', 'same_day'));

-- 4. Weighing and quote, directly on bookings — no line-item table yet, just a
-- free-text notes field for surcharge description. actual_weight_lb is numeric
-- (real fractional pounds); billable_weight_lb is a plain integer (the formula
-- always rounds to a whole pound) — both come back from PostgREST as JSON
-- numbers, not strings, since neither is bigint or unbounded numeric.
alter table public.bookings
  add column actual_weight_lb numeric(6,2),
  add column billable_weight_lb integer,
  add column laundry_charge_cents integer,
  add column same_day_fee_cents integer,
  add column surcharge_total_cents integer not null default 0,
  add column surcharge_notes text,
  add column quote_status text not null default 'not_started',
  add column quote_sent_at timestamptz;

-- Added after the three columns it depends on exist, in a separate statement.
-- Always mathematically consistent with its inputs — no code path can forget
-- to recompute it after a charge or fee changes. Reads $0 (not NULL) before
-- weighing; quote_status = 'not_started' is the real "hasn't been quoted" signal.
alter table public.bookings
  add column quote_total_cents integer generated always as (
    coalesce(laundry_charge_cents, 0) + coalesce(same_day_fee_cents, 0) + surcharge_total_cents
  ) stored;

alter table public.bookings
  add constraint bookings_quote_status_check check (quote_status in ('not_started', 'draft', 'sent')),
  add constraint bookings_actual_weight_check check (actual_weight_lb is null or actual_weight_lb >= 0),
  add constraint bookings_billable_weight_check check (billable_weight_lb is null or billable_weight_lb >= 10),
  add constraint bookings_laundry_charge_check check (laundry_charge_cents is null or laundry_charge_cents >= 0),
  add constraint bookings_same_day_fee_check check (same_day_fee_cents is null or same_day_fee_cents >= 0),
  add constraint bookings_surcharge_total_check check (surcharge_total_cents >= 0);
-- quote_total_cents needs no constraint of its own: it's generated from three
-- inputs that are all already constrained non-negative, so it can never go
-- negative either.

-- 5. Payment — keep the existing `paid` boolean as the single source of truth
-- for paid/unpaid (the existing PaidCheckbox keeps working exactly as today);
-- add detail fields alongside it rather than a separate payment_status column.
-- A quote that's been sent but not yet paid is just quote_status = 'sent' and
-- paid = false together — no separate "payment requested" state needed.
alter table public.bookings
  add column payment_method text,
  add column paid_at timestamptz,
  add column payment_verified_by uuid references auth.users(id);

alter table public.bookings
  add constraint bookings_payment_method_check check (payment_method is null or payment_method in ('cash', 'zelle'));

-- 6. Attribution. Nullable: null created_by = anon website submission (expected,
-- not an error state); null updated_by = never touched by staff since creation.
-- No staff/booking_events tables yet — separate Supabase Auth logins already
-- give real attribution via auth.users; a friendly-name lookup table and an
-- audit-event log can be added later when their UI actually exists.
alter table public.bookings
  add column created_by uuid references auth.users(id),
  add column updated_by uuid references auth.users(id);

-- 7. RLS: add the missing authenticated INSERT policy (phone bookings), and
-- tighten the anon INSERT policy. The original policy only constrained
-- `status = 'pending'` — RLS WITH CHECK doesn't restrict which OTHER columns
-- an insert can set, so a hand-crafted anon REST call could already set
-- status='pending' while also smuggling in paid=true, a pre-filled quote, a
-- confirmed time, etc. The tightened policy locks every staff-only field to
-- its safe default, so anon can only ever create a brand-new, untouched
-- pending request — never anything that looks already-processed.
-- service_speed/contact_preference/sms_consent/sms_consent_at stay publicly
-- settable, governed only by their own column-level CHECK constraints
-- (point 3), per product requirements. The existing authenticated
-- SELECT/UPDATE policies are untouched. No service-role key is introduced
-- anywhere.
create policy "authenticated can create bookings"
  on public.bookings for insert to authenticated with check (true);

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
  );

commit;
