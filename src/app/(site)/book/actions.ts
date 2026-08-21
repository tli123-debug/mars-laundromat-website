"use server";

import { createClient } from "@/lib/supabase/server";
import { bookingSchema, type BookingInput } from "@/lib/validations/booking-schema";
import { sendBookingNotification } from "@/lib/email/send-booking-notification";
import { translateToChinese } from "@/lib/translate/translate-to-chinese";

type ActionResult = { status: "success" | "error"; message: string };

export async function createBooking(input: BookingInput): Promise<ActionResult> {
  // Client-side validation is UX only — never trust it as the security boundary.
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Please check the form and try again." };
  }

  if (parsed.data.companyWebsite) {
    // Honeypot tripped — return a normal-looking success so bots don't learn it failed.
    return { status: "success", message: "Thanks! We'll be in touch shortly." };
  }

  // Generated here (not left to the DB default) so we have the id without
  // reading the row back — anon can only INSERT, not SELECT, so chaining
  // .select() after .insert() would need a read the RLS policy denies,
  // which fails the whole insert with a misleading RLS-violation error.
  const bookingId = crypto.randomUUID();

  // Best-effort, same as the notification email below — a translation
  // hiccup must never block the booking itself, so this is folded into the
  // single insert (anon can only INSERT, not a follow-up UPDATE) with a
  // null fallback on failure.
  let specialInstructionsZh: string | null = null;
  if (parsed.data.specialInstructions) {
    try {
      specialInstructionsZh = await translateToChinese(parsed.data.specialInstructions);
    } catch (translateError) {
      console.error(`Booking ${bookingId}: translation failed`, translateError);
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("bookings").insert({
    id: bookingId,
    name: parsed.data.name,
    phone: parsed.data.phone,
    address: parsed.data.address,
    preferred_pickup_date: parsed.data.preferredPickupDate,
    preferred_pickup_time: parsed.data.preferredPickupTime,
    preferred_delivery_date: parsed.data.preferredDeliveryDate,
    preferred_delivery_time: parsed.data.preferredDeliveryTime,
    special_instructions: parsed.data.specialInstructions || null,
    special_instructions_zh: specialInstructionsZh,
    booking_source: "website",
    contact_preference: "text",
    sms_consent: true,
    sms_consent_at: new Date().toISOString(),
    service_speed: parsed.data.serviceSpeed,
  });

  if (error) {
    console.error("Booking insert failed:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again or give us a call.",
    };
  }

  // Booking is durably saved — that's the success condition for the user.
  // Email is best-effort only; a Resend hiccup must never surface as a
  // failure here, since the booking itself already succeeded.
  try {
    await sendBookingNotification({ bookingId, booking: parsed.data });
  } catch (emailError) {
    console.error(`Booking ${bookingId}: notification email failed`, emailError);
  }

  return {
    status: "success",
    message: "Thanks! We've received your request and will confirm shortly.",
  };
}
