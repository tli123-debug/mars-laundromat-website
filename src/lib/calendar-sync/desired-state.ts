import type { BookingSource, BookingStatus } from "@/types/database.types";

export type BookingLegDisposition = "absent" | "active" | "historical";
export type BookingLeg = "pickup" | "delivery";

/**
 * A pure TypeScript mirror of the SQL trigger logic in
 * 20260919000000_calendar_sync_outbox.sql (set_calendar_sync_eligibility(),
 * sync_calendar_outbox_for_booking()) — the SQL is authoritative (it runs
 * atomically with the booking write itself, which is a hard requirement
 * here, not just a convenience), but mirroring the rule in TS lets it be
 * unit-tested directly and fast, without a live Postgres instance. Same
 * relationship this codebase already has between
 * generate_due_recurring_bookings() and src/lib/recurring-schedule.ts.
 *
 * Keep both sides in sync by hand if this rule ever changes.
 */

/**
 * Durable eligibility, computed ONCE at insert time from booking_source
 * and whatever calendar_sync_config said AT THAT MOMENT. This is what
 * makes a pre-launch booking permanently ineligible (its createdAt will
 * always be before launchedAt, forever, regardless of any later edit) and
 * a post-launch website booking permanently eligible (nothing recomputes
 * this later). booking_source === 'website' alone already excludes phone
 * bookings and generated recurring occurrences — BookingSource is exactly
 * 'website' | 'phone' | 'recurring'.
 */
export function computeDurableCalendarEligibility(input: {
  bookingSource: BookingSource;
  createdAt: Date;
  launchedAt: Date | null;
}): boolean {
  return (
    input.bookingSource === "website" &&
    input.launchedAt !== null &&
    input.createdAt >= input.launchedAt
  );
}

/**
 * The final, runtime "does this booking belong on the calendar at all"
 * check — the durable eligibility bit, ANDed with the mutable staff
 * exclusion override. `calendar_sync_config.enabled` pauses worker claims;
 * it deliberately does not turn desired events into deletions.
 */
export function isCalendarWorthy(input: {
  calendarSyncEligible: boolean;
  calendarSyncExcluded: boolean;
}): boolean {
  return input.calendarSyncEligible && !input.calendarSyncExcluded;
}

/**
 * Whether `leg` has durably happened, given the booking's CURRENT status
 * and whatever was already recorded as fulfilled before. Once true, a
 * leg is never computed back to false — the caller is responsible for
 * carrying `previouslyFulfilled` forward from the existing outbox row,
 * not recomputing it from scratch, which is exactly what makes a later
 * unrelated edit to an already-cancelled booking safe (see
 * computeLegDisposition's own docs).
 */
export function computeLegFulfilled(
  leg: BookingLeg,
  status: BookingStatus,
  previouslyFulfilled: boolean
): boolean {
  if (previouslyFulfilled) return true;
  if (leg === "pickup") {
    // Exactly STATUSES_REQUIRING_CONFIRMED_SCHEDULE
    // (src/lib/time-proposal-validation.ts) minus 'confirmed' itself —
    // the statuses only reachable once pickup has actually happened.
    return status === "picked_up" || status === "ready_for_delivery" || status === "completed";
  }
  return status === "completed";
}

/**
 * The actual disposition rule. `fulfilled` must be the value FROM
 * computeLegFulfilled — this function never re-derives fulfillment
 * itself, deliberately, so the "durable, not re-inferred from a status
 * diff" property is enforced by the caller's data flow, not by a comment.
 *
 * Precedence for 'cancelled': a leg that already happened (fulfilled)
 * stays historical even after cancellation — cancelling an order after
 * pickup but before delivery must preserve the pickup and remove the
 * future delivery, not erase both. A leg that never happened is removed.
 *
 * 'pending' is always absent regardless of confirmed_*: those fields can
 * hold a staff proposal awaiting the customer's agreement while status
 * stays 'pending' (approveRequestedTime/saveProposedTime in
 * bookings/[id]/actions.ts don't always flip status immediately), and a
 * mere proposal is not a confirmed appointment.
 */
export function computeLegDisposition(params: {
  status: BookingStatus;
  confirmedDate: string | null;
  confirmedTime: string | null;
  fulfilled: boolean;
}): BookingLegDisposition {
  if (params.status === "cancelled") {
    return params.fulfilled ? "historical" : "absent";
  }
  if (params.status === "pending") {
    return "absent";
  }
  // confirmed / picked_up / ready_for_delivery / completed.
  if (!params.confirmedDate || !params.confirmedTime) {
    return "absent";
  }
  return params.fulfilled ? "historical" : "active";
}

/** Whether an outbox row needs reconciliation — an OR, deliberately never an AND. */
export function needsReconciliation(row: {
  desiredVersion: number;
  syncedVersion: number | null;
  desiredCalendarIdentity: string | null;
  syncedCalendarIdentity: string | null;
}): boolean {
  return (
    row.desiredVersion !== row.syncedVersion ||
    row.desiredCalendarIdentity !== row.syncedCalendarIdentity
  );
}
