import { z } from "zod";
import type { QuoteStatus, ServiceSpeed } from "@/types/database.types";
import type { QuoteResult } from "@/lib/pricing/calculate-quote";

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
 * The $5 same-day fee only ever applies when the booking's actual
 * service_speed is same_day. Callers must check this against a row fetched
 * fresh from the database, never against client-submitted input alone.
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
