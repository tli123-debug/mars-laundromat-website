import type { BookingStatus } from "@/types/database.types";
import { ACTIVE_BOOKING_STATUSES, ARCHIVED_BOOKING_STATUSES } from "@/lib/categorize-booking";

export type BookingView = "active" | "archived" | "all";

export const BOOKING_VIEW_OPTIONS: { value: BookingView; label: string }[] = [
  { value: "active", label: "Active 进行中" },
  { value: "archived", label: "Archived 已归档" },
  { value: "all", label: "All 全部" },
];

export function isBookingView(value: string | undefined): value is BookingView {
  return BOOKING_VIEW_OPTIONS.some((option) => option.value === value);
}

/**
 * The statuses a view should filter to, or null for "all" (no status filter
 * at all — every booking, active or archived).
 */
export function statusesForView(view: BookingView): BookingStatus[] | null {
  switch (view) {
    case "active":
      return ACTIVE_BOOKING_STATUSES;
    case "archived":
      return ARCHIVED_BOOKING_STATUSES;
    case "all":
      return null;
  }
}
