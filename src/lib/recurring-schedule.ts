/**
 * Pure domain logic for Recurring Pickup System V1 — no UI, no database.
 * Deliberately narrow, matching the locked V1 rules: Wash & Fold only,
 * Standard speed only, weekly or every-two-weeks, a fixed pickup
 * day/window and fixed next-day delivery window that must still clear the
 * existing Standard/Flexible 22-hour-after-pickup-end gap
 * (getStandardFlexibleDeliveryWindows in booking-hours.ts). This module
 * reuses that existing date/window machinery rather than reimplementing
 * it — there is exactly one scheduling engine in this codebase.
 *
 * generate_due_recurring_bookings() (the dormant SQL function — see
 * supabase/migrations/20260830000000_recurring_pickups_v1.sql) implements
 * its own stale-date advancement loop in PL/pgSQL, since it runs inside
 * the database on a cron trigger with no access to this module. That
 * loop's algorithm is deliberately identical to advanceToDueDate() below
 * — see the comment on that function — so the two can't silently drift
 * even though they can't literally share code across the JS/SQL boundary.
 */

import {
  addDays,
  getBrooklynToday,
  getStandardFlexibleDeliveryWindows,
  getWindowsForDate,
  normalizeStoredTime,
} from "@/lib/booking-hours";
import { serviceTypeIncludesWashAndFold } from "@/lib/service-type";
import type {
  BookingStatus,
  RecurringFrequency,
  RecurringScheduleStatus,
  ServiceType,
} from "@/types/database.types";

const RECURRING_FREQUENCIES: readonly RecurringFrequency[] = ["weekly", "every_two_weeks"];

export function isValidRecurringFrequency(value: string): value is RecurringFrequency {
  return (RECURRING_FREQUENCIES as readonly string[]).includes(value);
}

/** Exactly 7 for weekly, 14 for every_two_weeks — the two only valid cadences in V1. */
export function cadenceDays(frequency: RecurringFrequency): 7 | 14 {
  return frequency === "weekly" ? 7 : 14;
}

/** One cadence step forward from `date`, DST-safe via booking-hours.ts's addDays. */
export function advanceByCadence(date: string, frequency: RecurringFrequency): string {
  return addDays(date, cadenceDays(frequency));
}

/**
 * Advances a stale `date` forward along `frequency`'s cadence until it
 * reaches the first occurrence that is `asOfDate` or later. Mirrors
 * generate_due_recurring_bookings()'s own advancement loop exactly — both
 * only ever move the date pointer forward and never enumerate, return, or
 * otherwise create the intermediate occurrences they step past, so
 * calling this can never backfill a missed historical booking. Used by
 * Resume (advance a paused schedule's stale date before reactivating) and
 * by the dormant generator's own equivalent SQL loop.
 */
export function advanceToDueDate(date: string, frequency: RecurringFrequency, asOfDate: string): string {
  let result = date;
  while (result < asOfDate) {
    result = advanceByCadence(result, frequency);
  }
  return result;
}

/** Recurring V1's delivery date is always exactly the calendar day after pickup — no exceptions. */
export function nextDayDeliveryDate(pickupDate: string): string {
  return addDays(pickupDate, 1);
}

export interface RecurringWindowInput {
  pickupDate: string;
  pickupTime: string;
  deliveryDate: string;
  deliveryTime: string;
}

/**
 * First problem found with a proposed recurring pickup/delivery window
 * pair, or null if it's valid — same "first issue or null" convention as
 * validatePreferredTimeForServiceType/validateProposedTime in
 * time-proposal-validation.ts. Enforces, in order: the pickup date isn't
 * in the past, the pickup time is a real store window, delivery is
 * exactly the next calendar day (never same-day, never pickup+2 — V1 has
 * no Flexible option), and the delivery time clears the existing
 * Standard/Flexible 22-hour-after-pickup-end gap via the same
 * getStandardFlexibleDeliveryWindows() every other Standard booking in
 * this app is validated against. Like validatePreferredTimeForServiceType()
 * in time-proposal-validation.ts, this deliberately does not accept an
 * injectable `now` — it relies on real current time, matching the Server
 * Action that calls it (Checkpoint 2), and every test below anchors its
 * pickup date safely far in the future rather than faking "now".
 */
export function validateRecurringWindows(input: RecurringWindowInput): string | null {
  const today = getBrooklynToday();
  if (input.pickupDate < today) {
    return "The first pickup date can't be in the past.";
  }

  const normalizedPickupTime = normalizeStoredTime(input.pickupTime);
  const pickupWindowValues = new Set(getWindowsForDate(input.pickupDate).map((w) => w.value));
  if (!normalizedPickupTime || !pickupWindowValues.has(normalizedPickupTime)) {
    return "The pickup time isn't a valid store window.";
  }

  const expectedDeliveryDate = nextDayDeliveryDate(input.pickupDate);
  if (input.deliveryDate !== expectedDeliveryDate) {
    return "Recurring delivery must be exactly the next calendar day after pickup.";
  }

  const normalizedDeliveryTime = normalizeStoredTime(input.deliveryTime);
  const validDeliveryTimes = new Set(
    getStandardFlexibleDeliveryWindows(input.pickupDate, input.pickupTime, input.deliveryDate).map(
      (w) => w.value
    )
  );
  if (!normalizedDeliveryTime || !validDeliveryTimes.has(normalizedDeliveryTime)) {
    return "The delivery time doesn't allow the required gap after pickup.";
  }

  return null;
}

/**
 * Canonical form for matching two customers' phone numbers regardless of
 * formatting — strips everything but digits, then drops a leading "1" US
 * country-code digit so "7185550134", "(718) 555-0134",
 * "+1 718-555-0134", and "1-718-555-0134" all normalize identically. This
 * is distinct from bookingPhoneHref()/bookingSmsHref() in
 * booking-links.ts, which strip formatting only to build a tel:/sms: URI
 * and are never used for equality matching. Deliberately lenient — this
 * exists to catch duplicate recurring-schedule enrollment, not to
 * validate that a phone number is well-formed (bookingSchema's own phone
 * field already does that at submission time).
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

/**
 * Canonical form for matching two customers' addresses regardless of
 * whitespace/case — trim + lowercase, exactly matching the SQL expression
 * recurring_schedules_active_customer_unique_idx uses (lower(btrim(address)))
 * in supabase/migrations/20260830000000_recurring_pickups_v1.sql, so the
 * Server Action's pre-check can give a friendly "already enrolled" error
 * for the same pairs the database's own constraint would reject, before
 * ever reaching it.
 */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * The four bilingual badge states a recurring-linked booking or schedule
 * can show. "weekly"/"every_two_weeks" reuse RecurringFrequency's own
 * values directly (an active schedule's badge kind IS its frequency) so
 * there's only one place either spelling is ever written.
 */
export type RecurringBadgeKind = RecurringFrequency | "paused" | "cancelled";

/**
 * Record<RecurringBadgeKind, string> — exhaustive by construction, so a
 * future RecurringBadgeKind value without a label is a compile error, not
 * a silently blank badge.
 */
export const RECURRING_BADGE_LABELS: Record<RecurringBadgeKind, string> = {
  weekly: "Recurring: Weekly 定期：每周",
  every_two_weeks: "Recurring: Every 2 Weeks 定期：每两周",
  paused: "Recurring Paused 定期服务已暂停",
  cancelled: "Recurring Cancelled 定期服务已取消",
};

/** Which badge a schedule's current (status, frequency) pair should show. */
export function recurringBadgeKind(
  status: RecurringScheduleStatus,
  frequency: RecurringFrequency
): RecurringBadgeKind {
  return status === "active" ? frequency : status;
}

/**
 * Resume's own version of catching up a stale next_pickup_date. First
 * applies the same date-only stale-catchup advanceToDueDate() does, then
 * additionally checks whether the RESULT lands on today with a pickup
 * window that has already started or passed in Brooklyn time — e.g.
 * resuming a 9:00-10:00 AM schedule at 5:00 PM today. If so, advances one
 * more cadence step, since that window can no longer actually happen
 * today. A genuine future date is returned untouched (the window check
 * only ever applies to today), and a window that's still upcoming later
 * today is left alone — "a currently available window today may remain
 * today." Reuses getWindowsForDate()'s own excludePast filtering (the
 * exact same logic the public form and every other window check in this
 * app already relies on) rather than re-deriving minute arithmetic here.
 */
export function advanceToNextAvailablePickup(
  date: string,
  frequency: RecurringFrequency,
  pickupTime: string,
  now: Date = new Date()
): string {
  const today = getBrooklynToday(now);
  const dateCaughtUp = advanceToDueDate(date, frequency, today);

  if (dateCaughtUp !== today) {
    return dateCaughtUp;
  }

  const normalizedPickupTime = normalizeStoredTime(pickupTime);
  const stillAvailableToday =
    normalizedPickupTime !== null &&
    getWindowsForDate(today, { now }).some((w) => w.value === normalizedPickupTime);

  return stillAvailableToday ? dateCaughtUp : advanceByCadence(dateCaughtUp, frequency);
}

/**
 * The exact, unconditional update payload for cancelling a schedule —
 * unconditional on purpose, matching buildServiceTypeChangePayload()'s
 * pattern in service-type.ts: the Server Action's own status check is the
 * gate, this just builds what to write once it's decided to proceed.
 * paused_at is explicitly nulled regardless of whether the schedule was
 * active or paused beforehand — recurring_schedules_status_timestamps_check
 * requires (status = 'paused') = (paused_at is not null), so a schedule
 * cancelled FROM paused would otherwise still carry a non-null paused_at
 * and be rejected by that constraint. `now` is injectable for deterministic
 * tests, matching every other "now"-dependent function in this codebase.
 */
export function buildCancelSchedulePayload(userId: string, now: Date = new Date()) {
  return {
    status: "cancelled" as const,
    cancelled_at: now.toISOString(),
    paused_at: null,
    updated_by: userId,
  };
}

/**
 * The three possible outcomes of Skip Next, given the earliest still-due,
 * non-cancelled generated booking (if any) for the schedule — see
 * decideSkipNextOccurrence()'s own doc comment for what "still-due" means
 * and why occurrenceDate can equal, but never exceed, nextPickupDate.
 */
export type SkipOutcome =
  | { action: "advance_only" }
  | { action: "cancel_only"; bookingId: string }
  | { action: "cancel_and_advance"; bookingId: string }
  | { action: "rejected"; reason: string };

export interface UpcomingRecurringBooking {
  id: string;
  status: BookingStatus;
  occurrenceDate: string;
}

/**
 * Pure decision logic for Skip Next, separated from its Server Action
 * (skipNextOccurrence in src/app/admin/(dashboard)/recurring/actions.ts)
 * so every outcome is independently testable without a database.
 *
 * The critical fact this depends on: generate_due_recurring_bookings()
 * (the SQL generator) advances next_pickup_date to the FOLLOWING
 * occurrence the instant it creates a booking — so by the time a booking
 * actually exists, nextPickupDate no longer points at it, it points PAST
 * it. The Server Action is responsible for finding that booking (the
 * earliest non-cancelled generated booking dated today-or-later and no
 * later than nextPickupDate) and passing it here; this function only
 * decides what to do once it's found:
 *
 * - No such booking: nothing has been generated yet for the upcoming
 *   occurrence — just advance nextPickupDate by one cadence step.
 * - Found, status 'pending', dated STRICTLY BEFORE nextPickupDate (the
 *   normal case — the generator already advanced the pointer past it):
 *   cancel the booking only. The pointer already reflects "next
 *   occurrence after this one," so it must NOT be advanced again.
 * - Found, status 'pending', dated EXACTLY EQUAL to nextPickupDate (a
 *   defensive edge case — the pointer has NOT yet been advanced past
 *   this occurrence, which shouldn't normally happen but is handled
 *   anyway): cancel the booking AND advance the pointer, since nothing
 *   else already did.
 * - Found, any other status (confirmed, picked_up, ready_for_delivery,
 *   completed — "progressed beyond pending"): reject outright. Skip Next
 *   never overrides real, in-progress work.
 *
 * A booking whose status is already 'cancelled' is never passed in here
 * at all — the Server Action's own lookup excludes it, since an
 * already-cancelled occurrence has, by definition, already been skipped;
 * that case surfaces as "no such booking" (advance_only) instead.
 */
export function decideSkipNextOccurrence(
  nextPickupDate: string,
  upcomingBooking: UpcomingRecurringBooking | null
): SkipOutcome {
  if (!upcomingBooking) {
    return { action: "advance_only" };
  }
  if (upcomingBooking.status !== "pending") {
    return {
      action: "rejected",
      reason: "This occurrence has already progressed past pending — handle that booking directly instead of skipping it.",
    };
  }
  if (upcomingBooking.occurrenceDate < nextPickupDate) {
    return { action: "cancel_only", bookingId: upcomingBooking.id };
  }
  // occurrenceDate === nextPickupDate — the caller's query never returns
  // a later date (it's bounded by nextPickupDate), and never an earlier
  // one that isn't < (there is no other case left).
  return { action: "cancel_and_advance", bookingId: upcomingBooking.id };
}

/**
 * Whether a completed booking may be offered recurring Wash & Fold —
 * "Text Thank You & Recurring Offer" should only ever appear when all
 * three hold: the booking has actually finished (status completed), it
 * included Wash & Fold (wash_and_fold or both — a Both order still offers
 * recurring Wash & Fold, per the locked V1 rule that recurrence never
 * covers Dry Cleaning), and this exact customer doesn't already have a
 * live schedule. `hasActiveOrPausedSchedule` is supplied by the caller —
 * this module has no database access, so the actual lookup by normalized
 * phone + normalized address happens in the Server Action that calls this
 * (Checkpoint 2), which then passes in a plain boolean.
 */
export function isEligibleForRecurringOffer(
  booking: { status: BookingStatus; service_type: ServiceType },
  hasActiveOrPausedSchedule: boolean
): boolean {
  return (
    booking.status === "completed" &&
    serviceTypeIncludesWashAndFold(booking.service_type) &&
    !hasActiveOrPausedSchedule
  );
}
