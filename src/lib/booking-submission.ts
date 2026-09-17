import { z } from "zod";

/**
 * outcome values returned by the two SECURITY DEFINER database functions in
 * 20260917000000_booking_submission_idempotency.sql. Kept here as the one
 * place both createBooking() and its tests reference them, rather than
 * scattering the literal strings.
 */
export const FIND_RESULT_OUTCOMES = ["found_matching", "found_conflicting", "not_found"] as const;
export type FindResultOutcome = (typeof FIND_RESULT_OUTCOMES)[number];

export const SUBMIT_RESULT_OUTCOMES = ["created", "duplicate", "conflict"] as const;
export type SubmitResultOutcome = (typeof SUBMIT_RESULT_OUTCOMES)[number];

/**
 * Validates the actual shape of what find_existing_booking_submission()
 * returned before createBooking() ever destructures it — a malformed or
 * unexpected response (a client-library mismatch, a future signature
 * change on the database side) becomes an "uncertain" result, not a crash
 * from reading a property off undefined.
 *
 * A discriminated union, not a plain object with an independently-nullable
 * booking_id: the two are correlated by the database function's own
 * contract (found_matching/found_conflicting always carry the real
 * existing row's id; not_found always carries null) and a plain object
 * shape would silently accept an inconsistent pairing — e.g. "not_found"
 * with a real id, or "found_matching" with a null one — that could never
 * actually come from submit_booking() but also wouldn't be caught here.
 */
export const FindResultSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("found_matching"), booking_id: z.uuid() }),
  z.object({ outcome: z.literal("found_conflicting"), booking_id: z.uuid() }),
  z.object({ outcome: z.literal("not_found"), booking_id: z.null() }),
]);

export const SubmitResultSchema = z.object({
  booking_id: z.uuid(),
  outcome: z.enum(SUBMIT_RESULT_OUTCOMES),
});

/**
 * The exact, sole rule for when a fresh booking notification is sent: only
 * a genuinely new row (outcome "created"). Never for "duplicate" (the
 * original attempt already triggered one) or "conflict" (nothing new was
 * saved). Pulled out as its own function so this rule is directly
 * unit-testable without mocking Supabase or standing up a database.
 */
export function shouldNotifyForOutcome(outcome: SubmitResultOutcome): boolean {
  return outcome === "created";
}

export type ActionResult =
  | { status: "success"; bookingId: string; message: string }
  | { status: "conflict"; bookingId: string; message: string }
  | { status: "error"; message: string }
  | { status: "uncertain"; message: string };
