import { z } from "zod";
import {
  addDays,
  formatClockLabel,
  getBrooklynToday,
  getSameDayEligibleWindows,
  getWindowsForDate,
  SAME_DAY_DELIVERY_WINDOW_START,
} from "@/lib/booking-hours";

const SERVICE_SPEEDS = ["standard", "flexible", "same_day"] as const;
export type ServiceSpeed = (typeof SERVICE_SPEEDS)[number];

/**
 * Formats a stored window-start value ("HH:MM" or Postgres's "HH:MM:SS") as a
 * one-hour range, e.g. "2:30–3:30 PM" — a stored time now means "window
 * start," not "the appointment," so every consumer needs the range, not a
 * single point. Renamed from the old timeSlotLabel() for that reason.
 */
export function windowLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.slice(0, 5);
  const [hours, minutes] = normalized.split(":").map(Number);
  const startMinutes = hours * 60 + minutes;
  return `${formatClockLabel(startMinutes)}–${formatClockLabel(startMinutes + 60)}`;
}

export const bookingSchema = z
  .object({
    name: z.string().trim().min(2, { error: "Please enter your full name" }).max(100),
    phone: z.string().trim().min(10, { error: "Please enter a valid phone number" }).max(20),
    address: z.string().trim().min(5, { error: "Please enter your pickup address" }).max(300),
    preferredPickupDate: z.iso.date({ error: "Please choose a pickup date" }),
    preferredPickupTime: z.string().min(1, { error: "Please choose a pickup time" }),
    preferredDeliveryDate: z.iso.date({ error: "Please choose a delivery date" }),
    preferredDeliveryTime: z.string().min(1, { error: "Please choose a delivery time" }),
    // No .default() here — that would make this field optional on the input
    // side but required on the output side, which conflicts with useForm's
    // single BookingInput type. bookingFormDefaults already guarantees a
    // real value is present from the start.
    serviceSpeed: z.enum(SERVICE_SPEEDS, { error: "Please choose a service speed" }),
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
  });

export type BookingInput = z.infer<typeof bookingSchema>;

export const bookingFormDefaults: BookingInput = {
  name: "",
  phone: "",
  address: "",
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
