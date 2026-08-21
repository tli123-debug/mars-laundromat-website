-- ============================================================================
-- ROLLBACK for supabase/migrations/20260822000000_pickup_delivery_v1.sql
--
-- MANUAL USE ONLY. This file is NOT a migration — it lives outside
-- supabase/migrations/ specifically so no tooling ever picks it up and runs it
-- automatically. Review every statement before running any of this by hand in
-- the Supabase SQL editor.
--
-- !! DATA LOSS WARNING !!
-- Dropping the columns below PERMANENTLY DELETES whatever staff have already
-- entered into them: confirmed pickup/delivery times, actual weights, laundry
-- charges, same-day fees, surcharge notes, quote totals and status, payment
-- method/timestamp/verifier, and created/updated-by attribution. Once any of
-- that exists in production, this rollback is destructive, not just a revert.
-- Only run this if you are certain no real operational data in these columns
-- needs to be kept — otherwise back up the affected rows first.
-- ============================================================================
begin;

drop policy if exists "authenticated can create bookings" on public.bookings;

-- Status must be remapped BEFORE the constraint is tightened back down, or the
-- constraint change itself fails outright the moment any real booking has
-- already progressed into one of the three new statuses.
update public.bookings set status = 'confirmed'
  where status in ('picked_up', 'ready_for_delivery', 'out_for_delivery');

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'completed', 'cancelled'));

alter table public.bookings
  drop column if exists created_by,
  drop column if exists updated_by,
  drop column if exists payment_verified_by,
  drop column if exists paid_at,
  drop column if exists payment_method,
  drop column if exists quote_total_cents,
  drop column if exists quote_sent_at,
  drop column if exists quote_status,
  drop column if exists surcharge_notes,
  drop column if exists surcharge_total_cents,
  drop column if exists same_day_fee_cents,
  drop column if exists laundry_charge_cents,
  drop column if exists billable_weight_lb,
  drop column if exists actual_weight_lb,
  drop column if exists service_speed,
  drop column if exists sms_consent_at,
  drop column if exists sms_consent,
  drop column if exists contact_preference,
  drop column if exists booking_source,
  drop column if exists confirmed_delivery_time,
  drop column if exists confirmed_delivery_date,
  drop column if exists confirmed_pickup_time,
  drop column if exists confirmed_pickup_date;

commit;
