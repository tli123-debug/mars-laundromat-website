"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildServiceQuoteUpdatePayload,
  canMarkQuoteSentForServiceType,
  serviceQuoteEntrySchema,
  validateQuoteEntryForServiceType,
} from "@/lib/quote-validation";
import { buildServiceTypeChangePayload, canChangeServiceType } from "@/lib/service-type";
import type { ServiceType } from "@/types/database.types";
import {
  buildApproveTimePayload,
  buildClearProposedTimePayload,
  buildSaveProposedTimePayload,
  hasCompleteProposedTime,
  validateProposedTime,
} from "@/lib/time-proposal-validation";

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
    .select("status, preferred_pickup_date, preferred_pickup_time, preferred_delivery_date, preferred_delivery_time")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Couldn't find that booking." };
  }

  if (!booking.preferred_delivery_date || !booking.preferred_delivery_time) {
    return { error: "This booking is missing delivery details." };
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
