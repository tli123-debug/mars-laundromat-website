-- Duplicate-submission prevention for the public booking form. Two real
-- customers double-submitted because the old success path (a toast + blank
-- form reset) looked identical to "nothing happened yet," and nothing
-- server-side stopped a retry from creating a second row.
--
-- client_submission_id is a UUID the BROWSER mints once per logical attempt
-- and reuses across every retry of that same attempt (network retry, lost
-- response, page refresh) — never regenerated except when the customer
-- explicitly starts a brand new request. Nullable, plain unique constraint:
-- Postgres treats multiple NULLs as non-conflicting, so every non-website
-- row (phone, recurring) simply never sets this and is unaffected.
--
-- Two SECURITY DEFINER functions do the actual work, called in a specific
-- order from createBooking() (see src/app/(site)/book/actions.ts):
--   1. find_existing_booking_submission — read-only recovery check, safe to
--      call with ANY candidate values including a pickup date that's now in
--      the past relative to "today." Must run BEFORE any date-sensitive
--      business-rule validation, or an already-accepted booking retried a
--      few days later (response lost, customer comes back after the
--      originally-requested date has rolled into the past) could never be
--      recovered.
--   2. submit_booking — the actual insert attempt, only ever called after
--      business-rule validation has passed. Also the concurrency backstop
--      (via the same comparison helper) for two truly-simultaneous
--      first-time calls under a brand-new id.
--
-- Every staff-only column (status, paid, admin_notes, quote_*, etc.) is
-- either hardcoded inside submit_booking or simply absent from its
-- parameter list — not bounded by an allowlist a future migration could
-- forget to update (as the anon INSERT policy's WITH CHECK allowlist is),
-- but structurally impossible for a caller to set at all. This mirrors the
-- one other privileged insert into bookings this codebase already has,
-- generate_due_recurring_bookings() (20260830000000_recurring_pickups_v1.sql),
-- also SECURITY DEFINER with search_path pinned.
--
-- Consent (sms_consent, sms_consent_at) is hardcoded inside submit_booking,
-- never accepted as a parameter: both functions are directly callable by
-- anyone over Supabase's REST RPC endpoint, bypassing createBooking/Zod
-- entirely, and a caller-suppliable consent timestamp would let a direct
-- caller fabricate a backdated or nonsensical value for what's meant to be a
-- legally-relevant record. A website submission always implies consent was
-- just given (the form's smsConsent checkbox is a hard z.literal(true) gate
-- to reach this point), so there's nothing left for a caller to supply.
--
-- This migration deliberately does NOT touch the existing "anon can create
-- pending bookings" RLS policy — that raw INSERT path is a real bypass of
-- everything here (a raw insert with no client_submission_id always
-- succeeds as a fresh row, recreating today's bug), left in place on
-- purpose as an emergency fallback during initial verification. Revoking it
-- is a deliberate, separate Stage 2 migration proposed only after this
-- Stage 1 is confirmed working in production.
begin;

alter table public.bookings
  add column client_submission_id uuid unique;

-- Shared, null-safe (IS NOT DISTINCT FROM throughout — never =, which
-- silently mishandles nulls) content comparison — written once, called by
-- both functions below, so "is this the same request" can't drift between
-- the recovery path and the create-time race backstop.
--
-- p_*_time parameters are `time`, matching the real column type of
-- preferred_pickup_time/preferred_delivery_time (confirmed by
-- windowLabel()'s own comment in src/lib/validations/booking-schema.ts
-- describing stored values as "HH:MM or Postgres's HH:MM:SS" — that's
-- time's own PostgREST serialization). A text parameter here would let
-- "14:30" and "14:30:00" fail to compare equal as strings despite meaning
-- the same window.
create or replace function public.booking_submission_content_matches(
  e_name text, e_phone text, e_address text, e_service_type text, e_service_speed text,
  e_pickup_date date, e_pickup_time time, e_delivery_date date, e_delivery_time time,
  e_dry_cleaning_item_description text, e_special_instructions text,
  p_name text, p_phone text, p_address text, p_service_type text, p_service_speed text,
  p_pickup_date date, p_pickup_time time, p_delivery_date date, p_delivery_time time,
  p_dry_cleaning_item_description text, p_special_instructions text
) returns boolean
language sql immutable
as $$
  select e_name is not distinct from p_name and e_phone is not distinct from p_phone
    and e_address is not distinct from p_address and e_service_type is not distinct from p_service_type
    and e_service_speed is not distinct from p_service_speed and e_pickup_date is not distinct from p_pickup_date
    and e_pickup_time is not distinct from p_pickup_time and e_delivery_date is not distinct from p_delivery_date
    and e_delivery_time is not distinct from p_delivery_time
    and e_dry_cleaning_item_description is not distinct from p_dry_cleaning_item_description
    and e_special_instructions is not distinct from p_special_instructions;
$$;

-- No grant to anon/authenticated at all, and PUBLIC's default auto-grant
-- explicitly revoked — this is an internal helper the two functions below
-- call (they run as the table owner via SECURITY DEFINER regardless of
-- what's granted to the actual caller); nobody outside this migration
-- calls it directly, and nothing grants it the ability to.
revoke all on function public.booking_submission_content_matches(
  text, text, text, text, text, date, time, date, time, text, text,
  text, text, text, text, text, date, time, date, time, text, text
) from public;

create or replace function public.find_existing_booking_submission(
  p_client_submission_id uuid,
  p_name text, p_phone text, p_address text,
  p_service_type text, p_service_speed text,
  p_pickup_date date, p_pickup_time time,
  p_delivery_date date, p_delivery_time time,
  p_dry_cleaning_item_description text, p_special_instructions text
) returns table (booking_id uuid, outcome text)  -- outcome: found_matching | found_conflicting | not_found
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing record;
begin
  select id, name, phone, address, service_type, service_speed,
         preferred_pickup_date, preferred_pickup_time,
         preferred_delivery_date, preferred_delivery_time,
         dry_cleaning_item_description, special_instructions
  into v_existing
  from public.bookings where client_submission_id = p_client_submission_id;

  if v_existing.id is null then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;

  if public.booking_submission_content_matches(
    v_existing.name, v_existing.phone, v_existing.address, v_existing.service_type, v_existing.service_speed,
    v_existing.preferred_pickup_date, v_existing.preferred_pickup_time,
    v_existing.preferred_delivery_date, v_existing.preferred_delivery_time,
    v_existing.dry_cleaning_item_description, v_existing.special_instructions,
    p_name, p_phone, p_address, p_service_type, p_service_speed,
    p_pickup_date, p_pickup_time, p_delivery_date, p_delivery_time,
    p_dry_cleaning_item_description, p_special_instructions
  ) then
    return query select v_existing.id, 'found_matching'::text;
  else
    return query select v_existing.id, 'found_conflicting'::text;
  end if;
end;
$$;

create or replace function public.submit_booking(
  p_client_submission_id uuid,
  p_name text, p_phone text, p_address text,
  p_service_type text, p_service_speed text,
  p_pickup_date date, p_pickup_time time,
  p_delivery_date date, p_delivery_time time,
  p_dry_cleaning_item_description text, p_dry_cleaning_item_description_zh text,
  p_special_instructions text, p_special_instructions_zh text,
  p_acquisition_source text
) returns table (booking_id uuid, outcome text)  -- outcome: created | duplicate | conflict
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_new_id uuid := gen_random_uuid();
  v_inserted_id uuid;
  v_existing record;
begin
  if p_client_submission_id is null then
    raise exception 'client_submission_id is required';
  end if;

  insert into public.bookings (
    id, client_submission_id, name, phone, address, service_type, service_speed,
    preferred_pickup_date, preferred_pickup_time, preferred_delivery_date, preferred_delivery_time,
    dry_cleaning_item_description, dry_cleaning_item_description_zh,
    special_instructions, special_instructions_zh, acquisition_source,
    status, paid, booking_source, contact_preference, sms_consent, sms_consent_at
  ) values (
    v_new_id, p_client_submission_id, p_name, p_phone, p_address, p_service_type, p_service_speed,
    p_pickup_date, p_pickup_time, p_delivery_date, p_delivery_time,
    p_dry_cleaning_item_description, p_dry_cleaning_item_description_zh,
    p_special_instructions, p_special_instructions_zh, p_acquisition_source,
    'pending', false, 'website', 'text', true, now()
  )
  on conflict (client_submission_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is not null then
    return query select v_inserted_id, 'created'::text;
    return;
  end if;

  select id, name, phone, address, service_type, service_speed,
         preferred_pickup_date, preferred_pickup_time, preferred_delivery_date, preferred_delivery_time,
         dry_cleaning_item_description, special_instructions
  into v_existing from public.bookings where client_submission_id = p_client_submission_id;

  if public.booking_submission_content_matches(
    v_existing.name, v_existing.phone, v_existing.address, v_existing.service_type, v_existing.service_speed,
    v_existing.preferred_pickup_date, v_existing.preferred_pickup_time,
    v_existing.preferred_delivery_date, v_existing.preferred_delivery_time,
    v_existing.dry_cleaning_item_description, v_existing.special_instructions,
    p_name, p_phone, p_address, p_service_type, p_service_speed,
    p_pickup_date, p_pickup_time, p_delivery_date, p_delivery_time,
    p_dry_cleaning_item_description, p_special_instructions
  ) then
    return query select v_existing.id, 'duplicate'::text;
  else
    return query select v_existing.id, 'conflict'::text;
  end if;
end;
$$;

revoke all on function public.find_existing_booking_submission(
  uuid, text, text, text, text, text, date, time, date, time, text, text
) from public;
revoke all on function public.submit_booking(
  uuid, text, text, text, text, text, date, time, date, time, text, text, text, text, text
) from public;

-- Exactly these two functions, exactly these signatures, exactly these two
-- roles — the only anon/authenticated-facing surface this migration adds.
-- Granted to authenticated too, not just anon: the public booking page has
-- no login gate, so a staff member testing or using the form while also
-- signed into /admin in another tab is a genuine, expected caller —
-- Supabase Auth's session cookie is site-wide, not scoped to /admin paths,
-- so createClient() inside the Server Action would authenticate as that
-- staff member, not anon, and the RPC would fail with a confusing
-- permission error without this dual grant.
grant execute on function public.find_existing_booking_submission(
  uuid, text, text, text, text, text, date, time, date, time, text, text
) to anon, authenticated;
grant execute on function public.submit_booking(
  uuid, text, text, text, text, text, date, time, date, time, text, text, text, text, text
) to anon, authenticated;

commit;
