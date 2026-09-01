-- ============================================================================
-- ROLLBACK for supabase/migrations/20260831000000_activate_recurring_pickups_cron.sql
--
-- MANUAL USE ONLY. This file is NOT a migration — it lives outside
-- supabase/migrations/ specifically so no tooling ever picks it up and runs
-- it automatically. Requires the owner's explicit authorization to run for
-- any reason.
--
-- This is the EMERGENCY-STOP path for the recurring pickup system. It ONLY
-- unschedules the daily cron job — no data of any kind is touched:
--   - recurring_schedules rows are untouched (every schedule, active,
--     paused, or cancelled, stays exactly as it is).
--   - Every booking ever generated stays exactly as it is — nothing here
--     deletes or modifies a single booking.
--   - generate_due_recurring_bookings() itself is left in place, dormant
--     again (EXECUTE remains granted to postgres, same as after Checkpoint
--     1 — this only stops anything from ever calling it automatically).
-- Once this runs, no new recurring booking will ever be generated again
-- until the activation migration is re-applied by hand. This is the
-- PREFERRED rollback for essentially any problem with the recurring
-- system — see the Checkpoint 1 rollback file for the much more drastic,
-- rarely-necessary full schema teardown, which this file deliberately
-- does not attempt.
-- ============================================================================
begin;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if exists (select 1 from cron.job where jobname = 'generate_due_recurring_bookings_daily') then
      perform cron.unschedule('generate_due_recurring_bookings_daily');
    end if;
  end if;
end $$;

commit;
