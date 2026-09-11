"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import { buildMarkPaidPayload, buildMarkUnpaidPayload } from "@/lib/payment";
import { canAdvanceToStatus, hasRecordedPayment } from "@/lib/time-proposal-validation";
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
 * ready_for_delivery, and completed. Completed additionally requires a
 * recorded Cash/Zelle payment. All prerequisite fields are re-fetched here
 * rather than trusted from the browser: disabled UI is helpful guidance,
 * but the Server Action remains the security boundary.
 */
export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const user = await requireAdmin();

  if (!VALID_STATUSES.includes(status)) {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select(
      "confirmed_pickup_date, confirmed_pickup_time, confirmed_delivery_date, confirmed_delivery_time, paid, payment_method"
    )
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return { error: "Couldn't find that booking." };
  }

  if (status === "completed" && !hasRecordedPayment(booking)) {
    return {
      error:
        "Record payment as Cash or Zelle before marking this booking completed. 完成预约前，请先记录现金或 Zelle 付款。",
    };
  }

  if (!canAdvanceToStatus(status, booking)) {
    return {
      error:
        "Confirm both the pickup and delivery schedule before advancing this booking. 请先确认取件和送件时间，再更改此预约的状态。",
    };
  }

  if (status === "completed") {
    // Keep the payment prerequisite true at the actual write, not merely at
    // the fetch above, so a second admin action cannot race this completion.
    const { data, error } = await supabase
      .from("bookings")
      .update({ status, updated_by: user.id })
      .eq("id", bookingId)
      .eq("paid", true)
      .in("payment_method", VALID_PAYMENT_METHODS)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Status update failed:", error);
      return { error: "Something went wrong updating that booking." };
    }
    if (!data) {
      return {
        error:
          "Payment changed before completion was saved. Refresh, record Cash or Zelle payment, and try again. 付款状态已更改，请刷新后重新记录付款。",
      };
    }
  } else {
    const { error } = await supabase
      .from("bookings")
      .update({ status, updated_by: user.id })
      .eq("id", bookingId);

    if (error) {
      console.error("Status update failed:", error);
      return { error: "Something went wrong updating that booking." };
    }
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
  // A completed booking must remain paid. Staff can reopen its status first
  // if a genuine payment correction is required.
  const { data, error } = await supabase
    .from("bookings")
    .update(buildMarkUnpaidPayload(user.id))
    .eq("id", bookingId)
    .neq("status", "completed")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Mark unpaid failed:", error);
    return { error: "Something went wrong updating that booking." };
  }
  if (!data) {
    return {
      error:
        "Reopen this completed booking before changing it back to unpaid. 如需更正付款，请先重新打开已完成的预约。",
    };
  }

  revalidateBookingPaths(bookingId);
  return { error: null };
}
