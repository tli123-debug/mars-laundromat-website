-- ============================================================================
-- ROLLBACK for supabase/migrations/20260826000000_dry_cleaning_expansion.sql
--
-- MANUAL USE ONLY. This file is NOT a migration — it lives outside
-- supabase/migrations/ specifically so no tooling ever picks it up and runs it
-- automatically. Review every statement before running any of this by hand in
-- the Supabase SQL editor.
--
-- !! DATA LOSS WARNING !!
-- Dropping the columns below PERMANENTLY DELETES whatever has already been
-- entered into them: service type, the customer's dry-cleaning item
-- description and its Chinese translation, the staff-entered subtotal,
-- notes, and effective charge. Recreating quote_total_cents with the old
-- 3-input formula also means any booking created after the forward
-- migration loses the dry-cleaning portion of its total, and restoring
-- bookings_same_day_fee_check to its original nonnegative-only rule removes
-- the guarantee that a same-day fee can only ever land on a real same-day
-- wash-and-fold booking. Only run this if you are certain no real
-- dry-cleaning booking has been created yet — otherwise back up the
-- affected rows first.
-- ============================================================================
begin;

-- Must happen before the column drops below: the widened anon policy
-- references the new columns, and Postgres won't let you drop a column
-- that's still referenced by an existing policy's WITH CHECK.
alter policy "anon can create pending bookings" on public.bookings
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
  );

-- bookings_same_day_fee_check pre-dates the forward migration (it was
-- added in 20260822000000_pickup_delivery_v1.sql), so it's restored to its
-- original rule, not just dropped.
alter table public.bookings drop constraint if exists bookings_same_day_fee_check;
alter table public.bookings add constraint bookings_same_day_fee_check
  check (same_day_fee_cents is null or same_day_fee_cents >= 0);

alter table public.bookings drop constraint if exists bookings_service_type_speed_consistency_check;

alter table public.bookings drop constraint if exists bookings_service_speed_check;
alter table public.bookings add constraint bookings_service_speed_check
  check (service_speed in ('standard', 'flexible', 'same_day'));

-- Recreate with the pre-dry-cleaning 3-input formula. Any booking created
-- after the forward migration with a nonzero dry-cleaning charge will have
-- its total silently drop to just the wash-and-fold portion once this runs.
alter table public.bookings drop column if exists quote_total_cents;
alter table public.bookings
  add column quote_total_cents integer generated always as (
    coalesce(laundry_charge_cents, 0) + coalesce(same_day_fee_cents, 0) + surcharge_total_cents
  ) stored;

alter table public.bookings drop constraint if exists bookings_dry_cleaning_amounts_check;

alter table public.bookings
  drop column if exists dry_cleaning_notes,
  drop column if exists dry_cleaning_effective_charge_cents,
  drop column if exists dry_cleaning_item_subtotal_cents,
  drop column if exists dry_cleaning_item_description_zh,
  drop column if exists dry_cleaning_item_description;

alter table public.bookings drop constraint if exists bookings_service_type_check;
alter table public.bookings drop column if exists service_type;

commit;
