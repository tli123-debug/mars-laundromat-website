import { addDays } from "@/lib/booking-hours";

/**
 * Dry cleaning is done by an outside cleaner with a fixed ~3-4 calendar-day
 * turnaround after pickup — pickup day is the starting point, and the
 * customer's requested delivery date must be exactly one of these two
 * dates. Delivery *time* validity is separate and still goes through the
 * existing getWindowsForDate() (store-hours windows) — this module is only
 * about which calendar dates are eligible at all.
 *
 * This is a public-form constraint on what a customer may request, not a
 * limit on what staff can later confirm — the admin manual time-override
 * (time-proposal-validation.ts) intentionally keeps its existing, broader
 * discretion and does not import from here.
 */
export function getDryCleaningDeliveryDateOptions(pickupDate: string): [string, string] {
  return [addDays(pickupDate, 3), addDays(pickupDate, 4)];
}

export function isValidDryCleaningDeliveryDate(pickupDate: string, deliveryDate: string): boolean {
  const [plusThree, plusFour] = getDryCleaningDeliveryDateOptions(pickupDate);
  return deliveryDate === plusThree || deliveryDate === plusFour;
}
