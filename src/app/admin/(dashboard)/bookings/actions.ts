"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/types/database.types";

const VALID_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "picked_up",
  "ready_for_delivery",
  "out_for_delivery",
  "completed",
  "cancelled",
];

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

  revalidatePath("/admin/today");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { error: null };
}

export async function updateBookingPaid(bookingId: string, paid: boolean) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ paid })
    .eq("id", bookingId);

  if (error) {
    console.error("Paid update failed:", error);
    return { error: "Something went wrong updating that booking." };
  }

  revalidatePath("/admin/bookings");
  return { error: null };
}
