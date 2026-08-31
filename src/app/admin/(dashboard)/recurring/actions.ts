"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import { advanceByCadence, advanceToDueDate, decideSkipNextOccurrence } from "@/lib/recurring-schedule";
import { getBrooklynToday } from "@/lib/booking-hours";

function revalidateSchedulePaths(sourceBookingId?: string | null) {
  revalidatePath("/admin/recurring");
  revalidatePath("/admin/today");
  revalidatePath("/admin/bookings");
  if (sourceBookingId) revalidatePath(`/admin/bookings/${sourceBookingId}`);
}

export async function pauseSchedule(scheduleId: string) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: schedule, error: fetchError } = await supabase
    .from("recurring_schedules")
    .select("status, source_booking_id")
    .eq("id", scheduleId)
    .single();

  if (fetchError || !schedule) {
    return { error: "Couldn't find that recurring schedule." };
  }
  if (schedule.status !== "active") {
    return { error: "Only an active schedule can be paused." };
  }

  const { error } = await supabase
    .from("recurring_schedules")
    .update({ status: "paused", paused_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", scheduleId);

  if (error) {
    console.error("Pause recurring schedule failed:", error);
    return { error: "Something went wrong pausing that schedule." };
  }

  revalidateSchedulePaths(schedule.source_booking_id);
  return { error: null };
}

export async function resumeSchedule(scheduleId: string) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: schedule, error: fetchError } = await supabase
    .from("recurring_schedules")
    .select("status, next_pickup_date, frequency, source_booking_id")
    .eq("id", scheduleId)
    .single();

  if (fetchError || !schedule) {
    return { error: "Couldn't find that recurring schedule." };
  }
  if (schedule.status !== "paused") {
    return { error: "Only a paused schedule can be resumed." };
  }

  // Mirrors generate_due_recurring_bookings()'s own stale-date advancement
  // exactly (see advanceToDueDate's doc comment) — a schedule paused for
  // three weeks resumes pointed at the next real future occurrence, never
  // at a string of missed dates it would otherwise try to backfill.
  const nextPickupDate = advanceToDueDate(schedule.next_pickup_date, schedule.frequency, getBrooklynToday());

  const { error } = await supabase
    .from("recurring_schedules")
    .update({
      status: "active",
      paused_at: null,
      next_pickup_date: nextPickupDate,
      updated_by: user.id,
    })
    .eq("id", scheduleId);

  if (error) {
    console.error("Resume recurring schedule failed:", error);
    return { error: "Something went wrong resuming that schedule." };
  }

  revalidateSchedulePaths(schedule.source_booking_id);
  return { error: null };
}

export async function cancelSchedule(scheduleId: string) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: schedule, error: fetchError } = await supabase
    .from("recurring_schedules")
    .select("status, source_booking_id")
    .eq("id", scheduleId)
    .single();

  if (fetchError || !schedule) {
    return { error: "Couldn't find that recurring schedule." };
  }
  if (schedule.status === "cancelled") {
    return { error: "This schedule is already cancelled." };
  }

  // Status update only — never touches any generated booking, and never
  // deletes schedule history. A cancelled schedule can be replaced by a
  // brand-new one later if the customer wants to restart.
  const { error } = await supabase
    .from("recurring_schedules")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_by: user.id })
    .eq("id", scheduleId);

  if (error) {
    console.error("Cancel recurring schedule failed:", error);
    return { error: "Something went wrong cancelling that schedule." };
  }

  revalidateSchedulePaths(schedule.source_booking_id);
  return { error: null };
}

/**
 * Fetches whatever booking (if any) already exists for the occurrence
 * about to be skipped, then defers the actual three-way decision to
 * decideSkipNextOccurrence() in recurring-schedule.ts — see that
 * function's doc comment for the full outcome breakdown. This action is
 * just the database orchestration around that pure decision.
 */
export async function skipNextOccurrence(scheduleId: string) {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: schedule, error: fetchError } = await supabase
    .from("recurring_schedules")
    .select("status, next_pickup_date, frequency, source_booking_id")
    .eq("id", scheduleId)
    .single();

  if (fetchError || !schedule) {
    return { error: "Couldn't find that recurring schedule." };
  }
  if (schedule.status !== "active") {
    return { error: "Only an active schedule can skip its next occurrence." };
  }

  const { data: existingBooking, error: bookingLookupError } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("recurring_schedule_id", scheduleId)
    .eq("recurring_occurrence_date", schedule.next_pickup_date)
    .maybeSingle();

  if (bookingLookupError) {
    console.error("Skip next occurrence lookup failed:", bookingLookupError);
    return { error: "Something went wrong checking for that occurrence's booking." };
  }

  const outcome = decideSkipNextOccurrence(existingBooking);

  if (outcome.action === "rejected") {
    return { error: outcome.reason };
  }

  if (outcome.action === "cancel_and_advance") {
    const { error: cancelError } = await supabase
      .from("bookings")
      .update({ status: "cancelled", updated_by: user.id })
      .eq("id", outcome.bookingId);

    if (cancelError) {
      console.error("Skip next occurrence: cancelling the generated booking failed:", cancelError);
      return { error: "Something went wrong cancelling that occurrence's booking." };
    }
  }

  // Both remaining outcomes (advance_only, cancel_and_advance) advance the
  // schedule the same way — a single explicit cadence step past the
  // occurrence just skipped, not advanceToDueDate() (which is for
  // catching a STALE date up to today and would be a no-op here, since
  // next_pickup_date is the upcoming occurrence, not a missed one).
  const nextPickupDate = advanceByCadence(schedule.next_pickup_date, schedule.frequency);

  const { error: advanceError } = await supabase
    .from("recurring_schedules")
    .update({ next_pickup_date: nextPickupDate, updated_by: user.id })
    .eq("id", scheduleId);

  if (advanceError) {
    console.error("Skip next occurrence: advancing the schedule failed:", advanceError);
    return { error: "Something went wrong advancing that schedule." };
  }

  revalidateSchedulePaths(schedule.source_booking_id);
  return { error: null };
}
