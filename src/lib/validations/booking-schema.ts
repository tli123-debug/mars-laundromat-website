import { z } from "zod";

export const TIME_WINDOWS = ["morning", "afternoon", "evening"] as const;

export const TIME_WINDOW_LABELS: Record<(typeof TIME_WINDOWS)[number], string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export const bookingSchema = z.object({
  name: z.string().trim().min(2, { error: "Please enter your full name" }).max(100),
  phone: z.string().trim().min(10, { error: "Please enter a valid phone number" }).max(20),
  address: z.string().trim().min(5, { error: "Please enter your pickup address" }).max(300),
  preferredPickupDate: z.iso.date({ error: "Please choose a pickup date" }),
  preferredPickupWindow: z.enum(TIME_WINDOWS, {
    error: "Please choose a pickup time window",
  }),
  // Native <input type="date"> submits "" when empty, not undefined.
  preferredDeliveryDate: z.iso.date().optional().or(z.literal("")),
  preferredDeliveryWindow: z.enum(TIME_WINDOWS).optional().or(z.literal("")),
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
  preferredPickupWindow: undefined as unknown as BookingInput["preferredPickupWindow"],
  preferredDeliveryDate: "",
  preferredDeliveryWindow: "",
  specialInstructions: "",
  companyWebsite: "",
};
