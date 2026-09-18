-- ============================================================================
-- ROLLBACK for supabase/migrations/20260918000000_revoke_anon_direct_booking_insert.sql
--
-- MANUAL USE ONLY. This file is NOT a migration — it lives outside
-- supabase/migrations/ specifically so no tooling ever picks it up and runs it
-- automatically. Review every statement before running any of this by hand in
-- the Supabase SQL editor.
--
-- !! WHAT THIS REOPENS !!
-- Restoring this policy re-enables the legacy raw anonymous INSERT route into
-- public.bookings (a direct POST to the PostgREST /bookings endpoint), which
-- Stage 2 removed specifically because it bypasses find_existing_booking_
-- submission()/submit_booking() entirely — no dedup, no recovery, no
-- protection against the exact duplicate-submission bug this whole project
-- exists to fix. Only restore this as a deliberate, temporary emergency
-- measure, and remove it again once the emergency is resolved.
--
-- WHEN YOU'D ACTUALLY NEED THIS
-- If you ever roll the deployed APPLICATION back to the old, pre-RPC booking
-- code (the version before 20260917000000_booking_submission_idempotency.sql
-- shipped), that old code performs a raw insert and has no idea the RPCs
-- exist — it will fail every booking submission unless this policy is back
-- in place. In that specific scenario, run this rollback FIRST, then deploy
-- the old code — never the other way around, or the public booking form goes
-- down for however long the gap lasts.
--
-- WHAT THIS DOES NOT TOUCH
-- The Stage 1 objects (find_existing_booking_submission, submit_booking,
-- booking_submission_content_matches, and the client_submission_id column)
-- are left exactly as they are. There is no reason to remove them just to
-- restore this policy — they're inert from anon's perspective without it,
-- and removing them is a separate decision with its own rollback file
-- (supabase/rollback/20260917000000_booking_submission_idempotency_rollback.sql)
-- if that's ever actually needed.
--
-- This recreates the EXACT latest policy definition — copied verbatim from
-- its last alteration, supabase/migrations/20260830000000_recurring_pickups_v1.sql
-- (lines 179-207) — not an earlier or weaker version from any of its prior
-- alterations in 20260822000000_pickup_delivery_v1.sql or
-- 20260826000000_dry_cleaning_expansion.sql. CREATE, not ALTER, because
-- ALTER POLICY requires the policy to already exist, which after Stage 2 it
-- no longer does.
-- ============================================================================
begin;

create policy "anon can create pending bookings"
  on public.bookings for insert
  to anon
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

commit;
