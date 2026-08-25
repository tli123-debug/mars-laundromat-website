import { describe, expect, it } from "vitest";
import {
  buildQuoteUpdatePayload,
  canApplySameDayFee,
  canMarkQuoteSent,
  dollarsToCents,
  quoteEntrySchema,
} from "./quote-validation";
import { calculateQuote } from "@/lib/pricing/calculate-quote";

describe("quoteEntrySchema", () => {
  it("accepts a minimal valid entry", () => {
    expect(quoteEntrySchema.safeParse({ actualWeightLb: 12, sameDayApproved: false }).success).toBe(true);
  });

  it("accepts a full entry with a surcharge", () => {
    const result = quoteEntrySchema.safeParse({
      actualWeightLb: 12,
      sameDayApproved: true,
      surchargeAmountCents: 500,
      surchargeNotes: "Extra-large comforter",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative weight", () => {
    expect(quoteEntrySchema.safeParse({ actualWeightLb: -1, sameDayApproved: false }).success).toBe(false);
  });

  it("rejects non-finite weight", () => {
    expect(quoteEntrySchema.safeParse({ actualWeightLb: NaN, sameDayApproved: false }).success).toBe(false);
    expect(quoteEntrySchema.safeParse({ actualWeightLb: Infinity, sameDayApproved: false }).success).toBe(
      false
    );
  });

  it("rejects a non-integer surcharge amount", () => {
    const result = quoteEntrySchema.safeParse({
      actualWeightLb: 10,
      sameDayApproved: false,
      surchargeAmountCents: 99.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative surcharge amount", () => {
    const result = quoteEntrySchema.safeParse({
      actualWeightLb: 10,
      sameDayApproved: false,
      surchargeAmountCents: -100,
    });
    expect(result.success).toBe(false);
  });
});

describe("dollarsToCents", () => {
  it("converts a typical dollar amount exactly", () => {
    expect(dollarsToCents(12.5)).toBe(1250);
  });

  it("handles a whole-dollar amount", () => {
    expect(dollarsToCents(5)).toBe(500);
  });

  it("handles zero", () => {
    expect(dollarsToCents(0)).toBe(0);
  });

  it("rounds to the nearest cent", () => {
    expect(dollarsToCents(9.999)).toBe(1000);
    expect(dollarsToCents(10.001)).toBe(1000);
  });

  it("rejects malformed (non-numeric) input", () => {
    expect(() => dollarsToCents(NaN)).toThrow(/valid number/i);
    expect(() => dollarsToCents(Infinity)).toThrow(/valid number/i);
  });

  it("rejects a negative amount", () => {
    expect(() => dollarsToCents(-5)).toThrow(/negative/i);
  });
});

describe("canApplySameDayFee", () => {
  it("allows the fee only when approved AND the booking is actually same_day", () => {
    expect(canApplySameDayFee("same_day", true)).toBe(true);
  });

  it("rejects when not approved, even on a same_day booking", () => {
    expect(canApplySameDayFee("same_day", false)).toBe(false);
  });

  it("rejects when approved but the booking isn't same_day", () => {
    expect(canApplySameDayFee("standard", true)).toBe(false);
    expect(canApplySameDayFee("flexible", true)).toBe(false);
  });
});

describe("canMarkQuoteSent", () => {
  it("allows sending a draft quote with a real weight", () => {
    expect(canMarkQuoteSent({ quote_status: "draft", actual_weight_lb: 15 })).toBe(true);
  });

  it("rejects a quote that was never started", () => {
    expect(canMarkQuoteSent({ quote_status: "not_started", actual_weight_lb: null })).toBe(false);
  });

  it("rejects an already-sent quote", () => {
    expect(canMarkQuoteSent({ quote_status: "sent", actual_weight_lb: 15 })).toBe(false);
  });

  it("rejects a draft with no weight recorded", () => {
    expect(canMarkQuoteSent({ quote_status: "draft", actual_weight_lb: null })).toBe(false);
  });

  it("rejects a draft with a zero weight", () => {
    expect(canMarkQuoteSent({ quote_status: "draft", actual_weight_lb: 0 })).toBe(false);
  });
});

describe("buildQuoteUpdatePayload", () => {
  it("produces the exact update shape from a quote entry and its calculated result", () => {
    const input = {
      actualWeightLb: 25,
      sameDayApproved: true,
      surchargeAmountCents: 750,
      surchargeNotes: "Rug",
    };
    const quoteResult = calculateQuote({
      actualWeightLb: input.actualWeightLb,
      sameDayApproved: input.sameDayApproved,
      surcharges: [{ description: "Rug", amountCents: 750 }],
    });

    expect(buildQuoteUpdatePayload(input, quoteResult, "user-123")).toEqual({
      actual_weight_lb: 25,
      billable_weight_lb: 25,
      laundry_charge_cents: 3300,
      same_day_fee_cents: 500,
      surcharge_total_cents: 750,
      surcharge_notes: "Rug",
      quote_status: "draft",
      quote_sent_at: null,
      updated_by: "user-123",
    });
  });

  it("stores null surcharge notes when none were entered", () => {
    const input = { actualWeightLb: 10, sameDayApproved: false };
    const quoteResult = calculateQuote({ actualWeightLb: 10 });
    const payload = buildQuoteUpdatePayload(input, quoteResult, "user-123");
    expect(payload.surcharge_notes).toBeNull();
  });

  it("always resets quote_status to draft and quote_sent_at to null, even editing a sent quote", () => {
    const input = { actualWeightLb: 12, sameDayApproved: false };
    const quoteResult = calculateQuote({ actualWeightLb: 12 });
    const payload = buildQuoteUpdatePayload(input, quoteResult, "user-123");
    expect(payload.quote_status).toBe("draft");
    expect(payload.quote_sent_at).toBeNull();
  });
});
