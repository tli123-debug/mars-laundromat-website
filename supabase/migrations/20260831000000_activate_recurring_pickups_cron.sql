-- Recurring Pickup System V1, Checkpoint 3: cron activation. This is the
-- ONLY step in the whole feature that makes generate_due_recurring_bookings()
-- actually run automatically — everything before this point (the schema,
-- the function itself, the whole admin workflow) has been fully live and
-- usable with zero automatic generation, because nothing has ever called
-- that function. Additive and narrowly scoped: one EXECUTE grant to the
-- single non-application role that needs it, and one pg_cron job. Nothing
-- about the existing schema, RLS policies, or application code changes.
--
-- Uses Supabase's built-in pg_cron extension to call the database function
-- directly, in-process — never a public HTTP route, never Vercel Cron,
-- and requires no service-role key or other application secret. EXECUTE
-- stays revoked from anon and authenticated exactly as Checkpoint 1 left
-- it; the grant below is scoped to `postgres` only, the role that owns
-- this function and that the Supabase SQL Editor (where this file must be
-- run) connects as — not a client-facing or application role.
begin;

-- 1. Grant EXECUTE to postgres only. generate_due_recurring_bookings() is
-- SECURITY DEFINER, so it already runs with its OWNER's privileges
-- regardless of caller — but SECURITY DEFINER changes whose privileges
-- the function body runs WITH, not whether the caller needs EXECUTE to
-- invoke it in the first place. pg_cron jobs created via cron.schedule()
-- run as whichever role was connected when the job was scheduled, which
-- for a migration run through the Supabase SQL Editor is `postgres`. This
-- grant is what actually lets the cron job call the function; anon and
-- authenticated remain exactly as revoked in Checkpoint 1's migration —
-- this statement does not touch either of them.
grant execute on function public.generate_due_recurring_bookings(date) to postgres;

-- 2. Schedule the daily job. Defensively unschedules any existing job
-- under this exact name first — a safe no-op if none exists (guarded by
-- checking pg_namespace/cron.job the same way the Checkpoint 1 rollback
-- file already does, so re-running or re-reviewing this file can never
-- accumulate a second, duplicate job under a different jobid). The
-- command passes no argument to generate_due_recurring_bookings(), so it
-- always uses that function's own default —
-- (now() at time zone 'America/New_York')::date — computed fresh at the
-- moment each run actually executes, not baked into the cron schedule
-- itself.
--
-- Schedule: '0 8 * * *' — 08:00 UTC, every day. pg_cron interprets this
-- in UTC (Supabase's Postgres instances run in UTC; pg_cron does not
-- follow America/New_York or any other session timezone). Converted to
-- the store's own Eastern time across both halves of the year:
--   - EST (UTC-5, roughly early November-mid March):  08:00 UTC = 3:00 AM ET
--   - EDT (UTC-4, roughly mid March-early November):   08:00 UTC = 4:00 AM ET
-- Both are comfortably before the store's earliest opening time (8:00 AM
-- weekdays, 8:30 AM weekends — see src/content/site-config.ts), with
-- 4-5.5 hours of buffer either way, so staff always see newly generated
-- pending bookings well before the store opens. A single fixed UTC cron
-- time was chosen deliberately over trying to shift the schedule for DST
-- — pg_cron's classic cron.schedule() has no reliable per-job IANA
-- timezone support to lean on, so shifting the schedule itself twice a
-- year would be extra manual upkeep for no real benefit, when a single
-- fixed UTC time already stays safely early in local terms year-round.
--
-- Safe under duplicate/concurrent invocation because the function itself
-- is idempotent (bookings_recurring_schedule_occurrence_unique_idx plus
-- its ON CONFLICT DO NOTHING handling — see the Checkpoint 1 migration)
-- — this schedule is intentionally still just "once daily," not relying
-- on that idempotency to justify anything more frequent.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if exists (select 1 from cron.job where jobname = 'generate_due_recurring_bookings_daily') then
      perform cron.unschedule('generate_due_recurring_bookings_daily');
    end if;
  end if;
end $$;

select cron.schedule(
  'generate_due_recurring_bookings_daily',
  '0 8 * * *',
  $$select public.generate_due_recurring_bookings();$$
);

commit;
