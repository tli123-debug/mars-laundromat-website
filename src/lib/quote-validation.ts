import { z } from "zod";
import type { QuoteStatus, ServiceSpeed, ServiceType } from "@/types/database.types";
import { calculateQuote } from "@/lib/pricing/calculate-quote";
import { calculateDryCleaningEffectiveCharge } from "@/lib/pricing/dry-cleaning-charge";
import { serviceTypeIncludesDryCleaning, serviceTypeIncludesWashAndFold } from "@/lib/service-type";

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
 * database, never against client-submitted input alone. Kept alongside the
 * service-aware API below (used by quote-editor.tsx's client-side preview) —
 * service_speed alone fully determines same-day eligibility, since the
 * database's bookings_service_type_speed_consistency_check structurally
 * guarantees service_speed can only ever be 'same_day' on a wash_and_fold
 * booking.
 */
export function canApplySameDayFee(serviceSpeed: ServiceSpeed, sameDayApproved: boolean): boolean {
  return sameDayApproved && serviceSpeed === "same_day";
}

// ---------------------------------------------------------------------------
// Service-type-aware API (Dry Cleaning & Ironing expansion). This is the only
// API bookings/[id]/actions.ts calls as of Checkpoint 3's admin cutover — the
// original wash-and-fold-only quoteEntrySchema/canMarkQuoteSent/
// buildQuoteUpdatePayload (and calculateQuote's QuoteResult import they
// needed) have been retired now that nothing calls them.
// ---------------------------------------------------------------------------

export const serviceQuoteEntrySchema = z.object({
  actualWeightLb: z.number().finite().nonnegative().optional(),
  sameDayApproved: z.boolean(),
  dryCleaningItemSubtotalCents: z.number().int().nonnegative().optional(),
  dryCleaningNotes: z.string().trim().max(500).optional(),
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
 * Builds the exact update payload for saving a service-aware quote as a
 * draft. Computes calculateQuote() for the wash-and-fold portion (when
 * applicable) and calculateDryCleaningEffectiveCharge() for the dry-cleaning
 * portion (when applicable) — "the same tested rules" the live admin preview
 * also uses. Surcharges are computed once, independent of either portion,
 * matching the existing single optional (amount, notes) pair model.
 *
 * dry_cleaning_item_subtotal_cents, dry_cleaning_effective_charge_cents, and
 * dry_cleaning_notes are always written together, in this one object, never
 * one without the other — satisfying bookings_dry_cleaning_amounts_check's
 * atomicity requirement by construction (the CHECK itself doesn't govern
 * dry_cleaning_notes, but writing it in lockstep with the amounts keeps the
 * three from ever drifting apart). All three keys are omitted entirely for a
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
          dry_cleaning_notes:
            input.dryCleaningNotes && input.dryCleaningNotes.length > 0 ? input.dryCleaningNotes : null,
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
