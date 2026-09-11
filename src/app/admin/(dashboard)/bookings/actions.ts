"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import { buildMarkPaidPayload, buildMarkUnpaidPayload } from "@/lib/payment";
import { canAdvanceToStatus } from "@/lib/time-proposal-validation";
import type { BookingStatus, PaymentMethod } from "@/types/database.types";

const VALID_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "picked_up",
  "ready_for_delivery",
  "completed",
  "cancelled",
];

const VALID_PAYMENT_METHODS: PaymentMethod[] = ["cash", "zelle"];

function revalidateBookingPaths(bookingId: string) {
  revalidatePath("/admin/today");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
}

/**
 * Confirmed pickup/delivery is a prerequisite for confirmed, picked_up,
 * ready_for_delivery, and completed (see canAdvanceToStatus in
 * time-proposal-validation.ts) — pending and cancelled remain reachable
 * regardless. The confirmed-time fields are always re-fetched here rather
 * than trusted from the browser: the UI already disables the gated options
 * when it can see the schedule is incomplete, but that's UX only, not the
 * security boundary — a direct call bypassing the disabled state must be
 * rejected the same way.
 */
export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const user = await requireAdmin();

  if (!VALID_STATUSES.includes(status)) {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("confirmed_pickup_date, confirmed_pickup_time, confirmed_delivery_date, confirmed_delivery_time")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Couldn't find that booking." };
  }

  if (!canAdvanceToStatus(status, booking)) {
    return {
      error:
        "Confirm both the pickup and delivery schedule before advancing this booking. 请先确认取件和送件时间，再更改此预约的状态。",
    };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status, updated_by: user.id })
    .eq("id", bookingId);

  if (error) {
    console.error("Status update failed:", error);
    return { error: "Something went wrong updating that booking." };
  }

  revalidateBookingPaths(bookingId);
  return { error: null };
}

// Replaces the old updateBookingPaid(bookingId, paid: boolean) — marking
// paid now always requires a method, and marking unpaid always clears it,
// via the shared PaymentControl component used on the table, the Today
// board, and the detail page alike.
export async function markBookingPaid(bookingId: string, method: PaymentMethod) {
  const user = await requireAdmin();

  if (!VALID_PAYMENT_METHODS.includes(method)) {
    return { error: "Invalid payment method." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update(buildMarkPaidPayload(method, user.id))
    .eq("id", bookingId);

  if (error) {
    console.error("Mark paid failed:", error);
    return { error: "Something went wrong updating that booking." };
  }

  revalidateBookingPaths(bookingId);
  return { error: null };
}

export async function markBookingUnpaid(bookingId: string) {
  const user = await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update(buildMarkUnpaidPayload(user.id))
    .eq("id", bookingId);

  if (error) {
    console.error("Mark unpaid failed:", error);
    return { error: "Something went wrong updating that booking." };
  }

  revalidateBookingPaths(bookingId);
  return { error: null };
}
