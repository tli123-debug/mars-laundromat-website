import type { BookingStatus, ServiceSpeed, ServiceType } from "@/types/database.types";

/**
 * Bilingual, staff-facing labels — shared by the admin service-type badge
 * and the service-type correction control so both always agree on wording.
 * Separate from the internal notification email's own English-only labels
 * (src/emails/new-booking-notification.tsx), which serve a different
 * audience and are deliberately not shared with this admin-facing set.
 */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  wash_and_fold: "Wash & Fold 洗烘折",
  dry_cleaning: "Dry Cleaning & Ironing 干洗及熨烫",
  both: "Both Services 两种服务",
};

/** Null when neither is selected — callers must require at least one. */
export function normalizeServiceType(washAndFold: boolean, dryCleaning: boolean): ServiceType | null {
  if (washAndFold && dryCleaning) return "both";
  if (washAndFold) return "wash_and_fold";
  if (dryCleaning) return "dry_cleaning";
  return null;
}

export function serviceTypeIncludesWashAndFold(serviceType: ServiceType): boolean {
  return serviceType === "wash_and_fold" || serviceType === "both";
}

export function serviceTypeIncludesDryCleaning(serviceType: ServiceType): boolean {
  return serviceType === "dry_cleaning" || serviceType === "both";
}

/**
 * Dry cleaning has a fixed 3-4 calendar-day turnaround, not a
 * customer-chosen speed tier, so any booking that includes dry cleaning is
 * always normalized to 'dry_cleaning_timeline' regardless of whatever
 * wash-and-fold speed was otherwise selected/passed in. Only a genuinely
 * wash_and_fold-only booking keeps the customer's chosen speed.
 */
export function resolveServiceSpeed(
  serviceType: ServiceType,
  washAndFoldSpeed: "standard" | "flexible" | "same_day"
): ServiceSpeed {
  return serviceTypeIncludesDryCleaning(serviceType) ? "dry_cleaning_timeline" : washAndFoldSpeed;
}

/**
 * Whether a booking's service type may still be corrected by staff.
 * Completed/cancelled bookings are done — there's nothing left to correct.
 * A paid booking is also locked: a service-type change clears the quote
 * (see buildServiceTypeChangePayload), and doing that while paid=true stays
 * true would leave a paid-but-unquoted record with no correct total behind
 * it. A booking whose quote was already sent (but not yet paid) is still
 * allowed — the customer was told a number that's about to become wrong,
 * which is a staff-communication concern the confirmation UI must surface,
 * not a reason to block the correction itself.
 */
export function canChangeServiceType(booking: { status: BookingStatus; paid: boolean }): boolean {
  if (booking.status === "completed" || booking.status === "cancelled") return false;
  if (booking.paid) return false;
  return true;
}

/**
 * The exact, unconditional update payload for a service-type correction.
 * Unconditional on purpose — canChangeServiceType() is the gate; this just
 * builds what to write once the caller has already decided to proceed.
 * Every quote-derived field is cleared together (both the wash-and-fold and
 * dry-cleaning amounts, regardless of which ones applied to the old service
 * type), since a service-type change invalidates any prior quote outright —
 * staff re-quote from scratch rather than trying to salvage a partial
 * total. The preferred/confirmed pickup and delivery date/time fields are
 * deliberately left untouched: the caller's UI is responsible for telling
 * staff to review those separately.
 */
export function buildServiceTypeChangePayload(newServiceType: ServiceType, userId: string) {
  return {
    service_type: newServiceType,
    service_speed: (newServiceType === "wash_and_fold" ? "standard" : "dry_cleaning_timeline") as ServiceSpeed,
    actual_weight_lb: null,
    billable_weight_lb: null,
    laundry_charge_cents: null,
    same_day_fee_cents: null,
    dry_cleaning_item_subtotal_cents: null,
    dry_cleaning_effective_charge_cents: null,
    surcharge_total_cents: 0,
    surcharge_notes: null,
    dry_cleaning_notes: null,
    quote_status: "not_started" as const,
    quote_sent_at: null,
    updated_by: userId,
  };
}
