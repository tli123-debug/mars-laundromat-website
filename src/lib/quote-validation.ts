import { z } from "zod";
import type { QuoteStatus, ServiceSpeed, ServiceType } from "@/types/database.types";
import { calculateQuote, type QuoteResult } from "@/lib/pricing/calculate-quote";
import { calculateDryCleaningEffectiveCharge } from "@/lib/pricing/dry-cleaning-charge";
import { serviceTypeIncludesDryCleaning, serviceTypeIncludesWashAndFold } from "@/lib/service-type";

export const quoteEntrySchema = z.object({
  actualWeightLb: z.number().finite().nonnegative(),
  sameDayApproved: z.boolean(),
  surchargeAmountCents: z.number().int().nonnegative().optional(),
  surchargeNotes: z.string().trim().max(500).optional(),
});

export type QuoteEntryInput = z.infer<typeof quoteEntrySchema>;

/**
 * Rounds a dollar amount to the nearest cent. Throws on anything that isn't
 * a real, non-negative number — a malformed or non-numeric form value
 * becomes NaN before it ever reaches here, and NaN/Infinity must be caught
 * explicitly rather than silently propagating into a bad surcharge total.
 */
export function dollarsToCents(dollars: number): number {
  if (!Number.isFinite(dollars)) {
    throw new Error("Amount must be a valid number");
  }
  if (dollars < 0) {
    throw new Error("Amount cannot be negative");
  }
  return Math.round(dollars * 100);
}

/**
 * The same-day fee only ever applies when the booking's actual service_speed
 * is same_day. Callers must check this against a row fetched fresh from the
 * database, never against client-submitted input alone.
 */
export function canApplySameDayFee(serviceSpeed: ServiceSpeed, sameDayApproved: boolean): boolean {
  return sameDayApproved && serviceSpeed === "same_day";
}

/**
 * A quote can only be marked sent once it's a saved draft with a real
 * (positive) weight — never from an empty/not-started quote, and never
 * re-sent from an already-sent one (editing a sent quote drops it back to
 * draft first; see buildQuoteUpdatePayload).
 */
export function canMarkQuoteSent(booking: {
  quote_status: QuoteStatus;
  actual_weight_lb: number | null;
}): boolean {
  return (
    booking.quote_status === "draft" &&
    booking.actual_weight_lb !== null &&
    booking.actual_weight_lb > 0
  );
}

/**
 * The exact payload for saving a quote as a draft. Any save — including
 * editing a previously-sent quote — clears quote_sent_at back to null,
 * since the total may have just changed and a stale "sent" total would be
 * actively misleading.
 */
export function buildQuoteUpdatePayload(input: QuoteEntryInput, quoteResult: QuoteResult, userId: string) {
  return {
    actual_weight_lb: input.actualWeightLb,
    billable_weight_lb: quoteResult.billableWeightLb,
    laundry_charge_cents: quoteResult.laundryChargeCents,
    same_day_fee_cents: quoteResult.sameDayFeeCents,
    surcharge_total_cents: quoteResult.surchargeTotalCents,
    surcharge_notes: input.surchargeNotes && input.surchargeNotes.length > 0 ? input.surchargeNotes : null,
    quote_status: "draft" as const,
    quote_sent_at: null,
    updated_by: userId,
  };
}

// ---------------------------------------------------------------------------
// Service-type-aware API (Dry Cleaning & Ironing expansion). Everything above
// this line is untouched and still exactly what bookings/[id]/actions.ts
// calls today — these are new, separately-named additions so Checkpoint 1
// doesn't have to touch that already-shipped file's call sites. It's the
// intended cutover target for a later checkpoint's rewrite of that file, at
// which point the wash-and-fold-only functions above become dead code.
// ---------------------------------------------------------------------------

export const serviceQuoteEntrySchema = z.object({
  actualWeightLb: z.number().finite().nonnegative().optional(),
  sameDayApproved: z.boolean(),
  dryCleaningItemSubtotalCents: z.number().int().nonnegative().optional(),
  surchargeAmountCents: z.number().int().nonnegative().optional(),
  surchargeNotes: z.string().trim().max(500).optional(),
});

export type ServiceQuoteEntryInput = z.infer<typeof serviceQuoteEntrySchema>;

/**
 * Service-type-aware replacement for canApplySameDayFee(). The $10 fee is
 * only ever legal on a booking that is BOTH actually wash_and_fold AND
 * actually same_day — both checked against values fetched fresh from the
 * database, never trusted from client input. The original
 * canApplySameDayFee(serviceSpeed, sameDayApproved) is left untouched for
 * its existing wash-and-fold-only call site, which never handles any other
 * service type and so never needed a service_type parameter.
 */
export function canApplySameDayFeeForServiceType(
  serviceType: ServiceType,
  serviceSpeed: ServiceSpeed,
  sameDayApproved: boolean
): boolean {
  return sameDayApproved && serviceType === "wash_and_fold" && serviceSpeed === "same_day";
}

/**
 * Business-rule validation, kept separate from serviceQuoteEntrySchema's
 * shape validation the same way validateProposedTime() is kept separate
 * from its own Zod schema in time-proposal-validation.ts — this is called
 * by a Server Action *after* it fetches the booking's authoritative
 * service_type AND service_speed, never trusting client-submitted values
 * for either.
 *
 * Requires a strictly positive weight for wash_and_fold/both — 0 is
 * rejected the same way it's rejected for a dry-cleaning subtotal, since a
 * real wash-and-fold order is never legitimately weighed at exactly 0 lb.
 * Requires a strictly positive dry-cleaning subtotal for dry_cleaning/both
 * — every approved garment price is positive, so $0 can only mean "nothing
 * entered," never a real priced order that happens to hit the $30 minimum
 * (that flooring happens later, in calculateDryCleaningEffectiveCharge).
 * Rejects sameDayApproved outright unless the booking is actually
 * wash_and_fold AND actually same_day.
 */
export function validateQuoteEntryForServiceType(
  serviceType: ServiceType,
  serviceSpeed: ServiceSpeed,
  input: ServiceQuoteEntryInput
): string | null {
  if (serviceTypeIncludesWashAndFold(serviceType)) {
    if (input.actualWeightLb === undefined || input.actualWeightLb <= 0) {
      return "Enter a weight greater than 0 for this booking's Wash & Fold items.";
    }
  }
  if (serviceTypeIncludesDryCleaning(serviceType)) {
    if (input.dryCleaningItemSubtotalCents === undefined || input.dryCleaningItemSubtotalCents <= 0) {
      return "Enter a dry-cleaning item subtotal greater than $0.";
    }
  }
  if (input.sameDayApproved && !canApplySameDayFeeForServiceType(serviceType, serviceSpeed, true)) {
    return "This booking isn't Same-Day Rush — the $10 fee doesn't apply.";
  }
  return null;
}

/**
 * Service-type-aware replacement for canMarkQuoteSent(). wash_and_fold
 * needs a real (>0) weight, exactly like the original. dry_cleaning needs a
 * real (>0) item subtotal — presence alone isn't enough, since $0 can only
 * mean "not entered," not a legitimately-priced order (see
 * validateQuoteEntryForServiceType). both needs both.
 */
export function canMarkQuoteSentForServiceType(booking: {
  quote_status: QuoteStatus;
  service_type: ServiceType;
  actual_weight_lb: number | null;
  dry_cleaning_item_subtotal_cents: number | null;
}): boolean {
  if (booking.quote_status !== "draft") return false;

  const weightOk = booking.actual_weight_lb !== null && booking.actual_weight_lb > 0;
  const drySubtotalOk =
    booking.dry_cleaning_item_subtotal_cents !== null && booking.dry_cleaning_item_subtotal_cents > 0;

  if (booking.service_type === "wash_and_fold") return weightOk;
  if (booking.service_type === "dry_cleaning") return drySubtotalOk;
  return weightOk && drySubtotalOk;
}

/**
 * Service-type-aware replacement for buildQuoteUpdatePayload(). Computes
 * calculateQuote() for the wash-and-fold portion (when applicable) and
 * calculateDryCleaningEffectiveCharge() for the dry-cleaning portion (when
 * applicable) — "the same tested rules" the live admin preview also uses.
 * Surcharges are computed once, independent of either portion, matching the
 * existing single optional (amount, notes) pair model.
 *
 * dry_cleaning_item_subtotal_cents and dry_cleaning_effective_charge_cents
 * are always written together, in this one object, never one without the
 * other — satisfying bookings_dry_cleaning_amounts_check's atomicity
 * requirement by construction. Both keys are omitted entirely for a
 * wash_and_fold-only quote: they're already null from creation or from a
 * prior service-type correction (buildServiceTypeChangePayload), so nothing
 * needs to re-null them.
 *
 * Never trusts input.sameDayApproved directly — re-derives eligibility via
 * canApplySameDayFeeForServiceType() from the authoritative serviceType/
 * serviceSpeed passed in, so this function can't construct an invalid
 * same-day fee (e.g. on a 'both' booking, or a Standard/Flexible
 * wash_and_fold one) even if a caller skipped calling
 * validateQuoteEntryForServiceType() first. The database would reject such
 * a payload too (bookings_same_day_fee_check), but domain logic shouldn't
 * rely on the database to catch what it can just never construct.
 */
export function buildServiceQuoteUpdatePayload(
  serviceType: ServiceType,
  serviceSpeed: ServiceSpeed,
  input: ServiceQuoteEntryInput,
  userId: string
) {
  const surchargeTotalCents =
    input.surchargeAmountCents && input.surchargeAmountCents > 0 ? input.surchargeAmountCents : 0;
  const surchargeNotesValue =
    input.surchargeNotes && input.surchargeNotes.length > 0 ? input.surchargeNotes : null;

  const sameDayApproved = canApplySameDayFeeForServiceType(serviceType, serviceSpeed, input.sameDayApproved);

  // Ternaries to `undefined` (not `let` + reassign to `{}`) so TypeScript
  // keeps each branch's literal shape and treats the spread-in properties
  // below as optional on the result, rather than widening them away to an
  // untyped record the caller couldn't access by name.
  const quoteResult =
    serviceTypeIncludesWashAndFold(serviceType) && input.actualWeightLb !== undefined
      ? calculateQuote({ actualWeightLb: input.actualWeightLb, sameDayApproved })
      : undefined;

  const washAndFoldFields = quoteResult
    ? {
        actual_weight_lb: input.actualWeightLb,
        billable_weight_lb: quoteResult.billableWeightLb,
        laundry_charge_cents: quoteResult.laundryChargeCents,
        same_day_fee_cents: quoteResult.sameDayFeeCents,
      }
    : undefined;

  const dryCleaningFields =
    serviceTypeIncludesDryCleaning(serviceType) && input.dryCleaningItemSubtotalCents !== undefined
      ? {
          dry_cleaning_item_subtotal_cents: input.dryCleaningItemSubtotalCents,
          dry_cleaning_effective_charge_cents: calculateDryCleaningEffectiveCharge(
            serviceType,
            input.dryCleaningItemSubtotalCents
          ),
        }
      : undefined;

  return {
    ...washAndFoldFields,
    ...dryCleaningFields,
    surcharge_total_cents: surchargeTotalCents,
    surcharge_notes: surchargeNotesValue,
    quote_status: "draft" as const,
    quote_sent_at: null,
    updated_by: userId,
  };
}
