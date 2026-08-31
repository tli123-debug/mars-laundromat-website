"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import {
  advanceByCadence,
  advanceToNextAvailablePickup,
  buildCancelSchedulePayload,
  decideSkipNextOccurrence,
} from "@/lib/recurring-schedule";
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
    .select("status, next_pickup_date, frequency, pickup_time, source_booking_id")
    .eq("id", scheduleId)
    .single();

  if (fetchError || !schedule) {
    return { error: "Couldn't find that recurring schedule." };
  }
  if (schedule.status !== "paused") {
    return { error: "Only a paused schedule can be resumed." };
  }

  // Catches up a stale date the same way generate_due_recurring_bookings()
  // does (a schedule paused for three weeks resumes pointed at the next
  // real future occurrence, never a string of missed dates it would
  // otherwise try to backfill) — AND additionally advances past today if
  // today's own pickup window has already started or passed in Brooklyn
  // time (e.g. resuming a 9:00-10:00 AM schedule at 5:00 PM today), which
  // a date-only check can't catch. See advanceToNextAvailablePickup()'s
  // own doc comment.
  const nextPickupDate = advanceToNextAvailablePickup(
    schedule.next_pickup_date,
    schedule.frequency,
    schedule.pickup_time
  );

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
  // buildCancelSchedulePayload() explicitly nulls paused_at regardless of
  // whether this schedule was active or paused beforehand — cancelling
  // FROM paused without clearing it would leave paused_at non-null on a
  // cancelled row, which recurring_schedules_status_timestamps_check
  // rejects outright.
  const { error } = await supabase
    .from("recurring_schedules")
    .update(buildCancelSchedulePayload(user.id))
    .eq("id", scheduleId);

  if (error) {
    console.error("Cancel recurring schedule failed:", error);
    return { error: "Something went wrong cancelling that schedule." };
  }

  revalidateSchedulePaths(schedule.source_booking_id);
  return { error: null };
}

/**
 * Finds the earliest non-cancelled generated booking for this schedule
 * dated today-or-later and no later than nextPickupDate — the SQL
 * generator advances next_pickup_date the instant it creates a booking,
 * so the real "next upcoming occurrence" is normally dated BEFORE
 * nextPickupDate, not at it (the upper bound is inclusive only to
 * defensively cover the edge case where it happens to equal it — see
 * decideSkipNextOccurrence()). Cancelled bookings are excluded outright:
 * an already-cancelled occurrence has, by definition, already been
 * skipped, so it's treated the same as "nothing generated yet."
 * "Earliest" and the lower bound both guard against a stale/duplicate
 * historical row ever being mistaken for the upcoming one.
 */
async function findUpcomingRecurringBooking(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scheduleId: string,
  nextPickupDate: string
) {
  return supabase
    .from("bookings")
    .select("id, status, recurring_occurrence_date")
    .eq("recurring_schedule_id", scheduleId)
    .neq("status", "cancelled")
    .gte("recurring_occurrence_date", getBrooklynToday())
    .lte("recurring_occurrence_date", nextPickupDate)
    .order("recurring_occurrence_date", { ascending: true })
    .limit(1)
    .maybeSingle();
}

/**
 * Fetches whatever booking (if any) already exists for the occurrence
 * about to be skipped, then defers the actual decision to
 * decideSkipNextOccurrence() in recurring-schedule.ts — see that
 * function's doc comment for the full outcome breakdown and why
 * nextPickupDate is NOT unconditionally advanced here. Every write is a
 * conditional update (WHERE the row still matches what was just read) so
 * a concurrent generator run — which can cancel nothing but does insert
 * bookings and advance next_pickup_date — can't cause this action to
 * silently cancel the wrong booking or double-advance a pointer that
 * already moved: a conditional update that matches zero rows is reported
 * back as "please retry" instead of applied blindly.
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

  const { data: upcoming, error: lookupError } = await findUpcomingRecurringBooking(
    supabase,
    scheduleId,
    schedule.next_pickup_date
  );

  if (lookupError) {
    console.error("Skip next occurrence lookup failed:", lookupError);
    return { error: "Something went wrong checking for that occurrence's booking." };
  }

  const outcome = decideSkipNextOccurrence(
    schedule.next_pickup_date,
    upcoming
      ? { id: upcoming.id, status: upcoming.status, occurrenceDate: upcoming.recurring_occurrence_date! }
      : null
  );

  if (outcome.action === "rejected") {
    return { error: outcome.reason };
  }

  if (outcome.action === "cancel_only" || outcome.action === "cancel_and_advance") {
    // Conditional on status still being 'pending' — if it changed between
    // the lookup above and this write (e.g. staff confirmed it in another
    // tab at the same moment), this affects zero rows instead of
    // cancelling a booking that isn't pending anymore.
    const { data: cancelledRows, error: cancelError } = await supabase
      .from("bookings")
      .update({ status: "cancelled", updated_by: user.id })
      .eq("id", outcome.bookingId)
      .eq("status", "pending")
      .select("id");

    if (cancelError) {
      console.error("Skip next occurrence: cancelling the generated booking failed:", cancelError);
      return { error: "Something went wrong cancelling that occurrence's booking." };
    }
    if (!cancelledRows || cancelledRows.length === 0) {
      return { error: "That booking changed while processing — please refresh and try again." };
    }
  }

  if (outcome.action === "cancel_only") {
    // The generator already advanced next_pickup_date past this
    // occurrence when it originally generated the booking — nothing left
    // to do to the schedule itself.
    revalidateSchedulePaths(schedule.source_booking_id);
    return { error: null };
  }

  // advance_only or cancel_and_advance: move the pointer forward one
  // cadence step — not advanceToDueDate()/advanceToNextAvailablePickup()
  // (both are for catching up a STALE pointer, which this isn't;
  // next_pickup_date here is the upcoming occurrence being skipped past).
  // Conditional on next_pickup_date still matching what was just read, so
  // a concurrent generator run that already advanced it can't be silently
  // double-advanced by this stale-read update.
  const nextPickupDate = advanceByCadence(schedule.next_pickup_date, schedule.frequency);
  const { data: advancedRows, error: advanceError } = await supabase
    .from("recurring_schedules")
    .update({ next_pickup_date: nextPickupDate, updated_by: user.id })
    .eq("id", scheduleId)
    .eq("next_pickup_date", schedule.next_pickup_date)
    .select("id");

  if (advanceError) {
    console.error("Skip next occurrence: advancing the schedule failed:", advanceError);
    return { error: "Something went wrong advancing that schedule." };
  }
  if (!advancedRows || advancedRows.length === 0) {
    return { error: "This schedule changed while processing — please refresh and try again." };
  }

  revalidateSchedulePaths(schedule.source_booking_id);
  return { error: null };
}
