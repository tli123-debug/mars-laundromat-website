"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import { calculateQuote } from "@/lib/pricing/calculate-quote";
import {
  buildQuoteUpdatePayload,
  canApplySameDayFee,
  canMarkQuoteSent,
  quoteEntrySchema,
} from "@/lib/quote-validation";
import {
  buildApproveTimePayload,
  buildClearProposedTimePayload,
  buildSaveProposedTimePayload,
  hasCompleteProposedTime,
  validateProposedTime,
} from "@/lib/time-proposal-validation";

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

  const parsed = quoteEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the quote details." };
  }

  const supabase = await createClient();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("service_speed")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Couldn't find that booking." };
  }

  if (parsed.data.sameDayApproved && !canApplySameDayFee(booking.service_speed, true)) {
    return { error: "This booking isn't Same-Day Rush — the $10 fee doesn't apply." };
  }

  const quoteResult = calculateQuote({
    actualWeightLb: parsed.data.actualWeightLb,
    sameDayApproved: parsed.data.sameDayApproved,
    surcharges:
      parsed.data.surchargeAmountCents && parsed.data.surchargeAmountCents > 0
        ? [{ description: parsed.data.surchargeNotes || "Surcharge", amountCents: parsed.data.surchargeAmountCents }]
        : [],
  });

  const { error } = await supabase
    .from("bookings")
    .update(buildQuoteUpdatePayload(parsed.data, quoteResult, user.id))
    .eq("id", bookingId);

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
    .select("quote_status, actual_weight_lb")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Couldn't find that booking." };
  }

  if (!canMarkQuoteSent(booking)) {
    return { error: "Save a weighed quote before marking it sent." };
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
