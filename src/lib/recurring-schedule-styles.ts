import type { RecurringBadgeKind } from "@/lib/recurring-schedule";

/**
 * Color treatment for RecurringBadge — a Record<RecurringBadgeKind, string>
 * so a future badge kind without an entry is a compile error, not a
 * silently unstyled badge. Chosen to stay visually distinct from the
 * colors the earlier admin polish checkpoint already claimed elsewhere
 * (blue/red/purple for service type, red/green/blue/orange for status,
 * green for paid) so a card showing several badges together stays
 * scannable rather than blurring together.
 */
export const RECURRING_BADGE_STYLES: Record<RecurringBadgeKind, string> = {
  weekly: "border-sky-200 bg-sky-50 text-sky-900",
  every_two_weeks: "border-indigo-200 bg-indigo-50 text-indigo-900",
  paused: "border-amber-200 bg-amber-50 text-amber-900",
  cancelled: "border-gray-300 bg-gray-100 text-gray-600",
};
