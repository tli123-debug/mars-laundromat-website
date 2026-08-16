import { z } from "zod";

const BUSINESS_HOURS_START = "08:00";
const BUSINESS_HOURS_END = "20:00";
const SLOT_INTERVAL_MINUTES = 30;

function generateTimeSlots(start: string, end: string, intervalMinutes: number) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  const slots: { value: string; label: string }[] = [];
  for (let total = startTotal; total <= endTotal; total += intervalMinutes) {
    const hour24 = Math.floor(total / 60);
    const minute = total % 60;
    const value = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const period = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const label = `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
    slots.push({ value, label });
  }
  return slots;
}

/** "08:00"–"20:00" in 30-minute steps, e.g. { value: "14:30", label: "2:30 PM" }. */
export const TIME_SLOTS = generateTimeSlots(
  BUSINESS_HOURS_START,
  BUSINESS_HOURS_END,
  SLOT_INTERVAL_MINUTES
);

const TIME_SLOT_VALUES = new Set(TIME_SLOTS.map((slot) => slot.value));

export function timeSlotLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  // Postgres `time` columns serialize as "HH:MM:SS" — normalize before matching.
  const normalized = value.slice(0, 5);
  return TIME_SLOTS.find((slot) => slot.value === normalized)?.label ?? value;
}

export const bookingSchema = z.object({
  name: z.string().trim().min(2, { error: "Please enter your full name" }).max(100),
  phone: z.string().trim().min(10, { error: "Please enter a valid phone number" }).max(20),
  address: z.string().trim().min(5, { error: "Please enter your pickup address" }).max(300),
  preferredPickupDate: z.iso.date({ error: "Please choose a pickup date" }),
  preferredPickupTime: z
    .string()
    .refine((value) => TIME_SLOT_VALUES.has(value), { error: "Please choose a pickup time" }),
  // Native <input type="date"> submits "" when empty, not undefined.
  preferredDeliveryDate: z.iso.date().optional().or(z.literal("")),
  preferredDeliveryTime: z
    .string()
    .refine((value) => value === "" || TIME_SLOT_VALUES.has(value), {
      error: "Please choose a valid delivery time",
    })
    .optional()
    .or(z.literal("")),
  specialInstructions: z.string().trim().max(1000).optional().or(z.literal("")),
  // Honeypot — real users never see or fill this field.
  companyWebsite: z.string().max(0).optional().or(z.literal("")),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export const bookingFormDefaults: BookingInput = {
  name: "",
  phone: "",
  address: "",
  preferredPickupDate: "",
  preferredPickupTime: undefined as unknown as BookingInput["preferredPickupTime"],
  preferredDeliveryDate: "",
  preferredDeliveryTime: "",
  specialInstructions: "",
  companyWebsite: "",
};
