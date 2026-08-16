"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/types/database.types";

const VALID_STATUSES: BookingStatus[] = ["pending", "confirmed", "completed", "cancelled"];

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  await requireAdmin();

  if (!VALID_STATUSES.includes(status)) {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);

  if (error) {
    console.error("Status update failed:", error);
    return { error: "Something went wrong updating that booking." };
  }

  revalidatePath("/admin/bookings");
  return { error: null };
}
