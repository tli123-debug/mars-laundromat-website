-- Recurring Pickup System V1, Checkpoint 1: dormant schema and generation
-- function only. Additive and backward-compatible with the currently
-- deployed app: one new table, two new nullable columns on bookings, one
-- widened CHECK (booking_source gains a third allowed value alongside the
-- two that already exist), and a SECURITY DEFINER function that nothing
-- can call yet (EXECUTE is revoked from every application-facing role
-- below, and no cron job is created — see the separate Checkpoint 3
-- activation migration). Every existing row, policy, and behavior is
-- completely unaffected by this transaction.
begin;

-- 1. recurring_schedules — the one new table. No customer table, no
-- subscription/payment table, no separate event-history table: this row
-- IS the schedule, and status + paused_at/cancelled_at together are its
-- own minimal history.
create table public.recurring_schedules (
  id                          uuid primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  status                      text not null default 'active',
  frequency                   text not null,

  customer_name               text not null,
  customer_phone              text not null,
  customer_phone_normalized   text not null,
  address                     text not null,

  pickup_time                 time not null,
  delivery_time               time not null,
  next_pickup_date            date not null,

  recurring_instructions      text,
  recurring_instructions_zh   text,

  source_booking_id           uuid not null references public.bookings(id),
  recurring_consent_at        timestamptz not null,

  created_by                  uuid not null references auth.users(id),
  updated_by                  uuid not null references auth.users(id),

  paused_at                   timestamptz,
  cancelled_at                timestamptz,
  last_generated_at           timestamptz,

  constraint recurring_schedules_status_check
    check (status in ('active', 'paused', 'cancelled')),
  constraint recurring_schedules_frequency_check
    check (frequency in ('weekly', 'every_two_weeks')),
  -- Real store window starts only — the fixed hourly 9:00 AM through
  -- 6:00-7:00 PM schedule (BOOKING_WINDOW_START_MINUTES in
  -- src/lib/booking-hours.ts). A CHECK constraint can't call application
  -- code, so this hardcodes the same ten values; if the store's hours
  -- ever change, both this constraint and that file must be updated
  -- together, the same tradeoff bookings_same_day_fee_check already
  -- accepts for SAME_DAY_FEE_CENTS.
  constraint recurring_schedules_pickup_time_check
    check (pickup_time in
      ('09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00')),
  constraint recurring_schedules_delivery_time_check
    check (delivery_time in
      ('09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00')),
  -- Status/timestamp consistency: paused_at is set if and only if status
  -- is currently 'paused' (Resume explicitly clears it back to null, per
  -- the owner-approved Resume behavior — this isn't a historical "was
  -- ever paused" marker); cancelled_at is set if and only if status is
  -- currently 'cancelled'. Cancelled is terminal in application logic (a
  -- cancelled schedule is replaced by a brand-new row, never revived), so
  -- this constraint is never exercised against a real un-cancel attempt,
  -- but it still correctly rejects one if it were ever tried by hand.
  constraint recurring_schedules_status_timestamps_check check (
    (status = 'paused') = (paused_at is not null)
    and (status = 'cancelled') = (cancelled_at is not null)
  )
);

comment on table public.recurring_schedules is
  'Staff-managed recurring Wash & Fold pickup schedules. Each occurrence is generated as its own row in bookings (see bookings.recurring_schedule_id) — this table never represents a booking itself, only the standing arrangement that produces one on a cadence.';

create index recurring_schedules_status_idx on public.recurring_schedules (status);
create index recurring_schedules_next_pickup_date_idx on public.recurring_schedules (next_pickup_date);
create index recurring_schedules_source_booking_id_idx on public.recurring_schedules (source_booking_id);

-- Prevents a duplicate active-or-paused schedule for the same customer.
-- customer_phone_normalized is already a dedicated column; address is
-- normalized inline (trimmed + case-folded) in the index expression
-- rather than adding a second denormalized column, so "123 7th Ave" and
-- " 123 7th ave " collide correctly without a separate address_normalized
-- field to keep in sync. The partial "where" clause deliberately excludes
-- 'cancelled' — the spec allows a cancelled schedule to be replaced by a
-- new one later, so only active/paused schedules compete for uniqueness.
create unique index recurring_schedules_active_customer_unique_idx
  on public.recurring_schedules (customer_phone_normalized, lower(btrim(address)))
  where status in ('active', 'paused');

create trigger recurring_schedules_set_updated_at
  before update on public.recurring_schedules
  for each row execute function public.set_updated_at();

-- 2. RLS for recurring_schedules. anon gets no policy at all for any
-- operation — RLS denies by default when no policy matches an operation,
-- so SELECT/INSERT/UPDATE/DELETE are all correctly and completely closed
-- to anon with no explicit "deny" statements needed. authenticated staff
-- get the same "any authenticated user is a trusted admin" treatment
-- already used for bookings (single small business, no per-tenant
-- ownership model): SELECT, INSERT, and UPDATE. No DELETE policy for any
-- role — cancellation is a status update (Cancel Schedule sets
-- status='cancelled'), never a row deletion. No explicit GRANT statements
-- here, matching every existing bookings migration in this project
-- (20260817000000_create_bookings_table.sql and everything after it) —
-- table-level DML privileges for anon/authenticated are already
-- established at the project level; RLS policies are the only
-- access-control layer this codebase's migrations ever add. No
-- service-role key is introduced anywhere.
alter table public.recurring_schedules enable row level security;

create policy "authenticated can read recurring schedules"
  on public.recurring_schedules for select
  to authenticated
  using (true);

create policy "authenticated can create recurring schedules"
  on public.recurring_schedules for insert
  to authenticated
  with check (true);

create policy "authenticated can update recurring schedules"
  on public.recurring_schedules for update
  to authenticated
  using (true)
  with check (true);

-- 3. bookings: link a generated occurrence back to its schedule. Both
-- columns are nullable — every existing row gets null/null automatically,
-- completely unaffected — and must move together: a booking is either an
-- ordinary booking (both null) or a recurring occurrence (both set),
-- never a half-linked in-between state.
alter table public.bookings
  add column recurring_schedule_id uuid references public.recurring_schedules(id),
  add column recurring_occurrence_date date;

alter table public.bookings
  add constraint bookings_recurring_fields_check check (
    (recurring_schedule_id is null) = (recurring_occurrence_date is null)
  );

create index bookings_recurring_schedule_id_idx on public.bookings (recurring_schedule_id)
  where recurring_schedule_id is not null;

-- One schedule can never produce two bookings for the same occurrence
-- date. This is the actual concurrency backstop generate_due_recurring_
-- bookings() relies on below (part 6): row locking prevents two
-- invocations from processing the same SCHEDULE at once, but this unique
-- index is what makes a second concurrent attempt at the same OCCURRENCE
-- fail safely (caught as an idempotent no-op) rather than silently
-- double-booking.
create unique index bookings_recurring_schedule_occurrence_unique_idx
  on public.bookings (recurring_schedule_id, recurring_occurrence_date)
  where recurring_schedule_id is not null;

-- 4. booking_source widens to include the new 'recurring' origin.
-- Existing 'website' and 'phone' values and every row holding them are
-- completely unaffected — this only adds a third allowed value.
alter table public.bookings drop constraint bookings_booking_source_check;
alter table public.bookings add constraint bookings_booking_source_check
  check (booking_source in ('website', 'phone', 'recurring'));

-- 5. RLS: the hardened anon INSERT policy keeps every existing clause
-- unchanged and adds the two new columns to the exhaustive must-be-null
-- list, alongside every other staff/system-only column. An anonymous
-- public request can still only ever create a brand-new, completely
-- untouched pending website booking — it was already structurally
-- impossible for it to claim booking_source = 'recurring' (that value
-- isn't 'website', and the existing "booking_source = 'website'" clause
-- already rejects it), but the explicit recurring_schedule_id/
-- recurring_occurrence_date null checks are added anyway for the same
-- reason every other staff-only column gets one: defense that doesn't
-- depend on reasoning about a different clause elsewhere in the policy.
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
    and recurring_schedule_id is null
    and recurring_occurrence_date is null
  );

-- 6. Dormant generation function. SECURITY DEFINER so it can act
-- regardless of who/what invokes it, with search_path pinned to exactly
-- pg_catalog, public so a hijacked search_path can't redirect an
-- unqualified identifier to a malicious object — belt-and-suspenders on
-- top of every reference already being fully schema-qualified below.
-- EXECUTE is revoked from every application-facing role in the block
-- immediately after creation: this function is for the database cron
-- owner only, is not callable through the public application today, and
-- remains not callable through the public application after Checkpoint 3
-- activates cron (that migration grants EXECUTE only to the mechanism
-- Supabase Cron itself runs as, never to anon or authenticated).
create or replace function public.generate_due_recurring_bookings(
  p_as_of_date date default (now() at time zone 'America/New_York')::date
)
returns table (
  schedule_id uuid,
  action text,
  booking_id uuid,
  next_pickup_date date
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_schedule public.recurring_schedules%rowtype;
  v_target_date date;
  v_cadence_days int;
  v_new_booking_id uuid;
  v_action text;
begin
  for v_schedule in
    select *
    from public.recurring_schedules
    where status = 'active'
    order by id
    for update skip locked
  loop
    v_cadence_days := case v_schedule.frequency when 'weekly' then 7 else 14 end;
    v_target_date := v_schedule.next_pickup_date;

    -- Advance a stale date forward along the schedule's own cadence until
    -- it reaches the first occurrence that is today or later. This loop
    -- only ever moves the date pointer — it never generates a booking for
    -- a date it steps past, so a schedule that was paused (or a cron run
    -- that was missed) for a while can never backfill missed history.
    while v_target_date < p_as_of_date loop
      v_target_date := v_target_date + v_cadence_days;
    end loop;

    v_new_booking_id := null;
    v_action := 'not_yet_due';

    -- Generate only when the (now-current) next occurrence is within the
    -- 2-day lead window. A schedule whose date is still further out keeps
    -- its advanced-but-not-yet-due date and is revisited on a later day's
    -- invocation — never generated early.
    if v_target_date <= p_as_of_date + 2 then
      -- ON CONFLICT targeted specifically at
      -- bookings_recurring_schedule_occurrence_unique_idx (the exact
      -- column list + partial predicate below is what makes Postgres
      -- infer that one specific index, not any other unique constraint
      -- this table might ever gain) — deliberately not a broad
      -- `exception when unique_violation`, which would have silently
      -- treated ANY unique-constraint failure on this table as "already
      -- generated" and advanced the schedule anyway, masking a real
      -- problem instead of surfacing it. Any other error on this insert
      -- (a genuinely unrelated constraint violation, for instance) is not
      -- caught here at all and propagates normally, aborting this
      -- schedule's iteration loudly rather than silently skipping a
      -- customer's booking.
      insert into public.bookings (
        name, phone, address,
        preferred_pickup_date, preferred_pickup_time,
        preferred_delivery_date, preferred_delivery_time,
        status, booking_source, service_type, service_speed,
        contact_preference,
        paid, quote_status,
        sms_consent, sms_consent_at,
        special_instructions, special_instructions_zh,
        recurring_schedule_id, recurring_occurrence_date,
        created_by, updated_by
      )
      values (
        v_schedule.customer_name, v_schedule.customer_phone, v_schedule.address,
        v_target_date, v_schedule.pickup_time,
        v_target_date + 1, v_schedule.delivery_time,
        'pending', 'recurring', 'wash_and_fold', 'standard',
        -- This recurring workflow is established and managed entirely
        -- through assisted text messages, unlike a phone-in booking
        -- (which defaults to 'call') — so this is explicit, not left to
        -- the column default.
        'text',
        false, 'not_started',
        true, v_schedule.recurring_consent_at,
        v_schedule.recurring_instructions, v_schedule.recurring_instructions_zh,
        v_schedule.id, v_target_date,
        v_schedule.created_by, v_schedule.created_by
      )
      on conflict (recurring_schedule_id, recurring_occurrence_date)
        where recurring_schedule_id is not null
        do nothing
      returning id into v_new_booking_id;

      if v_new_booking_id is not null then
        v_action := 'generated';
      else
        -- The only way this insert can return zero rows is the ON
        -- CONFLICT DO NOTHING above actually firing: every column here is
        -- provided and satisfies its own NOT NULL/CHECK constraints
        -- regardless of any other row's data, so no other failure mode
        -- silently yields zero rows this way. That means this occurrence
        -- already exists — a concurrent invocation, or a re-run after a
        -- prior partial failure, already generated it. Treat this as an
        -- idempotently-already-done outcome, not an error — surface which
        -- booking it is and still advance the schedule below, exactly as
        -- if this call had generated it.
        select b.id into v_new_booking_id
        from public.bookings b
        where b.recurring_schedule_id = v_schedule.id
          and b.recurring_occurrence_date = v_target_date;

        v_action := 'already_generated';
      end if;

      -- Advance past the occurrence just generated (or confirmed
      -- already-generated) so the next invocation looks at the following
      -- one. At most one new occurrence is ever inserted per schedule per
      -- call, by construction — this advance only runs once, here.
      v_target_date := v_target_date + v_cadence_days;
    end if;

    -- updated_at is deliberately not set here — recurring_schedules_set_
    -- updated_at (the trigger created above) already overwrites it to
    -- now() on every update, the same way every other table in this
    -- project relies on set_updated_at() rather than application code
    -- setting it explicitly.
    update public.recurring_schedules
      set next_pickup_date = v_target_date,
          last_generated_at = case when v_action in ('generated', 'already_generated')
                                    then now() else last_generated_at end
      where id = v_schedule.id;

    schedule_id := v_schedule.id;
    action := v_action;
    booking_id := v_new_booking_id;
    next_pickup_date := v_target_date;
    return next;
  end loop;

  return;
end;
$$;

revoke all on function public.generate_due_recurring_bookings(date) from public;
revoke all on function public.generate_due_recurring_bookings(date) from anon;
revoke all on function public.generate_due_recurring_bookings(date) from authenticated;

commit;
