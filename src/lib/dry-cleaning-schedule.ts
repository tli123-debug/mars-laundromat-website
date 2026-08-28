import { addDays } from "@/lib/booking-hours";

/**
 * Dry cleaning is done by an outside cleaner with a ~3-4 calendar-day
 * turnaround after pickup. The public form schedules delivery on exactly
 * the fourth calendar day — offering a Day 3/Day 4 choice implied a
 * promise the outside cleaner can't reliably keep; a customer who picked
 * Day 3 had no guarantee it would actually be ready. An order that IS
 * ready on Day 3 is still handled: staff text the customer and arrange an
 * earlier delivery window manually. Delivery *time* validity is separate
 * and still goes through the existing getWindowsForDate() (store-hours
 * windows) — this module is only about which calendar date is eligible.
 *
 * This is a public-form constraint on what a customer may request, not a
 * limit on what staff can later confirm — the admin manual time-override
 * (time-proposal-validation.ts) intentionally keeps its existing, broader
 * discretion (any store window, any date at or after pickup) and does not
 * import from here, so a Day 3 delivery is still confirmable by hand.
 */
export function getDryCleaningDeliveryDate(pickupDate: string): string {
  return addDays(pickupDate, 4);
}

export function isValidDryCleaningDeliveryDate(pickupDate: string, deliveryDate: string): boolean {
  return deliveryDate === getDryCleaningDeliveryDate(pickupDate);
}
