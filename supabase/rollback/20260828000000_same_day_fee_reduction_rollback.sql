-- ============================================================================
-- ROLLBACK for supabase/migrations/20260828000000_same_day_fee_reduction.sql
--
-- MANUAL USE ONLY. This file is NOT a migration — it lives outside
-- supabase/migrations/ specifically so no tooling ever picks it up and runs
-- it automatically. Review every statement before running any of this by
-- hand in the Supabase SQL editor.
--
-- !! WARNING: THIS WILL FAIL IF ANY BOOKING HAS BEEN QUOTED AT $8 SINCE !!
-- The restored constraint only accepts 1000 cents (the pre-$8 rule) for a
-- real same-day fee. PostgreSQL validates every existing row the instant a
-- CHECK constraint is (re-)added, so if even one booking already has
-- same_day_fee_cents = 800 by the time this runs, the ADD CONSTRAINT
-- statement below will fail outright with a constraint-violation error —
-- it will NOT silently corrupt, drop, or rewrite that row. Before running
-- this rollback, find any such rows first:
--
--   select id, name, same_day_fee_cents, quote_status
--   from public.bookings
--   where same_day_fee_cents = 800;
--
-- Every row that query returns was quoted under the $8 fee and would need
-- its quote corrected back to $10 (which recomputes quote_total_cents, a
-- generated column, automatically) before this rollback can succeed —
-- and the application code would need to go back to generating $10 too,
-- or the very next quote save would just violate the restored constraint
-- again. This rollback cannot make that business decision for you; it only
-- reverts the database-level rule once you have.
-- ============================================================================
begin;

alter table public.bookings drop constraint if exists bookings_same_day_fee_check;
alter table public.bookings
  add constraint bookings_same_day_fee_check check (
    same_day_fee_cents is null
    or same_day_fee_cents = 0
    or (service_type = 'wash_and_fold' and service_speed = 'same_day' and same_day_fee_cents = 1000)
  );

commit;
