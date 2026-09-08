-- ============================================================================
-- ROLLBACK for supabase/migrations/20260908000000_add_acquisition_source_to_bookings.sql
--
-- MANUAL USE ONLY. This file is NOT a migration — it lives outside
-- supabase/migrations/ specifically so no tooling ever picks it up and runs it
-- automatically. Review every statement before running any of this by hand in
-- the Supabase SQL editor.
--
-- !! DATA LOSS WARNING !!
-- Dropping acquisition_source PERMANENTLY DELETES every customer's recorded
-- "how did you hear about us" answer and every booking attributed through a
-- tracked campaign link, collected since the forward migration ran. This
-- cannot be recovered once dropped. If that data has any value, back it up
-- first, for example:
--
--   select id, created_at, acquisition_source
--   from public.bookings
--   where acquisition_source is not null
--   order by created_at;
-- ============================================================================
begin;

alter table public.bookings drop constraint if exists bookings_acquisition_source_check;
alter table public.bookings drop column if exists acquisition_source;

commit;
