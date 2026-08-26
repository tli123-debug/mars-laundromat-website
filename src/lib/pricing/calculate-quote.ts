/**
 * Pure pricing calculation — no UI, no database, no I/O. Mirrors exactly what
 * `quote_total_cents` computes as a generated column in the bookings table
 * (see supabase/migrations/20260822000000_pickup_delivery_v1.sql), so this
 * function's output should always match what a row's generated column would
 * show once laundry_charge_cents/same_day_fee_cents/surcharge_total_cents are
 * written from this function's result.
 */

// Exported so customer-facing pricing copy (src/content/booking.ts,
// src/content/services.ts) can reference these numbers directly instead of
// hardcoding a second copy that could silently drift from the actual formula.
export const MINIMUM_BILLABLE_WEIGHT_LB = 20;
export const PRICE_PER_POUND_CENTS = 150;
export const MINIMUM_ORDER_CENTS = MINIMUM_BILLABLE_WEIGHT_LB * PRICE_PER_POUND_CENTS;
export const SAME_DAY_FEE_CENTS = 1000;

export interface SurchargeLineItem {
  description: string;
  amountCents: number;
}

export interface QuoteInput {
  actualWeightLb: number;
  sameDayApproved?: boolean;
  surcharges?: SurchargeLineItem[];
}

export interface QuoteResult {
  billableWeightLb: number;
  laundryChargeCents: number;
  sameDayFeeCents: number;
  surchargeTotalCents: number;
  totalCents: number;
  surcharges: SurchargeLineItem[];
}

export function calculateQuote(input: QuoteInput): QuoteResult {
  const { actualWeightLb, sameDayApproved = false, surcharges = [] } = input;

  if (!Number.isFinite(actualWeightLb)) {
    throw new Error("actualWeightLb must be a finite number");
  }
  if (actualWeightLb < 0) {
    throw new Error("actualWeightLb cannot be negative");
  }

  for (const surcharge of surcharges) {
    if (!Number.isInteger(surcharge.amountCents)) {
      throw new Error(`Surcharge "${surcharge.description}" amountCents must be an integer`);
    }
    if (surcharge.amountCents < 0) {
      throw new Error(`Surcharge "${surcharge.description}" amountCents cannot be negative`);
    }
  }

  // Math.round() rounds .5 toward +Infinity, i.e. up — exactly the "half-pound
  // rounds up" rule, and exact for .5 inputs since N.5 is always precisely
  // representable in binary floating point (actualWeightLb is never negative
  // here, so there's no "rounds toward zero vs away from zero" ambiguity).
  const roundedWeightLb = Math.round(actualWeightLb);
  const billableWeightLb = Math.max(MINIMUM_BILLABLE_WEIGHT_LB, roundedWeightLb);

  const laundryChargeCents = billableWeightLb * PRICE_PER_POUND_CENTS;

  const sameDayFeeCents = sameDayApproved ? SAME_DAY_FEE_CENTS : 0;

  const surchargeTotalCents = surcharges.reduce((sum, s) => sum + s.amountCents, 0);

  const totalCents = laundryChargeCents + sameDayFeeCents + surchargeTotalCents;

  return {
    billableWeightLb,
    laundryChargeCents,
    sameDayFeeCents,
    surchargeTotalCents,
    totalCents,
    surcharges,
  };
}
