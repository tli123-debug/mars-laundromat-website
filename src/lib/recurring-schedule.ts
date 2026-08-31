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
