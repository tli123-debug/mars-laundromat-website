import type { BookingStatus } from "@/types/database.types";

/**
 * Per-status color treatment for StatusSelect's trigger (always visible, so
 * the current status reads at a glance without opening the dropdown) and
 * its dropdown items (text color only, for quick scanning). Completed and
 * Cancelled deliberately stay on the Select's own neutral styling — both
 * are archived outcomes, not active states that need to draw attention.
 * A Record<BookingStatus, ...> keeps this exhaustive: adding a new
 * BookingStatus without an entry here is a compile error, not a silently
 * unstyled status. The empty strings for completed/cancelled are that
 * deliberate "no override" choice, not a missing entry.
 */
export const BOOKING_STATUS_STYLES: Record<BookingStatus, { trigger: string; item: string }> = {
  pending: { trigger: "border-red-200 bg-red-50 text-red-900", item: "text-red-900" },
  confirmed: { trigger: "border-green-200 bg-green-50 text-green-900", item: "text-green-900" },
  picked_up: { trigger: "border-blue-200 bg-blue-50 text-blue-900", item: "text-blue-900" },
  ready_for_delivery: {
    trigger: "border-orange-200 bg-orange-50 text-orange-900",
    item: "text-orange-900",
  },
  completed: { trigger: "", item: "" },
  cancelled: { trigger: "", item: "" },
};
