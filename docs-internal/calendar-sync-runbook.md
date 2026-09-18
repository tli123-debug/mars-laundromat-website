# Apple Calendar sync — architecture and launch runbook

Internal engineering documentation. Not customer-facing, not part of the
website. Lives in `docs-internal/` deliberately — separate from `docs/`,
which is the owner's own pre-existing marketing content and is never
touched by this feature.

## 1. Architecture, in one sentence

**Mars booking database → private iCloud calendar → Apple Calendar on
authorized iPhones — one-way, always.** Nothing ever flows back. Editing
a system-created event in Apple Calendar does not change the booking, and
the next legitimate dashboard change will overwrite that edit the next
time this booking's outbox row is reconciled.

### The pieces

- **Durable launch gate**: `calendar_sync_config` (a singleton row —
  `enabled`, `launched_at`, `active_calendar_identity`, `worker_user_id`)
  and `bookings.calendar_sync_eligible` (set once, at insert time, by a
  trigger — never recalculated). This is what makes "website-only" and
  "post-launch-only" permanent facts about a row, not a live query.
- **Outbox**: `calendar_sync_state`, one row per `(booking_id, leg)`,
  `leg` in `pickup`/`delivery`. Maintained by triggers on `bookings`
  (insert/update/delete) so calendar work is marked pending atomically
  with the booking write — no application code has to remember to call
  anything for the *decision* of what should happen.
- **Worker**: `src/lib/calendar-sync/sync-worker.ts`. Claims a bounded,
  leased batch of due outbox rows (`claim_calendar_sync_batch`), talks to
  Apple CalDAV with conditional requests (ETags, `If-Match`/
  `If-None-Match`), writes back conditionally so a stale claim can never
  overwrite a newer desired state.
- **Two triggers for the worker to actually run**: an eager, in-process
  `after()` call from every admin action that can change a booking's
  schedule (fast, best-effort), and a ~5-minute Supabase `pg_cron`/
  `pg_net` call to the protected `/api/cron/calendar-sync` route (slow,
  durable — the thing that actually guarantees convergence).
- **Apple CalDAV**, not an ICS subscription — a real private calendar,
  shared to specific Apple Accounts.

### What is explicitly NOT built

No calendar page in the admin area. No backfill of existing bookings,
ever. No customer-facing calendar invites. No second confirmation system
— this reads the existing `status`/`confirmed_*` fields exactly as the
admin dashboard already defines "confirmed."

## 2. How eligibility is actually enforced (read this before touching the trigger)

A booking's desired calendar membership is `calendar_sync_eligible AND
NOT calendar_sync_excluded`. `calendar_sync_config.enabled` is an
operational pause switch for worker claims; it never means "delete events."

- `calendar_sync_eligible` is set **once**, by `set_calendar_sync_eligibility()`
  (a `BEFORE INSERT` trigger), from `booking_source = 'website'` AND
  `launched_at IS NOT NULL` AND `created_at >= launched_at`, evaluated **at
  that exact moment**. It is never recalculated. A pre-launch booking's
  `created_at` never changes, so it can never become eligible later no
  matter what gets edited on it. `booking_source = 'website'` alone
  already excludes phone bookings and generated recurring occurrences —
  `submit_booking()` is the only path that ever writes `'website'`, and
  `generate_due_recurring_bookings()` is the only path that ever writes
  `'recurring'`.
- `calendar_sync_excluded` is a plain mutable column, staff-settable
  directly via SQL (`update bookings set calendar_sync_excluded = true
  where id = '...'`) — there is no admin UI toggle for this in this pass.
- `calendar_sync_config.enabled`/`launched_at` are set by
  `enable_calendar_sync()`, which never touches any existing booking row.
  After launch, setting `enabled = false` pauses external processing while
  triggers continue recording the latest desired state. Website bookings
  created during a pause remain eligible because `launched_at` is durable.

## 3. Confirmation, rescheduling, cancellation, completion — traced from the real code

This reuses the admin dashboard's own existing definition of "confirmed."
No new status, no new confirmation flow.

- A leg is **active** (event exists, 1-hour alarm) once `status` has
  reached `confirmed`/`picked_up`/`ready_for_delivery`/`completed` *and*
  that leg's `confirmed_pickup_date`+`time` (or delivery equivalent) are
  both non-null. `confirmed_*` can hold a staff **proposal** while
  `status` is still `'pending'` (`approveRequestedTime`/`saveProposedTime`
  in `bookings/[id]/actions.ts` don't always flip status immediately) —
  that's why this checks `status`, never `confirmed_*` alone.
- A leg becomes **historical** (event preserved, alarm removed) the first
  time it's *fulfilled*: pickup the moment `status` reaches `picked_up`
  or later; delivery only at `completed`. This fact is stored durably
  (`calendar_sync_state.fulfilled`) and never re-derived from a
  transient `OLD.status` — a later, unrelated edit to an already-
  cancelled booking (e.g. fixing a typo in admin notes) cannot un-remember
  it.
- **Cancelling** sets the *not-yet-fulfilled* leg to **absent** (event
  removed) and leaves an *already-fulfilled* leg **historical**
  (preserved) — cancelling after pickup but before delivery removes the
  future delivery and keeps the historical pickup, exactly as specified.
- **Rescheduling** (`saveProposedTime`, `saveProposedDeliveryTime`, or a
  plain re-`approveRequestedTime`) changes `confirmed_*`, which the
  outbox trigger detects as a content change and bumps `desired_version`
  — the worker then `PUT`s the *same, already-known* CalDAV resource with
  the new content, using `If-Match` on its current ETag. It never
  creates a second event.
- **Hard delete** (`deleteBooking`) always removes both legs
  unconditionally, including any historical ones — a stronger, rarer
  action than cancellation, and there's no booking record left afterward
  to justify keeping an entry pointing at a dead admin link.

## 4. Required environment variables

Server-only. Never `NEXT_PUBLIC_`, never committed with real values —
see the updated `.env.example`.

| Variable | What it's for |
|---|---|
| `ICLOUD_CALDAV_USERNAME` | The dedicated Mars Apple Account's email |
| `ICLOUD_CALDAV_APP_PASSWORD` | An app-specific password for that account |
| `CALENDAR_SYNC_SECRET` | Bearer secret the cron/recovery route requires |
| `CALENDAR_SYNC_WORKER_EMAIL` | The dedicated Supabase Auth worker login |
| `CALENDAR_SYNC_WORKER_PASSWORD` | Its password |

Deliberately **not** an env var: which calendar to sync to. That lives in
`calendar_sync_config.active_calendar_identity` (a database value, set by
SQL) specifically so switching calendars is a database change, not a
redeploy — see §5.10. The admin-dashboard link embedded in each event's
description reuses the existing `NEXT_PUBLIC_SITE_URL`, already used by
`src/content/site-config.ts` — no new variable needed for that.

## 5. Setup order — do not skip ahead

### 5.1 Code review (safe — no external side effects)
Read the diff. Run `npm test`, `npm run lint`, `npm run build`. All of
this is safe with zero credentials configured — every calendar code path
is inert without `ICLOUD_CALDAV_USERNAME`/`ICLOUD_CALDAV_APP_PASSWORD`
set, and nothing calls Apple until they are.

### 5.2 Supabase migration (inert until launch, but verify before production)
Apply `supabase/migrations/20260919000000_calendar_sync_outbox.sql` via
the Supabase SQL editor only after code review and a PostgreSQL/Supabase
syntax check. `calendar_sync_config.launched_at` defaults to null and
`enabled` defaults to false, so it produces zero eligible bookings and
zero outbox rows by itself.

### 5.3 Apple/iCloud setup (manual, by the owner — never paste passwords into chat)
1. Create or sign into a **dedicated Mars Laundromat Apple Account** —
   not the owner's personal one.
2. Enable two-factor authentication on it (required for app-specific
   passwords).
3. At account.apple.com, generate an **app-specific password**. Store it
   somewhere safe (a password manager) — this is what goes into
   `ICLOUD_CALDAV_APP_PASSWORD`, never the account's real password.
   **An app-specific password is not scoped to one calendar** — it
   authenticates CalDAV access to the whole Apple ID. The only real
   boundary is that this application's own code only ever addresses the
   one calendar it's told about; there is no Apple-side mechanism to
   narrow the credential itself further.
4. In Apple Calendar (on the dedicated account), create a new **private**
   calendar named "Mars Pickups & Deliveries" (or, for initial testing, a
   throwaway test calendar — see §5.5).
5. Run the discovery script to find its CalDAV URL:
   ```powershell
   $env:ICLOUD_CALDAV_USERNAME='...'
   $env:ICLOUD_CALDAV_APP_PASSWORD='...'
   npm run calendar:discover
   Remove-Item Env:ICLOUD_CALDAV_USERNAME, Env:ICLOUD_CALDAV_APP_PASSWORD
   ```
   This prints every calendar's display name and URL. It never prints
   the password. Copy the URL of the one you want.
6. Share it privately: the **owner's own** Apple Account gets **edit**
   access (so manual phone/text/walk-in orders can be added directly).
   **Employees** get **view-only** access unless one of them genuinely
   needs to add manual orders too.
7. Accept the sharing invitation on each phone.
8. On each phone, confirm Calendar notifications and event alerts are
   enabled (Settings → Calendar → and the specific calendar's own alert
   settings) — Apple Calendar/iCloud is responsible for actually showing
   and notifying; this app only ever writes the event and its one alarm.

### 5.4 Supabase worker identity (manual, by the owner)
1. Supabase Dashboard → Authentication → Users → **Add User**. Use a
   real email only the owner controls and a strong generated password.
   Never create this via the admin API — this app never uses the
   service-role key that would require.
2. Copy that new user's UUID.
3. In the SQL editor:
   ```sql
   update public.calendar_sync_config set worker_user_id = '<that uuid>' where id = true;
   ```
   Do this immediately after creating the account. The migration's
   restrictive policies then remove the worker from the application's
   broad staff access to `bookings` and `recurring_schedules`; only its
   calendar-sync policies remain.
4. Before adding its credentials to Vercel, verify with an authenticated
   worker session that selecting `bookings` and `recurring_schedules`
   returns no rows while `claim_calendar_sync_batch` succeeds only for
   this UUID. Verify a normal staff login still works normally.
5. Set `CALENDAR_SYNC_WORKER_EMAIL`/`CALENDAR_SYNC_WORKER_PASSWORD` in
   Vercel to that login's credentials.

### 5.5 Choose the launch calendar
For the production database, use the real private "Mars Pickups &
Deliveries" calendar as `active_calendar_identity` before launch:
```sql
update public.calendar_sync_config set active_calendar_identity = '<production calendar url>' where id = true;
```
A throwaway calendar is appropriate for a separate staging Supabase
project. Do not enable the production database against a test calendar
while believing there is a second launch later: `enable_calendar_sync()`
is the real, permanent launch boundary for booking eligibility.

### 5.6 Vercel environment variables
Set all five variables from §4 in the Vercel project's Environment
Variables (Production, and Preview if you want to test there too). Set
`CALENDAR_SYNC_SECRET` to a long random value (`openssl rand -hex 32`).
Deploy.

### 5.7 Set up the ~5-minute recovery call (Supabase pg_cron/pg_net)
Vercel Hobby does not support frequent native cron, so the durable
recovery path is driven from Supabase instead. Store the secret and URL
in **Supabase Vault**, not in a committed migration:
```sql
select vault.create_secret('<CALENDAR_SYNC_SECRET value>', 'calendar_sync_secret');
select vault.create_secret('https://<your-vercel-domain>/api/cron/calendar-sync', 'calendar_sync_endpoint');

create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.invoke_calendar_sync_recovery()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_secret text;
  v_url text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'calendar_sync_secret';
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'calendar_sync_endpoint';
  if v_secret is null or v_url is null then
    return; -- not configured yet — safely repeatable no-op
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
end;
$$;

revoke all on function public.invoke_calendar_sync_recovery() from public, anon, authenticated;

select cron.schedule('calendar_sync_recovery', '*/5 * * * *', $$select public.invoke_calendar_sync_recovery();$$);
```
This is a one-time setup script run by hand in the SQL editor — it is
**not** part of the committed migration, since it needs your real Vercel
domain and secret substituted in. `net.http_post` is fire-and-forget from
Postgres's side (it queues the request and returns immediately); the
route itself enforces its own `maxDuration` and processes a bounded
batch, so this is safe to fire every 5 minutes indefinitely.

### 5.8 Launch once, against the production calendar
After the migration, worker identity, Vercel secrets, production calendar,
and five-minute recovery job are all ready:
```sql
select public.enable_calendar_sync();
```
This is the one actual launch. It records `launched_at`; only website
bookings created from this moment forward are eligible. There is no
second activation step later.

### 5.9 Run the post-launch smoke test
Create one new website booking after §5.8, confirm it through the normal
dashboard, and verify it in the production calendar. Either wait for the
recovery call or invoke it once:
```bash
curl -X POST https://<your-domain>/api/cron/calendar-sync \
  -H "Authorization: Bearer <CALENDAR_SYNC_SECRET>"
```

### 5.10 Calendar replacement or recovery
If the business intentionally changes calendars later:
```sql
update public.calendar_sync_config set active_calendar_identity = '<production calendar url>' where id = true;
```
This does not touch `enabled`/`launched_at`. The identity-change trigger
retargets active/historical rows. The worker creates each replacement in
the new calendar before deleting its old system-owned resource. Manual
events in either calendar are untouched.

## 6. Real-device acceptance test

**Do not run this without your explicit go-ahead and your own Apple
credentials in hand — never paste a password into chat.** Use a staging
Supabase project and throwaway calendar for a pre-launch rehearsal. The
production database's end-to-end smoke test necessarily happens after
the one launch boundary in §5.8.

1. [ ] Create a new post-launch website booking.
2. [ ] Confirm its pickup and delivery through the existing dashboard.
3. [ ] Exactly one pickup event and one delivery event appear on the
       selected calendar.
4. [ ] Tapping the event's location on an iPhone opens it correctly in
       Apple Maps.
5. [ ] Both authorized phones (owner + at least one employee/second
       account) show the events.
6. [ ] Schedule a controlled test appointment far enough ahead, lock the
       phone, and confirm the alert actually fires ~1 hour before —
       **and repeat this on the second phone too**; do not assume one
       phone's notification/Focus settings generalize to another's.
7. [ ] Reschedule it and confirm the *same* event updates (not a second
       one).
8. [ ] Cancel a future (not-yet-fulfilled) test event and confirm it
       disappears.
9. [ ] Manually create an unrelated event directly in Apple Calendar on
       the same calendar, then run a sync cycle, and confirm that manual
       event is completely untouched.

Mark each line pending until you've actually performed it — none of this
is assumed done by writing the code.

## 7. Operating the system

### Disabling sync safely
```sql
update public.calendar_sync_config set enabled = false where id = true;
```
The claim RPC returns no work while disabled, so Apple is untouched.
Booking triggers still record the latest desired state and post-launch
website bookings remain eligible. Re-enable with
`select public.enable_calendar_sync();`; the worker then reconciles the
accumulated changes.

### Rotating the Apple app-specific password
Generate a new one at appleid.apple.com, update
`ICLOUD_CALDAV_APP_PASSWORD` in Vercel, redeploy. No database change
needed. The old password can be revoked from appleid.apple.com once the
new one is confirmed working.

### Rotating the worker secret/password
- `CALENDAR_SYNC_SECRET`: generate a new value, update it in Vercel
  **and** in the Supabase Vault secret from §5.7, redeploy.
- `CALENDAR_SYNC_WORKER_PASSWORD`: change it for that Supabase Auth user
  (dashboard), update the Vercel env var, redeploy.

### Diagnosing and retrying failed jobs
```sql
select id, booking_id, leg, desired_disposition, attempt_count, last_error, next_attempt_at
from public.calendar_sync_state
where desired_version is distinct from synced_version
   or desired_calendar_identity is distinct from synced_calendar_identity
order by next_attempt_at;
```
`last_error` is always sanitized (no credentials, no customer
instructions). To force an immediate retry rather than waiting for
backoff:
```sql
update public.calendar_sync_state set next_attempt_at = now() where id = '<row id>';
```

### Confirming no backfill ever occurred
```sql
select count(*) from public.bookings where calendar_sync_eligible; -- pre-launch rows must remain false
select count(*) from public.bookings where calendar_sync_eligible and created_at < (select launched_at from public.calendar_sync_config where id = true);
-- the second query must always return 0 — a durable-eligibility violation would mean a real bug, not an expected state
```

## 8. What could not be tested without live credentials

- The actual Apple CalDAV server's real-world behavior (exact error
  bodies, any iCloud-specific quirks in ETag handling) — the automated
  test suite uses a deterministic fake transport (see
  `src/lib/calendar-sync/*.test.ts`), verified against the documented
  CalDAV/HTTP semantics (404/409/412, `If-Match`/`If-None-Match`), not a
  real Apple server.
- Whether a bare `TZID=America/New_York` (no embedded `VTIMEZONE` block)
  renders and alerts correctly on a real iPhone — confirmed correct
  against `ical-generator`'s own DST-aware conversion logic and RFC 5545
  semantics, but a real device is what the acceptance test in §6 is for.
- The Supabase Auth worker identity's actual sign-in/session-refresh
  behavior against a live project (no Docker/Supabase CLI is available
  in this environment to run a local instance).
- The Supabase Vault + `pg_net` recovery call's real timing/reliability
  in production.
