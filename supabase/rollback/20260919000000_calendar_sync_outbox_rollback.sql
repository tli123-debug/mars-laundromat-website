-- ============================================================================
-- ROLLBACK for supabase/migrations/20260919000000_calendar_sync_outbox.sql
--
-- MANUAL USE ONLY. This file is NOT a migration — it lives outside
-- supabase/migrations/ specifically so no tooling ever picks it up and runs
-- it automatically. Review every statement before running any of this by
-- hand in the Supabase SQL editor.
--
-- !! DATA LOSS WARNING !!
-- This permanently deletes the calendar sync outbox and configuration,
-- including every recorded synced_version/caldav_href/remote_etag. It does
-- NOT touch bookings.calendar_sync_eligible/calendar_sync_excluded's actual
-- VALUES on existing rows before dropping those columns, so their history
-- is lost too. It does not delete anything on the Apple Calendar side —
-- any already-created CalDAV events remain on the calendar, orphaned (no
-- longer tracked by this app), until removed by hand in Apple Calendar.
--
-- Run this only if the calendar integration is being fully removed, not as
-- a routine "pause sync" action — for that, just leave sync disabled
-- (calendar_sync_config.enabled = false) or run
--   select public.enable_calendar_sync is never called again;
-- i.e. simply never enable it, or set enabled = false directly:
--   update public.calendar_sync_config set enabled = false where id = true;
-- ============================================================================
begin;

drop trigger if exists calendar_sync_config_identity_change on public.calendar_sync_config;
drop trigger if exists bookings_calendar_sync_on_delete on public.bookings;
drop trigger if exists bookings_sync_calendar_outbox on public.bookings;
drop trigger if exists bookings_set_calendar_sync_eligibility on public.bookings;

drop policy if exists "calendar worker cannot access recurring schedules" on public.recurring_schedules;
drop policy if exists "calendar worker cannot access bookings" on public.bookings;
drop policy if exists "calendar sync worker can update outbox rows" on public.calendar_sync_state;
drop policy if exists "calendar sync worker can read and write outbox rows" on public.calendar_sync_state;
drop policy if exists "calendar sync worker can execute claim and read config" on public.calendar_sync_config;

drop function if exists public.propagate_calendar_identity_change();
drop function if exists public.absent_calendar_outbox_on_booking_delete();
drop function if exists public.sync_calendar_outbox_for_booking();
drop function if exists public.upsert_calendar_sync_leg(
  uuid, text, text, text, boolean, timestamptz, timestamptz, text, text, text, text, text, text
);
drop function if exists public.set_calendar_sync_eligibility();
drop function if exists public.claim_calendar_sync_batch(int, uuid, int);
drop function if exists public.enable_calendar_sync(text);

drop table if exists public.calendar_sync_state;

alter table public.bookings
  drop column if exists calendar_sync_eligible,
  drop column if exists calendar_sync_excluded;

drop table if exists public.calendar_sync_config;

commit;
