-- Apple/iCloud calendar integration — durable launch gate + outbox schema.
-- This is schema and pure database logic ONLY. Nothing here talks to
-- CalDAV; that happens in the Node worker (src/lib/calendar-sync/), which
-- reads and writes exactly the two tables this migration creates.
--
-- Design summary (see the full runbook for the complete picture):
--   - calendar_sync_config: a singleton row. enabled/launched_at/
--     active_calendar_identity/worker_user_id. Set once, deliberately, by
--     enable_calendar_sync() below — never touched by this migration.
--   - bookings.calendar_sync_eligible: set ONCE, at INSERT time, by a
--     BEFORE INSERT trigger — durable, never recalculated later, so a
--     pre-launch booking can never become eligible via a later edit and a
--     post-launch website booking can never lose eligibility either.
--   - bookings.calendar_sync_excluded: a plain, staff-settable escape
--     hatch (no dedicated admin UI in this pass — see the runbook) for
--     manually opting a specific otherwise-eligible booking out.
--   - calendar_sync_state: the outbox. One row per (booking_id, leg),
--     leg in ('pickup','delivery'). Maintained by an AFTER INSERT OR
--     UPDATE trigger on bookings and an AFTER DELETE trigger, so calendar
--     work is marked pending atomically with the booking write itself —
--     no application code has to remember to call anything.
--
-- This migration is safe to apply at any time, including in production,
-- BEFORE any CalDAV credentials exist and BEFORE calendar sync is launched:
-- calendar_sync_config.launched_at defaults to null, so
-- bookings.calendar_sync_eligible is false for every booking (existing and
-- new) until enable_calendar_sync() is deliberately called — which this
-- migration does NOT do. Applying this migration produces zero outbox
-- rows and zero calendar-sync eligible bookings by itself.
begin;

-- ============================================================================
-- 1. calendar_sync_config — singleton row (the `id boolean primary key
--    default true` + check(id) trick forces exactly one row, always with
--    id = true).
-- ============================================================================
create table public.calendar_sync_config (
  id boolean primary key default true,
  constraint calendar_sync_config_singleton check (id),
  enabled boolean not null default false,
  launched_at timestamptz,
  -- The currently-configured target calendar's identity (its CalDAV
  -- collection URL). Read by the outbox trigger when computing each
  -- leg's desired_calendar_identity, and propagated to every existing
  -- non-absent outbox row by the trigger below whenever it changes — that
  -- propagation is what makes switching from a test calendar to the
  -- production calendar safely re-enqueue everything already active,
  -- without needing the booking's own desired_version to change.
  active_calendar_identity text,
  -- The dedicated Supabase Auth worker identity's immutable user id.
  -- Null until the owner creates that login (Supabase dashboard) and sets
  -- this — see the runbook. RLS below keys off this, not an email string.
  worker_user_id uuid,
  updated_at timestamptz not null default now()
);

insert into public.calendar_sync_config (id) values (true);

alter table public.calendar_sync_config enable row level security;
revoke all on public.calendar_sync_config from public, anon, authenticated;
-- Deliberately no anon/authenticated policy at all yet — the worker-scoped
-- policies are added in section 5, once worker_user_id has a column to
-- reference. Admins never need direct access to this table through the
-- app; it's configured via SQL during setup (see the runbook).

-- ============================================================================
-- 2. Durable eligibility + manual-exclusion columns on bookings.
-- ============================================================================
alter table public.bookings
  add column calendar_sync_eligible boolean not null default false,
  add column calendar_sync_excluded boolean not null default false;

-- Set ONCE, at insert time, from launched_at AT THAT MOMENT — never
-- recalculated on any later update to this booking or to
-- the config. This is what makes "pre-launch bookings stay excluded even
-- after a later edit" and "post-launch website bookings stay eligible
-- even while processing is temporarily paused" both true by construction.
--
-- booking_source = 'website' alone already excludes phone AND generated
-- recurring bookings — BookingSource is exactly 'website' | 'phone' |
-- 'recurring' (src/types/database.types.ts), and only submit_booking()
-- (20260917000000_booking_submission_idempotency.sql) and
-- generate_due_recurring_bookings() (20260830000000_recurring_pickups_v1.sql)
-- ever write a booking row from outside a real admin session — the former
-- always writes 'website', the latter always writes 'recurring'. A phone
-- booking entered by staff through the admin "authenticated can create
-- bookings" policy is staff's own choice of booking_source, and this
-- codebase's admin UI has no path that would ever set it to anything but
-- 'phone' for that case.
create or replace function public.set_calendar_sync_eligibility()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_launched_at timestamptz;
begin
  select launched_at into v_launched_at
  from public.calendar_sync_config where id = true;

  new.calendar_sync_eligible := (
    new.booking_source = 'website'
    and v_launched_at is not null
    and new.created_at >= v_launched_at
  );
  return new;
end;
$$;

create trigger bookings_set_calendar_sync_eligibility
  before insert on public.bookings
  for each row execute function public.set_calendar_sync_eligibility();

revoke all on function public.set_calendar_sync_eligibility() from public;

-- ============================================================================
-- 3. calendar_sync_state — the outbox. One row per (booking_id, leg).
--
-- Deliberately NO foreign key to bookings(id): this table must survive a
-- hard delete of the booking row (deleteBooking() in
-- src/app/admin/(dashboard)/bookings/[id]/actions.ts) long enough for the
-- worker to actually remove the corresponding CalDAV resource — an
-- on-delete-cascade FK would erase that signal in the same transaction as
-- the delete, before any worker ever saw it. Every field the worker needs
-- to build the event and talk to CalDAV is denormalized directly onto this
-- row at trigger time, specifically so the worker never needs to read
-- bookings at all (see section 5's RLS — the worker gets no grant on
-- bookings whatsoever, only on this table and calendar_sync_config).
-- ============================================================================
create table public.calendar_sync_state (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  leg text not null check (leg in ('pickup', 'delivery')),

  desired_version bigint not null default 1,
  synced_version bigint,

  desired_calendar_identity text,
  synced_calendar_identity text,

  -- absent: no event should exist. active: a real, not-yet-happened
  -- appointment with its reminder. historical: already happened —
  -- preserve the event, but it's not "outstanding work."
  desired_disposition text not null check (desired_disposition in ('absent', 'active', 'historical')),

  -- Durable "this leg genuinely happened" fact. Set permanently true the
  -- first time this leg's fulfillment threshold is crossed, and read (not
  -- re-derived from a transient OLD/NEW status diff) on every later
  -- trigger firing — including any edit made after the booking was
  -- cancelled. Without this, a later unrelated edit to an already-
  -- cancelled-after-pickup booking would see the trigger's OLD.status as
  -- 'cancelled' (not the real pre-cancellation history) and could
  -- incorrectly flip a preserved historical pickup back to absent.
  fulfilled boolean not null default false,

  desired_start timestamptz,
  desired_end timestamptz,
  desired_summary text,
  desired_location text,
  desired_phone text,
  desired_service_type text,
  desired_instructions text,

  ical_uid text not null,
  caldav_href text,
  remote_etag text,

  attempt_count int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempted_at timestamptz,
  last_success_at timestamptz,
  -- Sanitized only — the worker must never write a raw exception message,
  -- an Authorization header, or an app-specific password here. See
  -- src/lib/calendar-sync/sanitize-error.ts.
  last_error text,

  -- Lease for safe concurrent claiming — see claim_calendar_sync_batch().
  claimed_at timestamptz,
  claimed_by text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (booking_id, leg)
);

-- The exact predicate reconciliation runs on: due when the desired state
-- has moved past what's synced OR the target calendar has changed —
-- explicitly an OR, never an AND (requiring both would mean a row already
-- fully synced under a test calendar never gets picked up again after
-- switching to the production calendar, since only the calendar changed).
create index calendar_sync_state_due_idx on public.calendar_sync_state (next_attempt_at)
  where desired_version is distinct from synced_version
     or desired_calendar_identity is distinct from synced_calendar_identity;

alter table public.calendar_sync_state enable row level security;
revoke all on public.calendar_sync_state from public, anon, authenticated;

-- ============================================================================
-- 4. Outbox maintenance triggers on bookings.
-- ============================================================================

-- Single-leg upsert, called twice (pickup, delivery) by the trigger below.
-- A plain UPDATE followed by INSERT-if-not-found, not ON CONFLICT DO
-- UPDATE: this table's own AFTER trigger can only ever run once at a time
-- for a given booking_id (Postgres's row-level lock on the bookings row
-- being written serializes any two writes to the SAME booking), so the
-- classic race ON CONFLICT guards against — two concurrent first-time
-- inserts for the same key — cannot actually happen here, and the
-- simpler two-step form is easier to verify by inspection.
create or replace function public.upsert_calendar_sync_leg(
  p_booking_id uuid, p_leg text, p_calendar_identity text, p_disposition text, p_fulfilled boolean,
  p_start timestamptz, p_end timestamptz, p_summary text, p_location text,
  p_phone text, p_service_type text, p_instructions text, p_ical_uid text
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing public.calendar_sync_state%rowtype;
  v_changed boolean;
begin
  select * into v_existing
    from public.calendar_sync_state
   where booking_id = p_booking_id and leg = p_leg
   for update;

  if not found then
    insert into public.calendar_sync_state (
      booking_id, leg, desired_version, desired_calendar_identity, desired_disposition, fulfilled,
      desired_start, desired_end, desired_summary, desired_location, desired_phone,
      desired_service_type, desired_instructions, ical_uid
    ) values (
      p_booking_id, p_leg, 1, p_calendar_identity, p_disposition, p_fulfilled,
      p_start, p_end, p_summary, p_location, p_phone, p_service_type, p_instructions, p_ical_uid
    );
    return;
  end if;

  v_changed := v_existing.desired_disposition is distinct from p_disposition
    or v_existing.desired_calendar_identity is distinct from p_calendar_identity
    or v_existing.desired_start is distinct from p_start
    or v_existing.desired_end is distinct from p_end
    or v_existing.desired_summary is distinct from p_summary
    or v_existing.desired_location is distinct from p_location
    or v_existing.desired_phone is distinct from p_phone
    or v_existing.desired_service_type is distinct from p_service_type
    or v_existing.desired_instructions is distinct from p_instructions;

  update public.calendar_sync_state
     set desired_version = desired_version + case when v_changed then 1 else 0 end,
         desired_calendar_identity = p_calendar_identity,
         desired_disposition = p_disposition,
         fulfilled = p_fulfilled,
         desired_start = p_start,
         desired_end = p_end,
         desired_summary = p_summary,
         desired_location = p_location,
         desired_phone = p_phone,
         desired_service_type = p_service_type,
         desired_instructions = p_instructions,
         -- A new business decision supersedes any old retry backoff or
         -- in-flight lease. Invalidating claimed_by prevents the stale
         -- worker from acknowledging over this newer state, while the
         -- immediate next_attempt lets a cancellation/reschedule repair
         -- Apple without waiting up to the old 30-minute backoff.
         next_attempt_at = case when v_changed then now() else next_attempt_at end,
         attempt_count = case when v_changed then 0 else attempt_count end,
         claimed_at = case when v_changed then null else claimed_at end,
         claimed_by = case when v_changed then null else claimed_by end,
         updated_at = now()
   where id = v_existing.id;
end;
$$;

revoke all on function public.upsert_calendar_sync_leg(
  uuid, text, text, text, boolean, timestamptz, timestamptz, text, text, text, text, text, text
) from public;

-- The main trigger. Fires on every insert/update of a bookings row and
-- recomputes both legs' desired state from scratch each time — cheap
-- (two small upserts against a unique-indexed table) and correct by
-- construction, since it never trusts what it computed last time except
-- for the one durable `fulfilled` fact read back from the existing row.
create or replace function public.sync_calendar_outbox_for_booking()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_calendar_identity text;
  v_calendar_worthy boolean;
  v_pickup_fulfilled boolean;
  v_delivery_fulfilled boolean;
  v_pickup_disposition text;
  v_delivery_disposition text;
  v_pickup_start timestamptz;
  v_pickup_end timestamptz;
  v_delivery_start timestamptz;
  v_delivery_end timestamptz;
begin
  select active_calendar_identity into v_calendar_identity
    from public.calendar_sync_config where id = true;

  -- enabled is an operational pause for the worker, not a request to erase
  -- events. Durable eligibility plus the per-booking exclusion flag alone
  -- determine desired calendar state. While paused, triggers keep that
  -- desired state current and the claim RPC returns no work; resuming then
  -- reconciles every accumulated change without deleting/recreating events.
  v_calendar_worthy := new.calendar_sync_eligible
    and not new.calendar_sync_excluded;

  if not v_calendar_worthy then
    -- Never eligible (the overwhelmingly common case: nothing to do, no
    -- rows exist yet) or newly excluded after rows already existed
    -- (rare: retract anything not already absent).
    update public.calendar_sync_state
       set desired_disposition = 'absent',
           desired_version = desired_version + 1,
           next_attempt_at = now(),
           attempt_count = 0,
           claimed_at = null,
           claimed_by = null,
           updated_at = now()
     where booking_id = new.id and desired_disposition <> 'absent';
    return new;
  end if;

  select fulfilled into v_pickup_fulfilled
    from public.calendar_sync_state where booking_id = new.id and leg = 'pickup';
  v_pickup_fulfilled := coalesce(v_pickup_fulfilled, false);
  select fulfilled into v_delivery_fulfilled
    from public.calendar_sync_state where booking_id = new.id and leg = 'delivery';
  v_delivery_fulfilled := coalesce(v_delivery_fulfilled, false);

  -- picked_up/ready_for_delivery/completed are exactly
  -- STATUSES_REQUIRING_CONFIRMED_SCHEDULE (src/lib/time-proposal-
  -- validation.ts) minus 'confirmed' itself — the three statuses that can
  -- only be reached once pickup has actually happened. 'completed' is the
  -- only one where delivery has also actually happened.
  if new.status in ('picked_up', 'ready_for_delivery', 'completed') then
    v_pickup_fulfilled := true;
  end if;
  if new.status = 'completed' then
    v_delivery_fulfilled := true;
  end if;

  if new.status = 'cancelled' then
    -- A leg that already happened stays historical even after
    -- cancellation; a leg that hadn't happened yet is removed. This is
    -- decided from the durable `fulfilled` fact above, never from
    -- old.status — old.status only reflects the immediately preceding
    -- write, and a LATER unrelated edit to this same now-cancelled
    -- booking (e.g. a staff note correction) would see old.status as
    -- 'cancelled' too, which carries no information about whether pickup
    -- happened before the cancellation.
    v_pickup_disposition := case when v_pickup_fulfilled then 'historical' else 'absent' end;
    v_delivery_disposition := case when v_delivery_fulfilled then 'historical' else 'absent' end;
  elsif new.status = 'pending' then
    -- Not yet confirmed (or reverted to pending by saveProposedTime/
    -- clearProposedTime after having been confirmed once) — confirmed_*
    -- may still hold a proposal awaiting the customer's agreement, which
    -- is exactly why this checks status, never confirmed_* alone.
    v_pickup_disposition := 'absent';
    v_delivery_disposition := 'absent';
  else
    -- confirmed / picked_up / ready_for_delivery / completed.
    v_pickup_disposition := case
      when new.confirmed_pickup_date is null or new.confirmed_pickup_time is null then 'absent'
      when v_pickup_fulfilled then 'historical'
      else 'active'
    end;
    v_delivery_disposition := case
      when new.confirmed_delivery_date is null or new.confirmed_delivery_time is null then 'absent'
      when v_delivery_fulfilled then 'historical'
      else 'active'
    end;
  end if;

  -- date + time = timestamp (naive); AT TIME ZONE interprets that naive
  -- value as America/New_York local time and returns the equivalent
  -- timestamptz instant — the standard, DST-aware Postgres idiom. The
  -- store's confirmed windows are always exactly WINDOW_DURATION_MINUTES
  -- (60 — src/lib/booking-hours.ts) wide; kept in sync with that constant
  -- deliberately rather than importing it, since SQL can't import TS.
  if new.confirmed_pickup_date is not null and new.confirmed_pickup_time is not null then
    v_pickup_start := (new.confirmed_pickup_date + new.confirmed_pickup_time) at time zone 'America/New_York';
    v_pickup_end := v_pickup_start + interval '60 minutes';
  end if;
  if new.confirmed_delivery_date is not null and new.confirmed_delivery_time is not null then
    v_delivery_start := (new.confirmed_delivery_date + new.confirmed_delivery_time) at time zone 'America/New_York';
    v_delivery_end := v_delivery_start + interval '60 minutes';
  end if;

  perform public.upsert_calendar_sync_leg(
    new.id, 'pickup', v_calendar_identity, v_pickup_disposition, v_pickup_fulfilled,
    v_pickup_start, v_pickup_end, '🧺 PICKUP — ' || new.name, new.address,
    new.phone, new.service_type, new.special_instructions,
    'mars-booking-' || new.id::text || '-pickup@marslaundromat.com'
  );
  perform public.upsert_calendar_sync_leg(
    new.id, 'delivery', v_calendar_identity, v_delivery_disposition, v_delivery_fulfilled,
    v_delivery_start, v_delivery_end, '🚚 DELIVERY — ' || new.name, new.address,
    new.phone, new.service_type, new.special_instructions,
    'mars-booking-' || new.id::text || '-delivery@marslaundromat.com'
  );

  return new;
end;
$$;

create trigger bookings_sync_calendar_outbox
  after insert or update on public.bookings
  for each row execute function public.sync_calendar_outbox_for_booking();

revoke all on function public.sync_calendar_outbox_for_booking() from public;

-- Hard delete (deleteBooking()) — both legs go unconditionally absent,
-- regardless of history. A hard delete is a stronger, rarer, explicit
-- "erase this" action than a cancellation, and there's no app-side
-- booking record left afterward to justify keeping a "historical" entry
-- pointing at a now-dead admin link.
create or replace function public.absent_calendar_outbox_on_booking_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.calendar_sync_state
     set desired_disposition = 'absent',
         desired_version = desired_version + 1,
         desired_start = null,
         desired_end = null,
         desired_summary = null,
         desired_location = null,
         desired_phone = null,
         desired_service_type = null,
         desired_instructions = null,
         next_attempt_at = now(),
         attempt_count = 0,
         claimed_at = null,
         claimed_by = null,
         updated_at = now()
   where booking_id = old.id;
  return old;
end;
$$;

create trigger bookings_calendar_sync_on_delete
  after delete on public.bookings
  for each row execute function public.absent_calendar_outbox_on_booking_delete();

revoke all on function public.absent_calendar_outbox_on_booking_delete() from public;

-- Calendar switching: when active_calendar_identity changes, every
-- currently-not-absent outbox row is retargeted so the OR-based
-- eligibility (desired_calendar_identity <> synced_calendar_identity)
-- picks all of them up on the next reconciliation pass, without needing
-- their own desired_version to change.
--
-- 'absent' rows are deliberately excluded from this retargeting. A row
-- that's absent but not yet synced (caldav_href still points at the OLD
-- calendar — e.g. a delete that hasn't completed yet) must keep chasing
-- the calendar its real orphaned resource actually lives on until that
-- delete truly succeeds; retargeting it to the new calendar would make
-- the worker "delete" a resource that never existed there, get a 404,
-- and wrongly mark the row synced while the real resource stays behind
-- on the old calendar forever.
create or replace function public.propagate_calendar_identity_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.active_calendar_identity is distinct from old.active_calendar_identity then
    update public.calendar_sync_state
       set desired_calendar_identity = new.active_calendar_identity,
           next_attempt_at = now(),
           attempt_count = 0,
           claimed_at = null,
           claimed_by = null,
           updated_at = now()
     where desired_disposition <> 'absent';
  end if;
  return new;
end;
$$;

create trigger calendar_sync_config_identity_change
  after update on public.calendar_sync_config
  for each row execute function public.propagate_calendar_identity_change();

revoke all on function public.propagate_calendar_identity_change() from public;

-- ============================================================================
-- 5. Launch gate + claim RPC + least-privilege worker access.
-- ============================================================================

-- The ONLY way calendar_sync_config.enabled/launched_at are ever set.
-- Deliberately does not touch any existing booking row — every existing
-- booking's calendar_sync_eligible was already fixed at its own insert
-- time and stays exactly what it was. p_calendar_identity is optional so
-- this can be run before a calendar has even been selected (the test-
-- calendar identity can be set separately via a plain UPDATE — see the
-- runbook — and switched later without needing to re-run this function).
create or replace function public.enable_calendar_sync(p_calendar_identity text default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.calendar_sync_config
     set enabled = true,
         launched_at = coalesce(launched_at, now()),
         active_calendar_identity = coalesce(p_calendar_identity, active_calendar_identity),
         updated_at = now()
   where id = true;
end;
$$;

revoke all on function public.enable_calendar_sync(text) from public;
-- Not granted to anon or authenticated — run only via the Supabase SQL
-- editor by the owner, per the runbook's explicit activation step. This
-- is a deliberate, rare, one-way action, not something any app code path
-- should ever be able to trigger.

-- Lease-based claim for the worker. A DB transaction can't stay open
-- across a slow external CalDAV call, so this hands the caller a short-
-- lived lease (advances next_attempt_at) rather than holding a lock —
-- FOR UPDATE SKIP LOCKED still guarantees two overlapping callers never
-- claim the same row, and an expired, unrenewed lease (a crashed worker)
-- naturally becomes claimable again on the next call with no separate
-- cleanup step needed.
create or replace function public.claim_calendar_sync_batch(
  p_limit int,
  p_claimed_by uuid,
  p_lease_seconds int default 120
)
returns setof public.calendar_sync_state
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- SECURITY DEFINER bypasses RLS, so the function itself is the security
  -- boundary. A role-level GRANT to `authenticated` is not sufficient:
  -- every staff login also belongs to that role. Only the one immutable
  -- worker UUID configured by the owner may claim rows or receive the PII
  -- denormalized into them.
  if auth.uid() is null or not exists (
    select 1
      from public.calendar_sync_config
     where id = true and worker_user_id = auth.uid()
  ) then
    raise exception 'calendar sync worker authorization required'
      using errcode = '42501';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'calendar sync batch limit must be between 1 and 25'
      using errcode = '22023';
  end if;

  if p_claimed_by is null then
    raise exception 'calendar sync claim token is required'
      using errcode = '22023';
  end if;

  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 300 then
    raise exception 'calendar sync lease must be between 30 and 300 seconds'
      using errcode = '22023';
  end if;

  if not coalesce((
    select enabled from public.calendar_sync_config where id = true
  ), false) then
    return;
  end if;

  return query
  update public.calendar_sync_state t
     set claimed_at = now(),
         claimed_by = p_claimed_by::text,
         next_attempt_at = now() + make_interval(secs => p_lease_seconds),
         attempt_count = t.attempt_count + 1,
         last_attempted_at = now()
   where t.id in (
     select id from public.calendar_sync_state
      where next_attempt_at <= now()
        and (desired_version is distinct from synced_version
             or desired_calendar_identity is distinct from synced_calendar_identity)
      order by next_attempt_at
      limit p_limit
      for update skip locked
   )
   returning t.*;
end;
$$;

revoke all on function public.claim_calendar_sync_batch(int, uuid, int) from public;

-- Worker access is scoped to a specific immutable Supabase Auth user id.
-- This project historically treats every authenticated user as staff, so
-- merely adding worker-only policies here would NOT make a dedicated worker
-- least-privilege: the worker would also inherit the old permissive policies
-- on bookings and recurring_schedules. The two restrictive policies below
-- are ANDed with those existing permissive policies and exclude exactly the
-- configured worker UUID while leaving every real staff login unchanged.
-- When worker_user_id is null, NOT EXISTS is true and ordinary staff access
-- remains exactly as it was before this migration.
create policy "calendar worker cannot access bookings"
  on public.bookings as restrictive for all
  to authenticated
  using (
    not exists (
      select 1 from public.calendar_sync_config c where c.worker_user_id = auth.uid()
    )
  )
  with check (
    not exists (
      select 1 from public.calendar_sync_config c where c.worker_user_id = auth.uid()
    )
  );

create policy "calendar worker cannot access recurring schedules"
  on public.recurring_schedules as restrictive for all
  to authenticated
  using (
    not exists (
      select 1 from public.calendar_sync_config c where c.worker_user_id = auth.uid()
    )
  )
  with check (
    not exists (
      select 1 from public.calendar_sync_config c where c.worker_user_id = auth.uid()
    )
  );

-- The subquery reads worker_user_id fresh each check; there is exactly one
-- config row. calendar_sync_state/config remain invisible to normal staff.
create policy "calendar sync worker can execute claim and read config"
  on public.calendar_sync_config for select
  to authenticated
  using (auth.uid() = worker_user_id);

create policy "calendar sync worker can read and write outbox rows"
  on public.calendar_sync_state for select
  to authenticated
  using (
    exists (select 1 from public.calendar_sync_config c where c.worker_user_id = auth.uid())
  );

create policy "calendar sync worker can update outbox rows"
  on public.calendar_sync_state for update
  to authenticated
  using (
    exists (select 1 from public.calendar_sync_config c where c.worker_user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.calendar_sync_config c where c.worker_user_id = auth.uid())
  );

grant select on public.calendar_sync_config to authenticated;
grant select, update on public.calendar_sync_state to authenticated;
grant execute on function public.claim_calendar_sync_batch(int, uuid, int) to authenticated;
-- No insert/delete grant on calendar_sync_state for authenticated at all
-- — every row is created and retired only by the SECURITY DEFINER trigger
-- functions above, which run as the table owner regardless of grants.
-- The worker only ever needs to SELECT (via the claim RPC) and UPDATE
-- (write back its own result); it never needs to insert or delete a row.
--
-- The GRANT statements target the broad `authenticated` role because
-- Supabase has no narrower built-in API role. The claim function performs
-- its own auth.uid() check because SECURITY DEFINER bypasses RLS; direct
-- table reads/writes are constrained by the worker-only policies. The
-- restrictive policies above separately prevent the worker identity from
-- inheriting this app's historical all-authenticated staff access.

commit;
