-- `paid` is independent from `status` — a booking can be confirmed-but-unpaid
-- or completed-but-unpaid, so this isn't folded into the status enum.
alter table public.bookings
  add column paid boolean not null default false;

-- No RLS policy changes needed: anon never sets this on insert (defaults to
-- false), and the existing "authenticated can update bookings" policy
-- already covers admin updates to this column.
