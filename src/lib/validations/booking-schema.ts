import { z } from "zod";
import {
  addDays,
  getBrooklynToday,
  getSameDayEligibleWindows,
  getStandardFlexibleDeliveryWindows,
  getWindowsForDate,
  rangeLabel,
  SAME_DAY_DELIVERY_WINDOW_START,
} from "@/lib/booking-hours";
import { isValidDryCleaningDeliveryDate } from "@/lib/dry-cleaning-schedule";

const SERVICE_SPEEDS = ["standard", "flexible", "same_day"] as const;
export type ServiceSpeed = (typeof SERVICE_SPEEDS)[number];

/**
 * Formats a stored window-start value ("HH:MM" or Postgres's "HH:MM:SS") as a
 * one-hour range, e.g. "2:30 PM–3:30 PM" — a stored time now means "window
 * start," not "the appointment," so every consumer needs the range, not a
 * single point. Renamed from the old timeSlotLabel() for that reason. Thin
 * wrapper around booking-hours.ts's rangeLabel() so the same formatting is
 * shared between values generated fresh (the public form's dropdowns) and
 * values read back from storage (the admin dashboard, the notification email).
 */
export function windowLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.slice(0, 5);
  const [hours, minutes] = normalized.split(":").map(Number);
  return rangeLabel(hours * 60 + minutes);
}

export const bookingSchema = z
  .object({
    name: z.string().trim().min(2, { error: "Please enter your full name" }).max(100),
    phone: z.string().trim().min(10, { error: "Please enter a valid phone number" }).max(20),
    address: z.string().trim().min(5, { error: "Please enter your pickup address" }).max(300),
    // At least one must be true — Zod can't express "at least one of two
    // sibling fields" on the field schemas themselves, so that rule (and the
    // service_type it implies) lives entirely in superRefine below.
    washAndFold: z.boolean(),
    dryCleaning: z.boolean(),
    dryCleaningItemDescription: z.string().trim().max(500).optional().or(z.literal("")),
    // Plain boolean, not z.literal(true) like smsConsent below — this is
    // only required when dryCleaning is selected, so it can't be
    // unconditionally required at the shape level.
    dryCleaningBagAcknowledgement: z.boolean(),
    preferredPickupDate: z.iso.date({ error: "Please choose a pickup date" }),
    preferredPickupTime: z.string().min(1, { error: "Please choose a pickup time" }),
    preferredDeliveryDate: z.iso.date({ error: "Please choose a delivery date" }),
    preferredDeliveryTime: z.string().min(1, { error: "Please choose a delivery time" }),
    // Only meaningful for a Wash & Fold-only booking — Dry Cleaning/Both
    // have a fixed 3-4 calendar-day turnaround instead of a chosen speed
    // tier, so this is optional here and conditionally required below.
    serviceSpeed: z.enum(SERVICE_SPEEDS, { error: "Please choose a service speed" }).optional(),
    // A checkbox that isn't checked, not an optional preference — the public
    // form has no call/text selector, so this is the only gate. Literal
    // `true` (not `boolean`) so an unchecked box fails validation outright.
    smsConsent: z.literal(true, {
      error: "Please check the box to continue by text, or call us at +1 (929) 870-1166 instead",
    }),
    specialInstructions: z.string().trim().max(1000).optional().or(z.literal("")),
    // Honeypot — real users never see or fill this field.
    companyWebsite: z.string().max(0).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (!data.washAndFold && !data.dryCleaning) {
      ctx.addIssue({
        code: "custom",
        message: "Please select Wash & Fold, Dry Cleaning & Ironing, or both",
        path: ["washAndFold"],
      });
      return; // nothing else is meaningful without knowing what's being booked
    }

    if (data.dryCleaning && data.dryCleaningBagAcknowledgement !== true) {
      ctx.addIssue({
        code: "custom",
        message: "Please confirm you'll bag your dry-cleaning items separately from Wash & Fold",
        path: ["dryCleaningBagAcknowledgement"],
      });
    }

    const washAndFoldOnly = data.washAndFold && !data.dryCleaning;

    if (washAndFoldOnly && !data.serviceSpeed) {
      ctx.addIssue({
        code: "custom",
        message: "Please choose a service speed",
        path: ["serviceSpeed"],
      });
      return; // every check below assumes a speed to validate dates against
    }

    const today = getBrooklynToday();
    if (data.preferredPickupDate < today) {
      ctx.addIssue({
        code: "custom",
        message: "Pickup date can't be in the past",
        path: ["preferredPickupDate"],
      });
      return; // every check below assumes a plausible pickup date
    }

    const pickupWindowValues = new Set(
      getWindowsForDate(data.preferredPickupDate).map((w) => w.value)
    );
    const pickupTimeValid = pickupWindowValues.has(data.preferredPickupTime);
    if (!pickupTimeValid) {
      ctx.addIssue({
        code: "custom",
        message: "Please choose an available pickup time",
        path: ["preferredPickupTime"],
      });
    }

    // Dry Cleaning and Both share the exact same fixed delivery rule and
    // never offer Same-Day Rush, regardless of whether Wash & Fold is also
    // included — so this branches on dryCleaning alone. Any serviceSpeed
    // value submitted alongside a dry-cleaning-involving booking (stale or
    // adversarial) is ignored here on purpose: this rule decides
    // delivery-date validity by the pickup+4 date only, so a smuggled
    // "same_day" can't shortcut same-day-style scheduling onto a
    // dry-cleaning booking. Requesting pickup+3 is deliberately rejected
    // here even though staff can still arrange it by hand later if the
    // order turns out to be ready early — see isValidDryCleaningDeliveryDate().
    if (data.dryCleaning) {
      if (!isValidDryCleaningDeliveryDate(data.preferredPickupDate, data.preferredDeliveryDate)) {
        ctx.addIssue({
          code: "custom",
          message: "Dry cleaning delivery is scheduled for the fourth calendar day after pickup",
          path: ["preferredDeliveryDate"],
        });
      } else {
        const deliveryWindowValues = new Set(
          getWindowsForDate(data.preferredDeliveryDate).map((w) => w.value)
        );
        if (!deliveryWindowValues.has(data.preferredDeliveryTime)) {
          ctx.addIssue({
            code: "custom",
            message: "Please choose an available delivery time",
            path: ["preferredDeliveryTime"],
          });
        }
      }
      return;
    }

    // Wash & Fold only from here on.
    if (data.serviceSpeed === "same_day") {
      if (pickupTimeValid) {
        const eligibleValues = new Set(
          getSameDayEligibleWindows(data.preferredPickupDate).map((w) => w.value)
        );
        if (!eligibleValues.has(data.preferredPickupTime)) {
          ctx.addIssue({
            code: "custom",
            message:
              "Same-Day Rush needs a pickup window ending by 12:00 PM (11:00 AM–12:00 PM is the latest)",
            path: ["preferredPickupTime"],
          });
        }
      }

      if (data.preferredDeliveryDate !== data.preferredPickupDate) {
        ctx.addIssue({
          code: "custom",
          message: "Same-Day Rush delivers the same day as pickup",
          path: ["preferredDeliveryDate"],
        });
      }
      if (data.preferredDeliveryTime !== SAME_DAY_DELIVERY_WINDOW_START) {
        ctx.addIssue({
          code: "custom",
          message: "Same-Day Rush delivery is fixed to 6:00–7:00 PM",
          path: ["preferredDeliveryTime"],
        });
      }
      return;
    }

    // Standard / flexible: delivery date is pickup+1 (standard) or pickup+1..+2 (flexible).
    const minDeliveryDate = addDays(data.preferredPickupDate, 1);
    const maxDeliveryDate =
      data.serviceSpeed === "flexible" ? addDays(data.preferredPickupDate, 2) : minDeliveryDate;

    const deliveryDateValid =
      data.preferredDeliveryDate >= minDeliveryDate && data.preferredDeliveryDate <= maxDeliveryDate;

    if (!deliveryDateValid) {
      ctx.addIssue({
        code: "custom",
        message:
          data.serviceSpeed === "flexible"
            ? "Flexible delivery must be 1–2 days after pickup"
            : "Standard delivery is the next day after pickup",
        path: ["preferredDeliveryDate"],
      });
    } else {
      // A delivery window must also clear the 22-hour-after-pickup-end gap
      // (see getStandardFlexibleDeliveryWindows) — a pickup+1 date being
      // within range doesn't mean every window on it actually satisfies
      // the gap for a late-day pickup.
      const deliveryWindowValues = new Set(
        getStandardFlexibleDeliveryWindows(
          data.preferredPickupDate,
          data.preferredPickupTime,
          data.preferredDeliveryDate
        ).map((w) => w.value)
      );
      if (!deliveryWindowValues.has(data.preferredDeliveryTime)) {
        ctx.addIssue({
          code: "custom",
          message: "Please choose an available delivery time",
          path: ["preferredDeliveryTime"],
        });
      }
    }
  });

export type BookingInput = z.infer<typeof bookingSchema>;

export const bookingFormDefaults: BookingInput = {
  name: "",
  phone: "",
  address: "",
  washAndFold: true,
  dryCleaning: false,
  dryCleaningItemDescription: "",
  dryCleaningBagAcknowledgement: false,
  preferredPickupDate: "",
  preferredPickupTime: "",
  preferredDeliveryDate: "",
  preferredDeliveryTime: "",
  serviceSpeed: "standard",
  // Starts unchecked; z.literal(true) means this cast is only valid once the
  // customer actually checks the box, same trick as the empty string above.
  smsConsent: false as unknown as BookingInput["smsConsent"],
  specialInstructions: "",
  companyWebsite: "",
};

/**
 * The fields to reset after a service-selection checkbox changes, so a
 * hidden field can never silently resubmit a value left over from the other
 * selection state. Pure and separate from the form component so this exact
 * behavior — "changing service selection clears incompatible state" — is
 * unit-testable without mounting the form. The caller applies each key via
 * setValue; this function only decides what's stale.
 *
 * Delivery date/time always reset: Wash & Fold's speed-based window and Dry
 * Cleaning/Both's fixed pickup+4 date are never both valid for the same
 * stored value. serviceSpeed resets to undefined when dry cleaning becomes
 * selected (it's hidden and unused), or back to "standard" when returning to
 * Wash & Fold-only (it becomes required again). The dry-cleaning-only fields
 * always clear to their unselected defaults — moving into dry cleaning finds
 * them already blank (they were hidden), and moving out of it must blank
 * them so they don't resubmit hidden, stale content.
 */
export function fieldsToResetOnServiceChange(dryCleaningSelected: boolean): {
  serviceSpeed: ServiceSpeed | undefined;
  preferredDeliveryDate: string;
  preferredDeliveryTime: string;
  dryCleaningItemDescription: string;
  dryCleaningBagAcknowledgement: boolean;
} {
  return {
    serviceSpeed: dryCleaningSelected ? undefined : "standard",
    preferredDeliveryDate: "",
    preferredDeliveryTime: "",
    dryCleaningItemDescription: "",
    dryCleaningBagAcknowledgement: false,
  };
}
