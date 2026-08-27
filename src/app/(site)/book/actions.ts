"use server";

import { createClient } from "@/lib/supabase/server";
import { bookingSchema, type BookingInput } from "@/lib/validations/booking-schema";
import { sendBookingNotification } from "@/lib/email/send-booking-notification";
import { translateToChinese } from "@/lib/translate/translate-to-chinese";
import { normalizeServiceType, resolveServiceSpeed, serviceTypeIncludesDryCleaning } from "@/lib/service-type";

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

  // Never trust a client-submitted service_type/service_speed directly —
  // derive both from the validated washAndFold/dryCleaning booleans, same as
  // every other Server Action in this codebase re-derives authoritative
  // state rather than passing raw input through.
  const serviceType = normalizeServiceType(parsed.data.washAndFold, parsed.data.dryCleaning);
  if (!serviceType) {
    // Unreachable: bookingSchema's superRefine already rejects
    // washAndFold === false && dryCleaning === false. Defensive fallback
    // only, so a future schema regression fails loudly instead of writing a
    // malformed row.
    console.error("createBooking: normalizeServiceType returned null after schema validation passed");
    return { status: "error", message: "Please check the form and try again." };
  }
  const resolvedServiceSpeed = resolveServiceSpeed(serviceType, parsed.data.serviceSpeed ?? "standard");

  // Only stored when the derived service type actually includes dry
  // cleaning — a description submitted alongside a Wash & Fold-only
  // selection (stale or adversarial) is dropped rather than saved against a
  // booking it doesn't describe.
  const dryCleaningItemDescription = serviceTypeIncludesDryCleaning(serviceType)
    ? parsed.data.dryCleaningItemDescription || null
    : null;

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

  let dryCleaningItemDescriptionZh: string | null = null;
  if (dryCleaningItemDescription) {
    try {
      dryCleaningItemDescriptionZh = await translateToChinese(dryCleaningItemDescription);
    } catch (translateError) {
      console.error(`Booking ${bookingId}: dry-cleaning description translation failed`, translateError);
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
    service_type: serviceType,
    service_speed: resolvedServiceSpeed,
    dry_cleaning_item_description: dryCleaningItemDescription,
    dry_cleaning_item_description_zh: dryCleaningItemDescriptionZh,
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
    await sendBookingNotification({
      bookingId,
      booking: parsed.data,
      serviceType,
      serviceSpeed: resolvedServiceSpeed,
      dryCleaningItemDescription,
      dryCleaningItemDescriptionZh,
    });
  } catch (emailError) {
    console.error(`Booking ${bookingId}: notification email failed`, emailError);
  }

  return {
    status: "success",
    message: "Thanks! We've received your request and will confirm shortly.",
  };
}
