"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildServiceQuoteUpdatePayload,
  canMarkQuoteSentForServiceType,
  serviceQuoteEntrySchema,
  validateQuoteEntryForServiceType,
} from "@/lib/quote-validation";
import { buildServiceTypeChangePayload, canChangeServiceType, serviceTypeIncludesWashAndFold } from "@/lib/service-type";
import type { ServiceType } from "@/types/database.types";
import {
  buildApproveTimePayload,
  buildClearProposedTimePayload,
  buildSaveProposedTimePayload,
  hasCompleteProposedTime,
  validatePreferredTimeForServiceType,
  validateProposedTime,
} from "@/lib/time-proposal-validation";
import {
  nextDayDeliveryDate,
  normalizeAddress,
  normalizePhoneNumber,
  validateRecurringWindows,
} from "@/lib/recurring-schedule";
import { translateToChinese } from "@/lib/translate/translate-to-chinese";

const SERVICE_TYPES = ["wash_and_fold", "dry_cleaning", "both"] as const;
const serviceTypeSchema = z.enum(SERVICE_TYPES);

function revalidateBookingPaths(bookingId: string) {
  revalidatePath("/admin/today");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
}

export async function approveRequestedTime(bookingId: string) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select(
      "status, service_type, service_speed, preferred_pickup_date, preferred_pickup_time, preferred_delivery_date, preferred_delivery_time"
    )
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Couldn't find that booking." };
  }

  if (!booking.preferred_delivery_date || !booking.preferred_delivery_time) {
    return { error: "This booking is missing delivery details." };
  }

  // The customer's request may have been saved before a scheduling rule
  // changed (a legacy pickup+3 Dry Cleaning date, a pre-22-hour-gap
  // Standard delivery, etc.) — re-validate it against the CURRENT rule for
  // its actual service type/speed before ever copying it into confirmed_*.
  const validationError = validatePreferredTimeForServiceType(booking.service_type, booking.service_speed, {
    pickupDate: booking.preferred_pickup_date,
    pickupTime: booking.preferred_pickup_time,
    deliveryDate: booking.preferred_delivery_date,
    deliveryTime: booking.preferred_delivery_time,
  });
  if (validationError) {
    return {
      error: `${validationError} Use the manual time editor below to confirm a valid time by hand.`,
    };
  }

  const payload = buildApproveTimePayload(
    {
      pickupDate: booking.preferred_pickup_date,
      pickupTime: booking.preferred_pickup_time,
      deliveryDate: booking.preferred_delivery_date,
      deliveryTime: booking.preferred_delivery_time,
    },
    booking.status,
    user.id
  );

  const { error } = await supabase.from("bookings").update(payload).eq("id", bookingId);

  if (error) {
    console.error("Approve requested time failed:", error);
    return { error: "Something went wrong updating that booking." };
  }

  revalidateBookingPaths(bookingId);
  return { error: null };
}

const proposedTimeSchema = z.object({
  confirmedPickupDate: z.iso.date(),
  confirmedPickupTime: z.string().min(1),
  confirmedDeliveryDate: z.iso.date(),
  confirmedDeliveryTime: z.string().min(1),
});

export async function saveProposedTime(bookingId: string, input: unknown) {
  const user = await requireAdmin();

  const parsed = proposedTimeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please fill in a complete pickup and delivery time." };
  }

  const validationError = validateProposedTime(parsed.data);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("status")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Couldn't find that booking." };
  }

  const payload = buildSaveProposedTimePayload(parsed.data, booking.status, user.id);
  const { error } = await supabase.from("bookings").update(payload).eq("id", bookingId);

  if (error) {
    console.error("Save proposed time failed:", error);
    return { error: "Something went wrong updating that booking." };
  }

  revalidateBookingPaths(bookingId);
  return { error: null };
}

export async function markTimesConfirmed(bookingId: string) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select(
      "status, confirmed_pickup_date, confirmed_pickup_time, confirmed_delivery_date, confirmed_delivery_time"
    )
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Couldn't find that booking." };
  }

  if (!hasCompleteProposedTime(booking)) {
    return { error: "Save a complete proposed pickup and delivery time before marking it confirmed." };
  }

  if (booking.status !== "pending") {
    return { error: "This booking isn't awaiting a time confirmation." };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "confirmed", updated_by: user.id })
    .eq("id", bookingId);

  if (error) {
    console.error("Mark times confirmed failed:", error);
    return { error: "Something went wrong updating that booking." };
  }

  revalidateBookingPaths(bookingId);
  return { error: null };
}

export async function clearProposedTime(bookingId: string) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("status")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Couldn't find that booking." };
  }

  const payload = buildClearProposedTimePayload(booking.status, user.id);
  const { error } = await supabase.from("bookings").update(payload).eq("id", bookingId);

  if (error) {
    console.error("Clear proposed time failed:", error);
    return { error: "Something went wrong updating that booking." };
  }

  revalidateBookingPaths(bookingId);
  return { error: null };
}

export async function saveQuote(bookingId: string, input: unknown) {
  const user = await requireAdmin();

  const parsed = serviceQuoteEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the quote details." };
  }

  const supabase = await createClient();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("service_type, service_speed")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Couldn't find that booking." };
  }

  const validationError = validateQuoteEntryForServiceType(
    booking.service_type,
    booking.service_speed,
    parsed.data
  );
  if (validationError) {
    return { error: validationError };
  }

  const payload = buildServiceQuoteUpdatePayload(
    booking.service_type,
    booking.service_speed,
    parsed.data,
    user.id
  );

  const { error } = await supabase.from("bookings").update(payload).eq("id", bookingId);

  if (error) {
    console.error("Save quote failed:", error);
    return { error: "Something went wrong updating that booking." };
  }

  revalidateBookingPaths(bookingId);
  return { error: null };
}

export async function markQuoteSent(bookingId: string) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("quote_status, service_type, actual_weight_lb, dry_cleaning_item_subtotal_cents")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Couldn't find that booking." };
  }

  if (!canMarkQuoteSentForServiceType(booking)) {
    return { error: "Save a complete quote before marking it sent." };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ quote_status: "sent", quote_sent_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", bookingId);

  if (error) {
    console.error("Mark quote sent failed:", error);
    return { error: "Something went wrong updating that booking." };
  }

  revalidateBookingPaths(bookingId);
  return { error: null };
}

/**
 * Admin-only correction for a booking's service type — not a general edit,
 * just the narrow "staff picked the wrong service on the phone" fix. Always
 * clears the existing quote (buildServiceTypeChangePayload), since a
 * service-type change invalidates whatever was quoted before; the caller's
 * confirmation UI is responsible for warning staff when quote_status was
 * already 'sent'. canChangeServiceType() rejects completed/cancelled
 * bookings and, separately, any booking that's already paid — clearing the
 * quote on a paid booking would leave a paid-but-unquoted record behind.
 * Deliberately does not touch the preferred or confirmed pickup/delivery
 * date and time fields.
 */
export async function changeServiceType(bookingId: string, newServiceType: unknown) {
  const user = await requireAdmin();

  const parsed = serviceTypeSchema.safeParse(newServiceType);
  if (!parsed.success) {
    return { error: "Please choose a valid service type." };
  }

  const supabase = await createClient();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("status, paid, quote_status, service_type")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Couldn't find that booking." };
  }

  if (!canChangeServiceType({ status: booking.status, paid: booking.paid })) {
    if (booking.paid) {
      return { error: "This booking is already paid — correct payment manually first if needed." };
    }
    return { error: "This booking's service type can no longer be changed." };
  }

  const newServiceTypeValue: ServiceType = parsed.data;
  if (newServiceTypeValue === booking.service_type) {
    return { error: "This booking is already that service type." };
  }

  const payload = buildServiceTypeChangePayload(newServiceTypeValue, user.id);
  const { error } = await supabase.from("bookings").update(payload).eq("id", bookingId);

  if (error) {
    console.error("Change service type failed:", error);
    return { error: "Something went wrong updating that booking." };
  }

  revalidateBookingPaths(bookingId);
  return { error: null };
}

/**
 * Permanent, irreversible deletion — not the normal cleanup path (mark
 * Completed/Cancelled and let it fall into the Archived view instead; see
 * ACTIVE_BOOKING_STATUSES/ARCHIVED_BOOKING_STATUSES in categorize-booking.ts).
 * This exists for genuine mistakes (test entries, duplicates, a booking
 * created in error) that shouldn't linger in Archived/All forever.
 * requireAdmin() is the application-level gate; the database also carries
 * its own authenticated-only DELETE policy as a backstop (see
 * supabase/migrations/20260827000000_status_simplification_and_delete_policy.sql).
 * Redirects to the bookings list on success — there's no page left to
 * revalidate once the row is gone, so only Today and the list itself are
 * invalidated.
 */
export async function deleteBooking(bookingId: string) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("bookings").delete().eq("id", bookingId);

  if (error) {
    // recurring_schedules.source_booking_id references this table with no
    // ON DELETE clause (default RESTRICT) — deliberately preserved so a
    // booking that established a recurring arrangement can never be
    // permanently deleted out from under it (see
    // supabase/migrations/20260830000000_recurring_pickups_v1.sql).
    // Postgres surfaces that as a foreign_key_violation (23503); catch it
    // here and explain it in plain terms instead of showing the raw
    // database error.
    if (error.code === "23503") {
      return {
        error:
          "This booking can't be deleted — it's the source of a recurring pickup schedule. Cancel that schedule first if it's no longer needed. 无法删除此预约——它是某个定期取件安排的来源预约，如需删除请先取消该定期安排。",
      };
    }
    console.error("Delete booking failed:", error);
    return { error: "Something went wrong deleting that booking." };
  }

  revalidatePath("/admin/today");
  revalidatePath("/admin/bookings");
  redirect("/admin/bookings");
}

const recurringEnrollmentSchema = z.object({
  frequency: z.enum(["weekly", "every_two_weeks"]),
  firstPickupDate: z.iso.date(),
  pickupTime: z.string().min(1),
  deliveryTime: z.string().min(1),
  recurringInstructions: z.string().trim().max(1000).optional().or(z.literal("")),
  // Literal true, same trick bookingSchema's smsConsent uses — an
  // unchecked confirmation must fail validation outright, not just be an
  // optional preference.
  consentConfirmed: z.literal(true, { error: "Please confirm the customer's consent first." }),
});

/**
 * Creates a new active recurring schedule from a completed booking. Every
 * value that matters is re-derived or re-validated server-side rather than
 * trusted from the client — the booking's own current status/service_type
 * are fetched fresh (never taken from whatever the form happened to have
 * open), the phone number is normalized here (not accepted pre-normalized
 * from the client), and the pickup/delivery window pair goes through the
 * exact same validateRecurringWindows() the pure-logic tests exercise.
 * Duplicate active/paused schedules are rejected with a friendly message
 * before ever reaching the database's own
 * recurring_schedules_active_customer_unique_idx, which remains the real
 * backstop against a race between two simultaneous enrollment attempts.
 */
export async function setUpRecurringSchedule(bookingId: string, input: unknown) {
  const user = await requireAdmin();

  const parsed = recurringEnrollmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the recurring schedule details." };
  }

  const supabase = await createClient();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("name, phone, address, status, service_type")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Couldn't find that booking." };
  }

  if (booking.status !== "completed") {
    return { error: "Recurring pickup can only be set up from a completed booking." };
  }
  if (!serviceTypeIncludesWashAndFold(booking.service_type)) {
    return { error: "Recurring pickup is only available for orders that included Wash & Fold." };
  }

  const windowError = validateRecurringWindows({
    pickupDate: parsed.data.firstPickupDate,
    pickupTime: parsed.data.pickupTime,
    deliveryDate: nextDayDeliveryDate(parsed.data.firstPickupDate),
    deliveryTime: parsed.data.deliveryTime,
  });
  if (windowError) {
    return { error: windowError };
  }

  const normalizedPhone = normalizePhoneNumber(booking.phone);
  const normalizedAddress = normalizeAddress(booking.address);

  // A small, indexed-by-phone lookup, not a full scan — address is
  // compared in JS via the same normalizeAddress() the database's own
  // partial unique index expression (lower(btrim(address))) uses, since
  // there's no separate address_normalized column to filter on directly.
  const { data: candidates, error: lookupError } = await supabase
    .from("recurring_schedules")
    .select("address")
    .eq("customer_phone_normalized", normalizedPhone)
    .in("status", ["active", "paused"]);

  if (lookupError) {
    console.error("Recurring schedule duplicate check failed:", lookupError);
    return { error: "Something went wrong checking for an existing schedule." };
  }

  if ((candidates ?? []).some((s) => normalizeAddress(s.address) === normalizedAddress)) {
    return { error: "This customer already has an active or paused recurring schedule." };
  }

  // Best-effort, same pattern as createBooking()'s special-instructions
  // translation — a translation hiccup must never block setting up the
  // schedule, and every future occurrence this schedule generates copies
  // recurring_instructions_zh straight into its own special_instructions_zh
  // (see generate_due_recurring_bookings() in the Checkpoint 1 migration).
  let recurringInstructionsZh: string | null = null;
  if (parsed.data.recurringInstructions) {
    try {
      recurringInstructionsZh = await translateToChinese(parsed.data.recurringInstructions);
    } catch (translateError) {
      console.error(`Recurring schedule setup for booking ${bookingId}: translation failed`, translateError);
    }
  }

  const { error: insertError } = await supabase.from("recurring_schedules").insert({
    frequency: parsed.data.frequency,
    customer_name: booking.name,
    customer_phone: booking.phone,
    customer_phone_normalized: normalizedPhone,
    address: booking.address,
    pickup_time: parsed.data.pickupTime,
    delivery_time: parsed.data.deliveryTime,
    next_pickup_date: parsed.data.firstPickupDate,
    recurring_instructions: parsed.data.recurringInstructions || null,
    recurring_instructions_zh: recurringInstructionsZh,
    source_booking_id: bookingId,
    recurring_consent_at: new Date().toISOString(),
    created_by: user.id,
    updated_by: user.id,
  });

  if (insertError) {
    // The pre-check above is best-effort UX, not the real guarantee — two
    // simultaneous enrollment attempts for the same customer can both pass
    // it before either has inserted. recurring_schedules_active_customer_
    // unique_idx is what actually prevents the duplicate row in that race;
    // a 23505 here means it just did its job.
    if (insertError.code === "23505") {
      return { error: "This customer already has an active or paused recurring schedule." };
    }
    console.error("Create recurring schedule failed:", insertError);
    return { error: "Something went wrong setting up the recurring schedule." };
  }

  revalidateBookingPaths(bookingId);
  revalidatePath("/admin/recurring");
  return { error: null };
}
