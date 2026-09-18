import "server-only";
import { getCalendarSyncWorkerClient } from "@/lib/calendar-sync/worker-session";
import { processPendingCalendarSyncBatch } from "@/lib/calendar-sync/sync-worker";
import { isAuthorizedCalendarSyncRequest } from "@/lib/calendar-sync/verify-worker-secret";
import { sanitizeCalendarSyncError } from "@/lib/calendar-sync/sanitize-error";

// Bounded well under Vercel Hobby's function timeout, and the batch size
// below is deliberately small — this route is the DURABLE recovery path
// (called roughly every 5 minutes by Supabase pg_cron/pg_net; see the
// runbook), not the primary sync mechanism. The primary mechanism is the
// eager, in-process after() call triggered directly from the admin
// actions that change a booking's schedule — this route exists so that
// whatever the eager path didn't finish (a crash, a timeout, an Apple
// outage) still converges within a few minutes instead of being lost.
export const maxDuration = 30;

// Rows are processed sequentially and an individual Apple request has a
// five-second timeout. A small recovery batch keeps this route comfortably
// inside its 30-second ceiling even during an outage; the five-minute cron
// will continue draining later batches.
const BATCH_LIMIT = 3;

export async function POST(request: Request) {
  const authorized = isAuthorizedCalendarSyncRequest(
    request.headers.get("authorization"),
    process.env.CALENDAR_SYNC_SECRET
  );
  if (!authorized) {
    // Minimal response — no detail about why, no echo of what was sent.
    return new Response(null, { status: 401 });
  }

  try {
    const supabase = await getCalendarSyncWorkerClient();
    const username = process.env.ICLOUD_CALDAV_USERNAME;
    const appPassword = process.env.ICLOUD_CALDAV_APP_PASSWORD;
    if (!username || !appPassword) {
      // Not configured yet (e.g. this route reachable before Apple setup
      // is complete) — a clean, minimal no-op rather than a crash.
      return Response.json({ ok: false, reason: "not_configured" }, { status: 200 });
    }

    const result = await processPendingCalendarSyncBatch(
      supabase,
      {
        fetchImpl: fetch,
        credentials: { username, appPassword },
        adminBaseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      },
      BATCH_LIMIT
    );
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("calendar-sync cron: batch failed", sanitizeCalendarSyncError(error));
    // Minimal response body — the sanitized detail goes to server logs
    // only, never back over the wire.
    return Response.json({ ok: false }, { status: 500 });
  }
}
