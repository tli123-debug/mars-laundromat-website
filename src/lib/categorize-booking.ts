import type { BookingStatus, Database } from "@/types/database.types";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
type CategorizableBooking = Pick<
  BookingRow,
  "status" | "confirmed_pickup_date" | "confirmed_delivery_date" | "paid" | "quote_status"
>;

/**
 * Active vs Archived is a coarser lifecycle split than the Today-board
 * columns below: Active is every non-terminal status (still something to
 * do), Archived is either terminal status (done, nothing left to do). No
 * archived_at column exists — the terminal status itself is the archive
 * boundary. Shared by the Today board (must only ever fetch Active
 * bookings) and the All Bookings page's Active/Archived/All filter
 * (src/app/admin/(dashboard)/bookings/view-filter.ts), so the two views can
 * never silently disagree about what counts as archived.
 */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "picked_up",
  "ready_for_delivery",
];
export const ARCHIVED_BOOKING_STATUSES: BookingStatus[] = ["completed", "cancelled"];

export type BookingColumn =
  | "pending_review"
  | "awaiting_customer"
  | "todays_pickups"
  | "at_store"
  | "ready_for_delivery"
  | "todays_deliveries"
  | "unpaid";

/**
 * Derives Today-board column membership from existing fields — no new status
 * values exist for "awaiting customer" or "at store" (see the schema
 * migration's own comment). A booking can land in multiple columns at once
 * (fulfillment stage and payment are orthogonal, e.g. "ready_for_delivery"
 * + "unpaid"); `cancelled` always returns [] regardless of any other field.
 *
 * Date checks use `<=`, not `=` — equality would silently drop an overdue
 * booking off the board entirely the moment midnight passes without the
 * status advancing (a missed pickup or a late delivery should stay visible
 * as urgent, not vanish).
 *
 * "Awaiting Customer" = pending + a proposed time already set. This is
 * deliberately NOT derived from quote_status (an earlier reading this
 * codebase considered) — a quote can't exist before weighing, so that
 * reading would make this column fire in nearly the same conditions as
 * "unpaid," two board columns for almost the same state. This reading also
 * matches the original spec's lifecycle ordering (Awaiting Customer sits
 * between Pending Review and Confirmed), and is the literal state the admin
 * "Save Proposed Time" action produces — not just an interpretation of
 * ambiguous data.
 */
export function categorizeBooking(booking: CategorizableBooking, today: string): BookingColumn[] {
  if (booking.status === "cancelled") return [];

  const columns: BookingColumn[] = [];

  if (booking.status === "pending") {
    columns.push(booking.confirmed_pickup_date === null ? "pending_review" : "awaiting_customer");
  }

  if (
    booking.status === "confirmed" &&
    (booking.confirmed_pickup_date === null || booking.confirmed_pickup_date <= today)
  ) {
    columns.push("todays_pickups");
  }

  if (booking.status === "picked_up") {
    // Whole status, not split by weight — physical presence at the shop
    // doesn't expire, and something already picked up doesn't intuitively
    // belong under a column literally named "Pickups."
    columns.push("at_store");
  }

  if (booking.status === "ready_for_delivery") {
    columns.push("ready_for_delivery");
  }

  if (
    booking.status === "ready_for_delivery" &&
    (booking.confirmed_delivery_date === null || booking.confirmed_delivery_date <= today)
  ) {
    columns.push("todays_deliveries");
  }

  if (!booking.paid && booking.quote_status === "sent") {
    columns.push("unpaid");
  }

  return columns;
}
