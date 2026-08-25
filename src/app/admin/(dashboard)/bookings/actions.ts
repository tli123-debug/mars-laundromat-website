"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import { buildMarkPaidPayload, buildMarkUnpaidPayload } from "@/lib/payment";
import type { BookingStatus, PaymentMethod } from "@/types/database.types";

const VALID_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "picked_up",
  "ready_for_delivery",
  "out_for_delivery",
  "completed",
  "cancelled",
];

const VALID_PAYMENT_METHODS: PaymentMethod[] = ["cash", "zelle"];

function revalidateBookingPaths(bookingId: string) {
  revalidatePath("/admin/today");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const user = await requireAdmin();

  if (!VALID_STATUSES.includes(status)) {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();
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
