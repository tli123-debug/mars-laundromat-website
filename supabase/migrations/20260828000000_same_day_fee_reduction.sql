-- Same-Day Rush fee reduction: $10 -> $8. Backward-compatible with every
-- existing quoted booking — this ONLY widens bookings_same_day_fee_check to
-- also accept the new amount; it does not touch any existing row's data,
-- any other column, the quote_total_cents generated column, or any RLS
-- policy. No historical quote is rewritten: a booking already quoted at
-- $10 stays exactly as it was quoted and keeps displaying/summing
-- correctly, since quote_total_cents is a generated column that simply
-- reads whatever same_day_fee_cents already holds.
begin;

-- bookings_same_day_fee_check currently only permits null, 0, or exactly
-- 1000 cents (added in 20260826000000_dry_cleaning_expansion.sql) — it
-- must be dropped before it can be recreated under the same name. The new
-- rule accepts EITHER 800 or 1000 for a real wash_and_fold + same_day
-- booking, so application code can start writing 800 immediately while
-- every row already quoted at 1000 remains valid and untouched.
--
-- 1000 is accepted here ONLY for backward compatibility with quotes saved
-- before this migration — SAME_DAY_FEE_CENTS in
-- src/lib/pricing/calculate-quote.ts now always generates 800 for any new
-- or re-saved quote; nothing in current application code should ever write
-- 1000 again after this migration ships. Null and zero remain allowed on
-- any booking exactly as before (not yet quoted, or staff declined/waived
-- the request) — this only widens which single nonzero amount is valid.
alter table public.bookings drop constraint bookings_same_day_fee_check;
alter table public.bookings
  add constraint bookings_same_day_fee_check check (
    same_day_fee_cents is null
    or same_day_fee_cents = 0
    or (
      service_type = 'wash_and_fold'
      and service_speed = 'same_day'
      and same_day_fee_cents in (800, 1000)
    )
  );

commit;
