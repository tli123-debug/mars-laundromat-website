import type { ServiceType } from "@/types/database.types";

/**
 * The owner-approved dry-cleaning-only minimum. Kept in sync with the
 * database's bookings_dry_cleaning_amounts_check CHECK constraint (see
 * supabase/migrations/20260826000000_dry_cleaning_expansion.sql) — if this
 * figure ever changes, that CHECK needs updating too.
 */
export const DRY_CLEANING_MINIMUM_CENTS = 3000;

/**
 * The effective dry-cleaning charge after the minimum-or-waived rule:
 * - wash_and_fold: no dry-cleaning charge at all.
 * - dry_cleaning (alone): the $30 minimum applies — greatest(subtotal, $30).
 * - both: no separate minimum: the actual item subtotal, full stop.
 *
 * itemSubtotalCents is expected to already be a real, positive, staff-
 * entered amount (see validateQuoteEntryForServiceType in
 * quote-validation.ts, which rejects $0/missing before this is ever
 * called) — this function doesn't re-validate that itself, it's purely the
 * pricing formula.
 */
export function calculateDryCleaningEffectiveCharge(
  serviceType: ServiceType,
  itemSubtotalCents: number
): number {
  if (serviceType === "wash_and_fold") return 0;
  if (serviceType === "dry_cleaning") return Math.max(itemSubtotalCents, DRY_CLEANING_MINIMUM_CENTS);
  return itemSubtotalCents;
}
