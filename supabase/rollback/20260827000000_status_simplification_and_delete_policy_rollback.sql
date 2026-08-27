-- ============================================================================
-- ROLLBACK for supabase/migrations/20260827000000_status_simplification_and_delete_policy.sql
--
-- MANUAL USE ONLY. This file is NOT a migration — it lives outside
-- supabase/migrations/ specifically so no tooling ever picks it up and runs it
-- automatically. Review every statement before running any of this by hand in
-- the Supabase SQL editor.
--
-- !! DATA LOSS / IRREVERSIBLE-CHANGE WARNING !!
-- Restoring the seven-value status constraint (including out_for_delivery)
-- does NOT and CANNOT recover which rows were actually out_for_delivery
-- before the forward migration ran. That migration rewrote every such row to
-- ready_for_delivery, and nothing in the database records which rows those
-- were — this rollback has no way to identify or revert them. Every booking
-- that was out_for_delivery at the time the forward migration ran will stay
-- ready_for_delivery after this rollback runs; only the CONSTRAINT is
-- restored, not the historical status data. If those rows need to be
-- identified, their IDs must have been captured BEFORE the forward
-- migration ran — there is no way to reconstruct that list afterward.
--
-- Removing the authenticated DELETE policy also does not undo any deletion
-- that already happened while the policy was active — a deleted row is
-- already permanently gone, and this rollback cannot bring it back.
-- ============================================================================
begin;

drop policy if exists "authenticated can delete bookings" on public.bookings;

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'picked_up', 'ready_for_delivery',
                     'out_for_delivery', 'completed', 'cancelled'));

commit;
