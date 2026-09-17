"use server";

import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { bookingSchema, bookingSchemaShape } from "@/lib/validations/booking-schema";
import { sendBookingNotification } from "@/lib/email/send-booking-notification";
import { translateToChinese } from "@/lib/translate/translate-to-chinese";
import { normalizeServiceType, resolveServiceSpeed, serviceTypeIncludesDryCleaning } from "@/lib/service-type";
import { normalizeAcquisitionSource } from "@/lib/acquisition-source";
import { FindResultSchema, SubmitResultSchema, shouldNotifyForOutcome, type ActionResult } from "@/lib/booking-submission";

const UNCERTAIN_MESSAGE =
  "We're not sure if that went through. It's safe to try again — we won't create a duplicate. Or call/text us at (929) 870-1166.";
const CONFLICT_MESSAGE =
  'We already have a request on file from this session with different details — call or text us at (929) 870-1166 to update it, or use "Submit another request" for a separate new order.';

/**
 * clientSubmissionId is minted by the BROWSER once per logical submission
 * attempt (src/lib/booking-submission-storage.ts) and reused across every
 * retry of that same attempt — never regenerated except on an explicit
 * "Submit another request." It's what find_existing_booking_submission()/
 * submit_booking() (20260917000000_booking_submission_idempotency.sql) key
 * their dedup decision on.
 */
export async function createBooking(input: unknown, clientSubmissionId: string): Promise<ActionResult> {
  // Shape only — no date-sensitive or cross-field business rules. This is
  // what lets a genuinely already-accepted booking be recovered days
  // later, after its originally-requested date has rolled into the past:
  // the full bookingSchema (below) is only ever run once we've confirmed
  // nothing exists yet, never as a gate on recovery itself.
  const shapeParsed = bookingSchemaShape.safeParse(input);
  if (!shapeParsed.success) {
    return { status: "error", message: "Please check the form and try again." };
  }

  if (shapeParsed.data.companyWebsite) {
    // Honeypot tripped — return a normal-looking success so bots don't learn it failed.
    return { status: "success", bookingId: crypto.randomUUID(), message: "Thanks! We'll be in touch shortly." };
  }

  if (!z.uuid().safeParse(clientSubmissionId).success) {
    return { status: "error", message: "Please refresh the page and try again." };
  }

  // Never trust a client-submitted service_type/service_speed directly —
  // derive both from the validated washAndFold/dryCleaning booleans, same
  // as every other Server Action in this codebase re-derives authoritative
  // state rather than passing raw input through.
  const serviceType = normalizeServiceType(shapeParsed.data.washAndFold, shapeParsed.data.dryCleaning);
  if (!serviceType) {
    // Genuinely reachable now, not just defensive: bookingSchemaShape alone
    // (unlike the full bookingSchema) does not enforce "at least one
    // service selected" — that rule lives in the superRefine this
    // shape-only parse deliberately skips. A direct-RPC-bypassing caller,
    // or any future client bug, can land here with neither box checked.
    return { status: "error", message: "Please check the form and try again." };
  }
  const resolvedServiceSpeed = resolveServiceSpeed(serviceType, shapeParsed.data.serviceSpeed ?? "standard");

  // Only stored when the derived service type actually includes dry
  // cleaning — a description submitted alongside a Wash & Fold-only
  // selection (stale or adversarial) is dropped rather than compared or saved.
  const dryCleaningItemDescription = serviceTypeIncludesDryCleaning(serviceType)
    ? shapeParsed.data.dryCleaningItemDescription || null
    : null;

  const comparable = {
    p_name: shapeParsed.data.name,
    p_phone: shapeParsed.data.phone,
    p_address: shapeParsed.data.address,
    p_service_type: serviceType,
    p_service_speed: resolvedServiceSpeed,
    p_pickup_date: shapeParsed.data.preferredPickupDate,
    p_pickup_time: shapeParsed.data.preferredPickupTime,
    p_delivery_date: shapeParsed.data.preferredDeliveryDate,
    p_delivery_time: shapeParsed.data.preferredDeliveryTime,
    p_dry_cleaning_item_description: dryCleaningItemDescription,
    p_special_instructions: shapeParsed.data.specialInstructions || null,
  };

  try {
    const supabase = await createClient();

    // Recovery check FIRST, before any date-sensitive rule — lets an
    // already-accepted booking be found days later, after its originally
    // requested date has rolled into the past, without ever being rejected
    // by a rule that only makes sense for NEW creation.
    const { data: found, error: findError } = await supabase.rpc("find_existing_booking_submission", {
      p_client_submission_id: clientSubmissionId,
      ...comparable,
    });

    if (findError) {
      // A read-only lookup failing doesn't tell us whether a PRIOR attempt
      // under this id actually succeeded — that's exactly what we were
      // trying to determine. Uncertain, not a definite rejection: keep the
      // id and the stored attempt, offer a safe retry.
      console.error("createBooking: find_existing_booking_submission failed", findError);
      return { status: "uncertain", message: UNCERTAIN_MESSAGE };
    }

    const foundResult = FindResultSchema.safeParse(found?.[0]);
    if (!foundResult.success) {
      console.error("createBooking: unexpected find_existing_booking_submission response shape", found);
      return { status: "uncertain", message: UNCERTAIN_MESSAGE };
    }

    if (foundResult.data.outcome === "found_matching") {
      // FindResultSchema's discriminated union guarantees booking_id is a
      // real string here — no assertion needed.
      return {
        status: "success",
        bookingId: foundResult.data.booking_id,
        message: "Thanks! We've received your request and will confirm shortly.",
      };
    }
    if (foundResult.data.outcome === "found_conflicting") {
      return { status: "conflict", bookingId: foundResult.data.booking_id, message: CONFLICT_MESSAGE };
    }

    // Not found: a genuinely new attempt — NOW the full, date-sensitive
    // business-rule validation applies, and a failure here is a real,
    // definite rejection (nothing exists yet, and this confirms nothing
    // will be created either).
    const fullyParsed = bookingSchema.safeParse(input);
    if (!fullyParsed.success) {
      return { status: "error", message: "Please check the form and try again." };
    }

    // Never trust the submitted value merely because the client already
    // normalized/hid it (a tracked-link visit sets this without the
    // customer ever seeing the question) — an unrecognized or malformed
    // value here silently becomes null rather than blocking the booking.
    const acquisitionSource = normalizeAcquisitionSource(fullyParsed.data.acquisitionSource);

    // Independent translations, run concurrently — each independently
    // defaulted to null on failure, same best-effort contract as before,
    // each keeping translateToChinese()'s own existing 4s internal timeout
    // untouched. Still run before the insert attempt: anon has INSERT-only
    // RLS on bookings (no follow-up UPDATE), so there's no way to attach a
    // translation after the fact.
    const [specialInstructionsZh, dryCleaningItemDescriptionZh] = await Promise.all([
      comparable.p_special_instructions
        ? translateToChinese(comparable.p_special_instructions).catch((translateError) => {
            console.error("createBooking: special instructions translation failed", translateError);
            return null;
          })
        : Promise.resolve(null),
      dryCleaningItemDescription
        ? translateToChinese(dryCleaningItemDescription).catch((translateError) => {
            console.error("createBooking: dry-cleaning description translation failed", translateError);
            return null;
          })
        : Promise.resolve(null),
    ]);

    const { data: submitted, error: submitError } = await supabase.rpc("submit_booking", {
      p_client_submission_id: clientSubmissionId,
      ...comparable,
      p_dry_cleaning_item_description_zh: dryCleaningItemDescriptionZh,
      p_special_instructions_zh: specialInstructionsZh,
      p_acquisition_source: acquisitionSource,
    });

    if (submitError) {
      // Same reasoning as findError: a lost response can happen AFTER the
      // insert already committed. Uncertain, not error.
      console.error("createBooking: submit_booking failed", submitError);
      return { status: "uncertain", message: UNCERTAIN_MESSAGE };
    }

    const submitResult = SubmitResultSchema.safeParse(submitted?.[0]);
    if (!submitResult.success) {
      console.error("createBooking: unexpected submit_booking response shape", submitted);
      return { status: "uncertain", message: UNCERTAIN_MESSAGE };
    }

    if (submitResult.data.outcome === "conflict") {
      return { status: "conflict", bookingId: submitResult.data.booking_id, message: CONFLICT_MESSAGE };
    }

    // Booking is durably saved (created) or was already durably saved by an
    // earlier, identical attempt (duplicate) — either way that's the
    // success condition for the customer. Only a genuinely fresh row
    // schedules the notification; a deduped identical retry was already
    // notified on the original attempt.
    if (shouldNotifyForOutcome(submitResult.data.outcome)) {
      const bookingId = submitResult.data.booking_id;
      after(() =>
        sendBookingNotification({
          bookingId,
          booking: fullyParsed.data,
          serviceType,
          serviceSpeed: resolvedServiceSpeed,
          dryCleaningItemDescription,
          dryCleaningItemDescriptionZh,
          acquisitionSource,
        }).catch((emailError) => console.error(`Booking ${bookingId}: notification failed`, emailError))
      );
    }

    return {
      status: "success",
      bookingId: submitResult.data.booking_id,
      message: "Thanks! We've received your request and will confirm shortly.",
    };
  } catch (transportError) {
    // This function's OWN hop (Next.js server -> Supabase) failing. Does
    // NOT catch the browser -> Next.js hop — that's a separate try/catch in
    // booking-form.tsx around the call TO this Server Action.
    console.error("createBooking: transport failure", transportError);
    return { status: "uncertain", message: UNCERTAIN_MESSAGE };
  }
}
