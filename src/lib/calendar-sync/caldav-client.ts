/**
 * A thin, directly-mockable CalDAV transport for the one thing the sync
 * worker actually needs at its hot path: PUT/GET/DELETE a single known
 * calendar object by href, with conditional headers. This deliberately
 * does NOT wrap tsdav's own higher-level DAVClient here — tsdav is used
 * only for CalDAV discovery (scripts/discover-caldav-calendars.ts), a
 * one-time manual setup step where its richer XML/WebDAV handling earns
 * its keep. For the worker's own per-event CRUD, a plain injected `fetch`
 * gives exact control over If-Match/If-None-Match and status-code
 * branching, and — the actual reason it matters — can be swapped for a
 * deterministic fake in tests without any live Apple credentials or a
 * real HTTP server, satisfying the requirement that the normal test suite
 * never needs live CalDAV access.
 */
export interface CalDavFetch {
  (url: string, init: RequestInit): Promise<Response>;
}

export interface CalDavCredentials {
  username: string;
  appPassword: string;
}

// A recovery invocation must never hang until the hosting platform kills
// it. Five seconds is generous for a single small CalDAV object request
// while still leaving time for the worker to record a retry and continue.
export const CALDAV_REQUEST_TIMEOUT_MS = 5_000;

function fetchCalDav(fetchImpl: CalDavFetch, url: string, init: RequestInit): Promise<Response> {
  return fetchImpl(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(CALDAV_REQUEST_TIMEOUT_MS),
  });
}

export class CalDavError extends Error {
  readonly status: number;
  readonly operation: string;
  constructor(operation: string, status: number) {
    // Deliberately built from known-safe components only (an operation
    // name this module chose, and a numeric status code) — never from a
    // response body, which could in principle echo back request content.
    super(`${operation} failed with status ${status}`);
    this.name = "CalDavError";
    this.operation = operation;
    this.status = status;
  }
}

function basicAuthHeader(credentials: CalDavCredentials): string {
  const token = Buffer.from(`${credentials.username}:${credentials.appPassword}`, "utf8").toString(
    "base64"
  );
  return `Basic ${token}`;
}

/** `{calendarCollectionUrl}/{uid}.ics` — deterministic, stable, no live discovery needed per write. */
export function resourceHrefForUid(calendarCollectionUrl: string, uid: string): string {
  const base = calendarCollectionUrl.endsWith("/") ? calendarCollectionUrl : `${calendarCollectionUrl}/`;
  return `${base}${uid}.ics`;
}

export type PutOutcome =
  | { outcome: "created"; etag: string | null }
  | { outcome: "updated"; etag: string | null }
  | { outcome: "precondition_failed" };

/**
 * createOnly uses If-None-Match: * (refuse if the resource already
 * exists — guards a first-time create against having somehow already
 * been created by a prior attempt this row lost track of). Otherwise,
 * ifMatch (when provided) uses If-Match so a stale worker's write is
 * rejected by Apple itself if the resource changed since this worker
 * last knew about it — the actual mechanism (not just the database's own
 * version number) that prevents an old delayed reschedule from
 * overwriting a newer cancellation. 409 is treated the same as 412: both
 * mean "the write was rejected because of the resource's current state,"
 * and the caller's response is identical either way (re-read and
 * reconcile from the latest desired state, per Apple CalDAV's REPORT/GET
 * conditional-request semantics).
 */
export async function putCalendarObject(
  fetchImpl: CalDavFetch,
  credentials: CalDavCredentials,
  href: string,
  icsBody: string,
  options: { createOnly?: boolean; ifMatch?: string } = {}
): Promise<PutOutcome> {
  const headers: Record<string, string> = {
    Authorization: basicAuthHeader(credentials),
    "Content-Type": "text/calendar; charset=utf-8",
  };
  if (options.createOnly) {
    headers["If-None-Match"] = "*";
  } else if (options.ifMatch) {
    headers["If-Match"] = options.ifMatch;
  }

  const response = await fetchCalDav(fetchImpl, href, { method: "PUT", headers, body: icsBody });

  if (response.status === 412 || response.status === 409) {
    return { outcome: "precondition_failed" };
  }
  if (!response.ok) {
    throw new CalDavError(`PUT ${href}`, response.status);
  }
  const etag = response.headers.get("ETag");
  return response.status === 201 ? { outcome: "created", etag } : { outcome: "updated", etag };
}

export type DeleteOutcome = "deleted" | "already_absent" | "precondition_failed";

/**
 * A 404 on delete is success, not an error — the desired end state ("no
 * event exists") is already achieved regardless of what actually removed
 * it, which also covers the case where an earlier delete succeeded at
 * Apple but this row's own database write-back failed or lost a race.
 */
export async function deleteCalendarObject(
  fetchImpl: CalDavFetch,
  credentials: CalDavCredentials,
  href: string,
  ifMatch?: string
): Promise<DeleteOutcome> {
  const headers: Record<string, string> = { Authorization: basicAuthHeader(credentials) };
  if (ifMatch) headers["If-Match"] = ifMatch;

  const response = await fetchCalDav(fetchImpl, href, { method: "DELETE", headers });

  if (response.status === 404) return "already_absent";
  if (response.status === 412 || response.status === 409) return "precondition_failed";
  if (!response.ok) {
    throw new CalDavError(`DELETE ${href}`, response.status);
  }
  return "deleted";
}

export interface GetOutcome {
  exists: boolean;
  etag: string | null;
}

/** Used to re-read a resource's current ETag after a 412, before retrying with fresh state. */
export async function getCalendarObject(
  fetchImpl: CalDavFetch,
  credentials: CalDavCredentials,
  href: string
): Promise<GetOutcome> {
  const response = await fetchCalDav(fetchImpl, href, {
    method: "GET",
    headers: { Authorization: basicAuthHeader(credentials) },
  });

  if (response.status === 404) return { exists: false, etag: null };
  if (!response.ok) {
    throw new CalDavError(`GET ${href}`, response.status);
  }
  return { exists: true, etag: response.headers.get("ETag") };
}
