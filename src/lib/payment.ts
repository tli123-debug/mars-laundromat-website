import type { PaymentMethod } from "@/types/database.types";

/**
 * Marking paid requires a method in the same atomic write — paid, method,
 * timestamp, and verifier all land together so there's never a state with
 * paid=true and no record of how/when/who.
 */
export function buildMarkPaidPayload(method: PaymentMethod, userId: string, now: Date = new Date()) {
  return {
    paid: true,
    payment_method: method,
    paid_at: now.toISOString(),
    payment_verified_by: userId,
    updated_by: userId,
  };
}

/**
 * Marking unpaid is a correction, not a preserved history — there's no
 * payment-event table, so leaving stale method/timestamp/verifier fields
 * behind would just be wrong data, not an audit trail. All three clear back
 * to null in the same atomic write as paid=false.
 */
export function buildMarkUnpaidPayload(userId: string) {
  return {
    paid: false,
    payment_method: null,
    paid_at: null,
    payment_verified_by: null,
    updated_by: userId,
  };
}
