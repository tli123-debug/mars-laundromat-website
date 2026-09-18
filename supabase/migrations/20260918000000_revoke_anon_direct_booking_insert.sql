-- Stage 2 of the duplicate-submission fix (20260917000000_booking_submission_
-- idempotency.sql was Stage 1). Removes the legacy anonymous direct-insert
-- path into public.bookings now that the public booking form has been
-- verified to go through find_existing_booking_submission()/submit_booking()
-- instead. Those two SECURITY DEFINER functions are unaffected by this
-- migration — they don't rely on this policy at all, since they run as the
-- table owner regardless of what's granted to the calling role.
--
-- Deliberately no "if exists": if this policy is not present under this
-- exact name when this runs, the assumed production state (Stage 1 already
-- migrated, deployed, and verified) does not hold, and this migration
-- should fail loudly and roll back rather than silently no-op against a
-- database that isn't in the state this was written for.
--
-- PRECONDITION — do not run this against production until Stage 1
-- (20260917000000_booking_submission_idempotency.sql) has been applied,
-- deployed, and confirmed working via a real submitted booking.
begin;

drop policy "anon can create pending bookings"
  on public.bookings;

commit;
