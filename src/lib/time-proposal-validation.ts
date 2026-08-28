import {
  getSameDayEligibleWindows,
  getStandardFlexibleDeliveryWindows,
  getWindowsForDate,
  normalizeStoredTime,
  SAME_DAY_DELIVERY_WINDOW_START,
  WINDOW_DURATION_MINUTES,
  addDays,
} from "@/lib/booking-hours";
import { isValidDryCleaningDeliveryDate } from "@/lib/dry-cleaning-schedule";
import type { BookingStatus, ServiceSpeed, ServiceType } from "@/types/database.types";

function timeValueToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export interface ProposedTimeInput {
  confirmedPickupDate: string;
  confirmedPickupTime: string;
  confirmedDeliveryDate: string;
  confirmedDeliveryTime: string;
}

/**
 * Whether `time` is actually one of the store's real windows for `date` —
 * the client dropdown only ever offers valid values, but a Server Action
 * can't trust that; it must re-check the same source of truth itself.
 * excludePast: false because staff may legitimately be backfilling an
 * earlier-today or past-dated correction, not just booking ahead.
 *
 * `time` is normalized before comparing since it may come straight from
 * the database — a Postgres `time` column can serialize via PostgREST as
 * either "HH:MM" or "HH:MM:SS", while generated window values are always
 * "HH:MM". A malformed value normalizes to null and correctly matches
 * nothing.
 */
export function isValidStoreWindow(date: string, time: string): boolean {
  const normalized = normalizeStoredTime(time);
  if (!normalized) return false;
  return getWindowsForDate(date, { excludePast: false }).some((w) => w.value === normalized);
}

/**
 * On a later date, delivery is always fine. On the same date, delivery must
 * start at least one full window after pickup begins — same or overlapping
 * windows (e.g. 10:00 pickup, 10:30 delivery) are rejected, since the item
 * can't be dropped back off before that window's pickup is even done.
 */
export function isDeliveryNotBeforePickup(input: ProposedTimeInput): boolean {
  const { confirmedPickupDate, confirmedPickupTime, confirmedDeliveryDate, confirmedDeliveryTime } = input;
  if (confirmedDeliveryDate !== confirmedPickupDate) {
    return confirmedDeliveryDate > confirmedPickupDate;
  }
  const pickupMinutes = timeValueToMinutes(confirmedPickupTime);
  const deliveryMinutes = timeValueToMinutes(confirmedDeliveryTime);
  return deliveryMinutes >= pickupMinutes + WINDOW_DURATION_MINUTES;
}

/** First problem found with a manually-entered proposed/corrected time, or null if it's valid. */
export function validateProposedTime(input: ProposedTimeInput): string | null {
  if (!isValidStoreWindow(input.confirmedPickupDate, input.confirmedPickupTime)) {
    return "That pickup time isn't a valid store window.";
  }
  if (!isValidStoreWindow(input.confirmedDeliveryDate, input.confirmedDeliveryTime)) {
    return "That delivery time isn't a valid store window.";
  }
  if (!isDeliveryNotBeforePickup(input)) {
    return "Delivery time can't be before the pickup time.";
  }
  return null;
}

export interface PreferredTimeInput {
  pickupDate: string;
  pickupTime: string;
  deliveryDate: string;
  deliveryTime: string;
}

/**
 * Whether a booking's STORED customer request (preferred_*) still
 * satisfies its service-specific public-form rule, re-derived from
 * service_type/service_speed fetched fresh — exactly the rules
 * bookingSchema's superRefine enforces on a live submission
 * (validations/booking-schema.ts), applied again here because a request
 * saved before a scheduling rule changed (e.g. a legacy pickup+3 Dry
 * Cleaning request, or a pre-22-hour-gap Standard request) can't be
 * blindly trusted just because it passed validation once, long ago.
 *
 * Used only by approveRequestedTime(), which otherwise just copies
 * preferred_* into confirmed_* verbatim. The manual proposed-time editor
 * below is deliberately NOT built on this function — it keeps its own
 * broader staff discretion (isValidStoreWindow + isDeliveryNotBeforePickup,
 * any date at or after pickup), so a legacy or exceptional request is
 * still confirmable by hand even when this stricter check rejects it.
 */
export function validatePreferredTimeForServiceType(
  serviceType: ServiceType,
  serviceSpeed: ServiceSpeed,
  input: PreferredTimeInput
): string | null {
  if (!isValidStoreWindow(input.pickupDate, input.pickupTime)) {
    return "The requested pickup time isn't a valid store window.";
  }

  if (serviceType === "dry_cleaning" || serviceType === "both") {
    if (!isValidDryCleaningDeliveryDate(input.pickupDate, input.deliveryDate)) {
      return "The requested delivery date isn't the fourth calendar day after pickup.";
    }
    if (!isValidStoreWindow(input.deliveryDate, input.deliveryTime)) {
      return "The requested delivery time isn't a valid store window.";
    }
    return null;
  }

  if (serviceSpeed === "same_day") {
    // input.pickupTime was already confirmed a valid store window above,
    // but "valid store window" and "Same-Day eligible" are different sets
    // — re-normalize here too since eligiblePickupTimes holds generated
    // "HH:MM" values and input.pickupTime may still carry seconds.
    const normalizedPickupTime = normalizeStoredTime(input.pickupTime);
    const eligiblePickupTimes = new Set(
      getSameDayEligibleWindows(input.pickupDate).map((w) => w.value)
    );
    if (!normalizedPickupTime || !eligiblePickupTimes.has(normalizedPickupTime)) {
      return "The requested pickup time is no longer Same-Day eligible.";
    }
    const normalizedDeliveryTime = normalizeStoredTime(input.deliveryTime);
    if (input.deliveryDate !== input.pickupDate || normalizedDeliveryTime !== SAME_DAY_DELIVERY_WINDOW_START) {
      return "The requested Same-Day delivery no longer matches the fixed 6:00–7:00 PM window.";
    }
    return null;
  }

  // Standard / Flexible.
  const minDeliveryDate = addDays(input.pickupDate, 1);
  const maxDeliveryDate = serviceSpeed === "flexible" ? addDays(input.pickupDate, 2) : minDeliveryDate;
  if (input.deliveryDate < minDeliveryDate || input.deliveryDate > maxDeliveryDate) {
    return "The requested delivery date is outside the valid range for this service speed.";
  }
  // getStandardFlexibleDeliveryWindows() normalizes input.pickupTime
  // internally (via valueToMinutes), but its returned .value entries are
  // always generated "HH:MM" — input.deliveryTime still needs its own
  // normalization before comparing against them.
  const normalizedDeliveryTime = normalizeStoredTime(input.deliveryTime);
  const validDeliveryTimes = new Set(
    getStandardFlexibleDeliveryWindows(input.pickupDate, input.pickupTime, input.deliveryDate).map(
      (w) => w.value
    )
  );
  if (!normalizedDeliveryTime || !validDeliveryTimes.has(normalizedDeliveryTime)) {
    return "The requested delivery time doesn't allow the required gap after pickup.";
  }
  return null;
}

/**
 * "Mark Times Confirmed" means the customer accepted a complete proposal —
 * pickup AND delivery both set, not just pickup. A partial state shouldn't
 * be markable as confirmed even though it isn't reachable through the
 * current actions (which always write all four fields together or none).
 */
export function hasCompleteProposedTime(booking: {
  confirmed_pickup_date: string | null;
  confirmed_pickup_time: string | null;
  confirmed_delivery_date: string | null;
  confirmed_delivery_time: string | null;
}): boolean {
  return Boolean(
    booking.confirmed_pickup_date &&
      booking.confirmed_pickup_time &&
      booking.confirmed_delivery_date &&
      booking.confirmed_delivery_time
  );
}

/**
 * Whether time-negotiation actions may still move `status`. The
 * pending<->confirmed flip belongs to the initial "are we on for this
 * pickup?" negotiation; once a booking has physically progressed to
 * picked_up or later, time edits must never move status backward — that
 * would vanish it from the Today board's At Store section and wrongly
 * resurface it under Pending Review.
 */
export function isPreLifecycle(status: BookingStatus): boolean {
  return status === "pending" || status === "confirmed";
}

export function buildApproveTimePayload(
  preferred: { pickupDate: string; pickupTime: string; deliveryDate: string; deliveryTime: string },
  currentStatus: BookingStatus,
  userId: string
) {
  return {
    confirmed_pickup_date: preferred.pickupDate,
    confirmed_pickup_time: preferred.pickupTime,
    confirmed_delivery_date: preferred.deliveryDate,
    confirmed_delivery_time: preferred.deliveryTime,
    ...(isPreLifecycle(currentStatus) ? { status: "confirmed" as const } : {}),
    updated_by: userId,
  };
}

export function buildSaveProposedTimePayload(
  input: ProposedTimeInput,
  currentStatus: BookingStatus,
  userId: string
) {
  return {
    confirmed_pickup_date: input.confirmedPickupDate,
    confirmed_pickup_time: input.confirmedPickupTime,
    confirmed_delivery_date: input.confirmedDeliveryDate,
    confirmed_delivery_time: input.confirmedDeliveryTime,
    ...(isPreLifecycle(currentStatus) ? { status: "pending" as const } : {}),
    updated_by: userId,
  };
}

export function buildClearProposedTimePayload(currentStatus: BookingStatus, userId: string) {
  return {
    confirmed_pickup_date: null,
    confirmed_pickup_time: null,
    confirmed_delivery_date: null,
    confirmed_delivery_time: null,
    ...(isPreLifecycle(currentStatus) ? { status: "pending" as const } : {}),
    updated_by: userId,
  };
}
