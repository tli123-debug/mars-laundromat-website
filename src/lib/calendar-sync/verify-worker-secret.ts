import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time bearer-secret check for the cron/recovery endpoint
 * (src/app/api/cron/calendar-sync/route.ts). A plain `===` comparison
 * short-circuits on the first mismatched byte, which leaks timing
 * information an attacker could use to guess the secret one byte at a
 * time; timingSafeEqual does not. Comparing lengths before calling it is
 * standard practice (timingSafeEqual throws on a length mismatch rather
 * than returning false) — leaking the LENGTH of a rejected guess is a far
 * smaller concern than leaking its content byte-by-byte, and is what
 * every common constant-time-comparison implementation already accepts.
 */
export function isAuthorizedCalendarSyncRequest(
  authorizationHeader: string | null,
  expectedSecret: string | undefined
): boolean {
  if (!authorizationHeader || !expectedSecret) return false;

  const prefix = "Bearer ";
  if (!authorizationHeader.startsWith(prefix)) return false;

  const provided = Buffer.from(authorizationHeader.slice(prefix.length), "utf8");
  const expected = Buffer.from(expectedSecret, "utf8");
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}
