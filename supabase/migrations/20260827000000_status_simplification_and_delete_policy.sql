-- Owner acceptance revision, checkpoint A: status simplification (removes
-- out_for_delivery from the approved lifecycle) and a new, explicitly
-- owner-requested authenticated DELETE policy. Not purely additive — this
-- narrows bookings_status_check and adds a genuinely new capability
-- (permanent deletion) that the original schema deliberately omitted; both
-- are current, explicit owner decisions, not oversights being corrected.
begin;

-- 1. Status simplification. out_for_delivery is removed from the approved
-- lifecycle — Checkpoint B updates Today-board and admin categorization so
-- ready_for_delivery alone is sufficient right up until completed. The
-- backfill below MUST run before the narrower CHECK constraint is added:
-- Postgres validates every existing row against a newly added CHECK, so any
-- row still holding 'out_for_delivery' would make the ADD CONSTRAINT below
-- fail outright.
update public.bookings set status = 'ready_for_delivery' where status = 'out_for_delivery';

alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'picked_up', 'ready_for_delivery',
                     'completed', 'cancelled'));

-- 2. Authenticated permanent deletion. The original schema deliberately had
-- no DELETE policy for any role (see 20260817000000_create_bookings_table.sql,
-- "No delete policy for any role: deletes are only possible from the
-- Supabase dashboard/SQL editor, never through the app.") — the owner has
-- now explicitly changed that requirement. Scoped to the same "any
-- authenticated user is a trusted admin" model already used for this
-- table's SELECT/UPDATE/INSERT policies (single small business, no
-- per-tenant ownership model). anon gets no DELETE policy at all — RLS
-- denies by default when no policy matches, so anon remains completely
-- unable to delete anything, exactly as before. The application's own
-- Server Action additionally requires requireAdmin() before ever issuing
-- this query (Checkpoint B) — this policy is the database-level backstop,
-- not the only gate. No service-role key is introduced anywhere.
create policy "authenticated can delete bookings"
  on public.bookings for delete
  to authenticated
  using (true);

commit;
