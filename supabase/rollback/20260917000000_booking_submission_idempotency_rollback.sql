-- ============================================================================
-- ROLLBACK for supabase/migrations/20260917000000_booking_submission_idempotency.sql
--
-- MANUAL USE ONLY. This file is NOT a migration — it lives outside
-- supabase/migrations/ specifically so no tooling ever picks it up and runs it
-- automatically. Review every statement before running any of this by hand in
-- the Supabase SQL editor.
--
-- Safe to run only once the CODE deploy that calls submit_booking/
-- find_existing_booking_submission has already been rolled back first (see
-- the plan's "Deployment sequencing" — reverting the schema while the new
-- code is still live breaks every booking submission outright). Dropping
-- client_submission_id also drops the ability to tell which existing
-- bookings came through the new idempotent path, though it does not delete
-- any booking rows themselves.
-- ============================================================================
begin;

drop function if exists public.submit_booking(
  uuid, text, text, text, text, text, date, time, date, time, text, text, text, text, text
);
drop function if exists public.find_existing_booking_submission(
  uuid, text, text, text, text, text, date, time, date, time, text, text
);
drop function if exists public.booking_submission_content_matches(
  text, text, text, text, text, date, time, date, time, text, text,
  text, text, text, text, text, date, time, date, time, text, text
);

alter table public.bookings drop column if exists client_submission_id;

commit;
