// No `import "server-only"` here, deliberately — unlike worker-session.ts,
// this module never reads a secret env var itself (credentials/clients are
// always passed in by the caller), and `server-only` isn't a real resolvable
// package outside Next's own bundler — it can't be imported under plain
// Vitest, which is exactly why every OTHER file in this codebase that has
// it (require-admin.ts, send-booking-notification.tsx) is never imported
// by a test file. This one deliberately is, since its reconciliation logic
// is the part that most needs real unit coverage.
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  type CalDavCredentials,
  type CalDavFetch,
  deleteCalendarObject,
  getCalendarObject,
  putCalendarObject,
  resourceHrefForUid,
} from "./caldav-client";
import { buildEventIcs } from "./ical";
import { sanitizeCalendarSyncError } from "./sanitize-error";
import { SERVICE_TYPE_CUSTOMER_LABELS } from "@/lib/service-type";
import type { ServiceType } from "@/types/database.types";

export type ClaimedCalendarSyncRow = Database["public"]["Tables"]["calendar_sync_state"]["Row"];

/**
 * Staff-facing description text — phone, service type (via the same
 * SERVICE_TYPE_CUSTOMER_LABELS mapping the customer-facing assisted texts
 * already use, so the label can't drift), customer instructions (never
 * the internal admin_notes field, never payment or consent data), the
 * booking id, and a link to the admin detail page built from
 * NEXT_PUBLIC_SITE_URL — the same base URL src/content/site-config.ts
 * already uses, so no new env var was needed for this.
 */
export function buildEventDescription(row: {
  desired_phone: string | null;
  desired_service_type: string | null;
  desired_instructions: string | null;
  booking_id: string;
}, adminBaseUrl: string): string {
  const lines: string[] = [];
  if (row.desired_phone) lines.push(`Phone: ${row.desired_phone}`);
  const serviceType = row.desired_service_type as ServiceType | null;
  if (serviceType && serviceType in SERVICE_TYPE_CUSTOMER_LABELS) {
    lines.push(`Service: ${SERVICE_TYPE_CUSTOMER_LABELS[serviceType]}`);
  }
  if (row.desired_instructions) lines.push(`Instructions: ${row.desired_instructions}`);
  lines.push(`Booking: ${row.booking_id}`);
  lines.push(`${adminBaseUrl}/admin/bookings/${row.booking_id}`);
  return lines.join("\n");
}

export interface ReconcileDependencies {
  fetchImpl: CalDavFetch;
  credentials: CalDavCredentials;
  adminBaseUrl: string;
}

export type ReconcileOutcome =
  | { status: "synced"; caldavHref: string | null; remoteEtag: string | null }
  | { status: "retry_now" }
  | { status: "failed"; sanitizedError: string };

/**
 * Reconciles ONE outbox row against Apple CalDAV — pure with respect to
 * the database (it never reads or writes calendar_sync_state itself;
 * the caller does that), so it's directly testable with just a fake
 * fetch, no live Postgres or Apple credentials required.
 *
 * "retry_now" means a 412/409 was hit and this function already re-read
 * the resource and retried once with the fresh etag within this same
 * call — if that retry ALSO hits a precondition failure, this returns
 * "retry_now" again so the caller leaves the row pending rather than
 * looping indefinitely inside one invocation.
 */
export async function reconcileOneLeg(
  row: {
    desired_disposition: string;
    desired_start: string | null;
    desired_end: string | null;
    desired_summary: string | null;
    desired_location: string | null;
    desired_phone: string | null;
    desired_service_type: string | null;
    desired_instructions: string | null;
    booking_id: string;
    ical_uid: string;
    caldav_href: string | null;
    remote_etag: string | null;
    desired_calendar_identity: string | null;
    synced_calendar_identity: string | null;
  },
  deps: ReconcileDependencies
): Promise<ReconcileOutcome> {
  try {
    if (!row.desired_calendar_identity) {
      // Before launch there is normally no href either, so this is a safe
      // no-op. If a resource already exists, however, losing the target
      // identity would make it impossible to prove where that resource
      // belongs; leave the row due instead of falsely acknowledging it.
      if (row.caldav_href) {
        return {
          status: "failed",
          sanitizedError: "Calendar target is not configured for an existing event",
        };
      }
      return { status: "synced", caldavHref: row.caldav_href, remoteEtag: row.remote_etag };
    }

    const desiredHref = resourceHrefForUid(row.desired_calendar_identity, row.ical_uid);

    const deleteWithFreshEtagRetry = async (
      href: string,
      knownEtag: string | null
    ): Promise<"removed" | "retry_now"> => {
      const first = await deleteCalendarObject(
        deps.fetchImpl,
        deps.credentials,
        href,
        knownEtag ?? undefined
      );
      if (first === "deleted" || first === "already_absent") return "removed";

      const fresh = await getCalendarObject(deps.fetchImpl, deps.credentials, href);
      if (!fresh.exists) return "removed";
      const retry = await deleteCalendarObject(
        deps.fetchImpl,
        deps.credentials,
        href,
        fresh.etag ?? undefined
      );
      return retry === "deleted" || retry === "already_absent" ? "removed" : "retry_now";
    };

    if (row.desired_disposition === "absent") {
      // Always try the deterministic desired href, even when caldav_href
      // is null: an earlier create may have succeeded at Apple and then
      // lost its database acknowledgement. During a calendar switch the
      // recorded href can point at the old calendar while a stale worker
      // also created the deterministic resource in the new one, so delete
      // both distinct system-owned locations before acknowledging absence.
      const targets = new Map<string, string | null>();
      if (row.caldav_href) targets.set(row.caldav_href, row.remote_etag);
      if (
        !row.caldav_href ||
        row.synced_calendar_identity !== row.desired_calendar_identity
      ) {
        if (!targets.has(desiredHref)) targets.set(desiredHref, null);
      }

      for (const [href, etag] of targets) {
        const removed = await deleteWithFreshEtagRetry(href, etag);
        if (removed === "retry_now") return { status: "retry_now" };
      }
      return { status: "synced", caldavHref: null, remoteEtag: null };
    }

    if (!row.desired_start || !row.desired_end || !row.desired_summary) {
      return {
        status: "failed",
        sanitizedError: "Active calendar event is missing its confirmed schedule",
      };
    }

    // active or historical: the event should exist with this content.
    const icsBody = buildEventIcs({
      uid: row.ical_uid,
      summary: row.desired_summary ?? "",
      start: new Date(row.desired_start),
      end: new Date(row.desired_end),
      location: row.desired_location ?? "",
      description: buildEventDescription(row, deps.adminBaseUrl),
      // Once a stop has happened it remains visible as history but no
      // longer carries an actionable phone reminder.
      includeReminder: row.desired_disposition === "active",
    });

    const ensureDesiredResource = async (
      knownHref: string | null,
      knownEtag: string | null
    ): Promise<
      { status: "synced"; href: string; etag: string | null } | { status: "retry_now" }
    > => {
      const targetHref = knownHref ?? desiredHref;
      if (!knownHref) {
        const created = await putCalendarObject(deps.fetchImpl, deps.credentials, desiredHref, icsBody, {
          createOnly: true,
        });
        if (created.outcome === "created") {
          return { status: "synced", href: desiredHref, etag: created.etag };
        }
        const existing = await getCalendarObject(deps.fetchImpl, deps.credentials, desiredHref);
        if (!existing.exists) return { status: "retry_now" };
        const reconciled = await putCalendarObject(
          deps.fetchImpl,
          deps.credentials,
          desiredHref,
          icsBody,
          { ifMatch: existing.etag ?? undefined }
        );
        return reconciled.outcome === "precondition_failed"
          ? { status: "retry_now" }
          : { status: "synced", href: desiredHref, etag: reconciled.etag };
      }

      const updated = await putCalendarObject(deps.fetchImpl, deps.credentials, targetHref, icsBody, {
        ifMatch: knownEtag ?? undefined,
      });
      if (updated.outcome !== "precondition_failed") {
        return { status: "synced", href: targetHref, etag: updated.etag };
      }
      const fresh = await getCalendarObject(deps.fetchImpl, deps.credentials, targetHref);
      if (!fresh.exists) {
        const recreated = await putCalendarObject(deps.fetchImpl, deps.credentials, targetHref, icsBody, {
          createOnly: true,
        });
        return recreated.outcome === "created"
          ? { status: "synced", href: targetHref, etag: recreated.etag }
          : { status: "retry_now" };
      }
      const retryUpdate = await putCalendarObject(
        deps.fetchImpl,
        deps.credentials,
        targetHref,
        icsBody,
        { ifMatch: fresh.etag ?? undefined }
      );
      return retryUpdate.outcome === "precondition_failed"
        ? { status: "retry_now" }
        : { status: "synced", href: targetHref, etag: retryUpdate.etag };
    };

    const changingCalendars =
      row.caldav_href !== null &&
      row.synced_calendar_identity !== row.desired_calendar_identity;

    if (changingCalendars) {
      // Create/reconcile the replacement first, so a failed move cannot
      // leave staff with no upcoming event. If old-calendar cleanup then
      // fails, the row remains due and the next pass safely repeats both
      // idempotent operations.
      const replacement = await ensureDesiredResource(null, null);
      if (replacement.status === "retry_now") return replacement;

      const removed = await deleteWithFreshEtagRetry(row.caldav_href!, row.remote_etag);
      if (removed === "retry_now") return { status: "retry_now" };
      return {
        status: "synced",
        caldavHref: replacement.href,
        remoteEtag: replacement.etag,
      };
    }

    const ensured = await ensureDesiredResource(row.caldav_href, row.remote_etag);
    if (ensured.status === "retry_now") return ensured;
    return { status: "synced", caldavHref: ensured.href, remoteEtag: ensured.etag };
  } catch (error) {
    return { status: "failed", sanitizedError: sanitizeCalendarSyncError(error) };
  }
}

const BASE_BACKOFF_SECONDS = 30;
const MAX_BACKOFF_SECONDS = 30 * 60;

/** Exponential backoff with a cap — attemptCount is already incremented by claim_calendar_sync_batch(). */
export function computeNextAttemptDelaySeconds(attemptCount: number): number {
  const delay = BASE_BACKOFF_SECONDS * 2 ** Math.max(0, attemptCount - 1);
  return Math.min(delay, MAX_BACKOFF_SECONDS);
}

export interface ProcessBatchResult {
  claimed: number;
  synced: number;
  retried: number;
  failed: number;
}

/**
 * The one function both the eager after() hooks and the cron recovery
 * route call — claims a bounded batch via the lease-based RPC, reconciles
 * each row against CalDAV, and writes back conditionally so a row whose
 * desired state moved again while this was in flight is never
 * incorrectly marked synced (the actual guarantee behind "a stale worker
 * cannot permanently overwrite a newer cancellation").
 */
export async function processPendingCalendarSyncBatch(
  supabase: SupabaseClient<Database>,
  deps: ReconcileDependencies,
  limit: number
): Promise<ProcessBatchResult> {
  const result: ProcessBatchResult = { claimed: 0, synced: 0, retried: 0, failed: 0 };
  const claimToken = randomUUID();

  const { data: claimedRows, error: claimError } = await supabase.rpc("claim_calendar_sync_batch", {
    p_limit: limit,
    p_claimed_by: claimToken,
  });
  if (claimError) {
    throw new Error(`claim_calendar_sync_batch failed: ${sanitizeCalendarSyncError(claimError.message)}`);
  }
  const rows = claimedRows ?? [];
  result.claimed = rows.length;

  for (const row of rows) {
    const outcome = await reconcileOneLeg(row, deps);

    if (outcome.status === "synced") {
      // Conditional write-back: only marks synced if desired_version AND
      // desired_calendar_identity still match what we just reconciled
      // against. If either moved while we were mid-flight, this affects
      // zero rows — the row stays due, and the NEXT sweep picks up
      // whatever the newer desired state actually is.
      let query = supabase
        .from("calendar_sync_state")
        .update({
          synced_version: row.desired_version,
          synced_calendar_identity: row.desired_calendar_identity,
          caldav_href: outcome.caldavHref,
          remote_etag: outcome.remoteEtag,
          last_success_at: new Date().toISOString(),
          last_error: null,
          attempt_count: 0,
          next_attempt_at: new Date().toISOString(),
          claimed_at: null,
          claimed_by: null,
        })
        .eq("id", row.id)
        .eq("desired_version", row.desired_version);
      query =
        row.desired_calendar_identity === null
          ? query.is("desired_calendar_identity", null)
          : query.eq("desired_calendar_identity", row.desired_calendar_identity);
      const { data, error } = await query.eq("claimed_by", claimToken).select("id");
      if (error) {
        result.failed += 1;
      } else if (!data?.length) {
        // A booking change invalidated this claim while Apple was in
        // flight. The newer desired state is already due immediately.
        result.retried += 1;
      } else {
        result.synced += 1;
      }
    } else if (outcome.status === "retry_now") {
      const { error } = await supabase
        .from("calendar_sync_state")
        .update({ next_attempt_at: new Date().toISOString(), claimed_at: null, claimed_by: null })
        .eq("id", row.id)
        .eq("desired_version", row.desired_version)
        .eq("claimed_by", claimToken)
        .select("id");
      if (error) result.failed += 1;
      else result.retried += 1;
    } else {
      const delaySeconds = computeNextAttemptDelaySeconds(row.attempt_count);
      const { data, error } = await supabase
        .from("calendar_sync_state")
        .update({
          last_error: outcome.sanitizedError,
          next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
          claimed_at: null,
          claimed_by: null,
        })
        .eq("id", row.id)
        .eq("desired_version", row.desired_version)
        .eq("claimed_by", claimToken)
        .select("id");
      if (error) result.failed += 1;
      else if (!data?.length) result.retried += 1;
      else result.failed += 1;
      // Continue processing the rest of the batch — one booking's
      // failure must never block the others.
    }
  }

  return result;
}
