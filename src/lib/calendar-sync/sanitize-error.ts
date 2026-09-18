/**
 * Last-line defense before anything is written to
 * calendar_sync_state.last_error. The primary defense is upstream
 * discipline — caldav-client.ts/sync-worker.ts construct their own error
 * messages from known-safe components (an HTTP status code, an operation
 * name, a resource href) and never forward a raw response body or request
 * header into an error message in the first place, since a CalDAV
 * server's own error response could in principle echo back request
 * content. This function still strips anything that looks like a
 * credential regardless, and bounds the length, in case a lower-level
 * library (fetch, tsdav) ever throws something this app didn't construct
 * itself.
 */
const REDACTION_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  // The whole rest of the line, not just one token after the colon — an
  // earlier version of this pattern only consumed "Basic"/"Bearer" itself
  // and left the actual credential that follows it untouched.
  { pattern: /authorization:.*/gi, replacement: "authorization: [redacted]" },
  { pattern: /\bbasic\s+[a-z0-9+/=]{8,}/gi, replacement: "Basic [redacted]" },
  { pattern: /\bbearer\s+\S+/gi, replacement: "Bearer [redacted]" },
  // Apple app-specific passwords are always exactly four lowercase
  // four-letter groups separated by hyphens (xxxx-xxxx-xxxx-xxxx).
  { pattern: /\b[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}\b/gi, replacement: "[redacted-app-password]" },
];

const MAX_LENGTH = 500;

export function sanitizeCalendarSyncError(input: unknown): string {
  let text = input instanceof Error ? input.message : String(input);
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  if (text.length > MAX_LENGTH) {
    text = `${text.slice(0, MAX_LENGTH)}…`;
  }
  return text;
}
