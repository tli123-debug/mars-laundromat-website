import "server-only";
import { getCalendarSyncWorkerClient } from "./worker-session";
import { processPendingCalendarSyncBatch } from "./sync-worker";
import { sanitizeCalendarSyncError } from "./sanitize-error";

// This runs inside after() and should finish promptly. The durable recovery
// route drains anything beyond this small latency-optimization batch.
const EAGER_BATCH_LIMIT = 2;

/**
 * Best-effort, fire-and-forget immediate processing — called via
 * next/server's after() from every admin action that can change a
 * booking's actionable schedule (see the after() calls in
 * bookings/[id]/actions.ts and bookings/actions.ts). Runs in-process, no
 * self-HTTP-call to the cron route needed — both share the same
 * underlying processPendingCalendarSyncBatch().
 *
 * Never throws — a failure here must never surface to the admin whose
 * own action already succeeded and already returned. Correctness does
 * not depend on this ever actually running: the durable outbox plus the
 * cron recovery route (src/app/api/cron/calendar-sync/route.ts, driven by
 * Supabase pg_cron/pg_net roughly every 5 minutes) is what guarantees
 * eventual convergence. This function is purely a latency optimization
 * so a normal confirm/reschedule/cancel shows up on the calendar within
 * seconds instead of minutes.
 */
export async function triggerImmediateCalendarSync(): Promise<void> {
  try {
    const username = process.env.ICLOUD_CALDAV_USERNAME;
    const appPassword = process.env.ICLOUD_CALDAV_APP_PASSWORD;
    if (!username || !appPassword) return; // Not configured yet — nothing to do.

    const supabase = await getCalendarSyncWorkerClient();
    await processPendingCalendarSyncBatch(
      supabase,
      {
        fetchImpl: fetch,
        credentials: { username, appPassword },
        adminBaseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      },
      EAGER_BATCH_LIMIT
    );
  } catch (error) {
    console.error(
      "calendar-sync: immediate processing failed (the recovery route will retry)",
      sanitizeCalendarSyncError(error)
    );
  }
}
