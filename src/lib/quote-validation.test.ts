import { describe, expect, it } from "vitest";
import {
  buildQuoteUpdatePayload,
  buildServiceQuoteUpdatePayload,
  canApplySameDayFee,
  canApplySameDayFeeForServiceType,
  canMarkQuoteSent,
  canMarkQuoteSentForServiceType,
  dollarsToCents,
  quoteEntrySchema,
  serviceQuoteEntrySchema,
  validateQuoteEntryForServiceType,
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
      laundry_charge_cents: 3750,
      same_day_fee_cents: 1000,
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

// ---------------------------------------------------------------------------
// Service-type-aware API (Dry Cleaning & Ironing expansion)
// ---------------------------------------------------------------------------

describe("serviceQuoteEntrySchema", () => {
  it("accepts a weight-only entry (no dry-cleaning subtotal at all)", () => {
    expect(serviceQuoteEntrySchema.safeParse({ actualWeightLb: 20, sameDayApproved: false }).success).toBe(
      true
    );
  });

  it("accepts a dry-cleaning-subtotal-only entry (no weight at all)", () => {
    expect(
      serviceQuoteEntrySchema.safeParse({ dryCleaningItemSubtotalCents: 1800, sameDayApproved: false })
        .success
    ).toBe(true);
  });

  it("accepts both together", () => {
    expect(
      serviceQuoteEntrySchema.safeParse({
        actualWeightLb: 20,
        dryCleaningItemSubtotalCents: 1800,
        sameDayApproved: false,
      }).success
    ).toBe(true);
  });

  it("accepts neither (shape validation only — the business rule lives in validateQuoteEntryForServiceType)", () => {
    expect(serviceQuoteEntrySchema.safeParse({ sameDayApproved: false }).success).toBe(true);
  });

  it("rejects negative or non-finite weight when present", () => {
    expect(serviceQuoteEntrySchema.safeParse({ actualWeightLb: -1, sameDayApproved: false }).success).toBe(
      false
    );
    expect(serviceQuoteEntrySchema.safeParse({ actualWeightLb: NaN, sameDayApproved: false }).success).toBe(
      false
    );
  });

  it("rejects a negative or non-integer dry-cleaning subtotal when present", () => {
    expect(
      serviceQuoteEntrySchema.safeParse({ dryCleaningItemSubtotalCents: -100, sameDayApproved: false })
        .success
    ).toBe(false);
    expect(
      serviceQuoteEntrySchema.safeParse({ dryCleaningItemSubtotalCents: 99.5, sameDayApproved: false })
        .success
    ).toBe(false);
  });
});

describe("validateQuoteEntryForServiceType", () => {
  it("wash_and_fold rejects a missing weight", () => {
    expect(
      validateQuoteEntryForServiceType("wash_and_fold", "standard", { sameDayApproved: false })
    ).toMatch(/weight/i);
  });

  it("wash_and_fold rejects a zero weight — 0 is treated the same as missing", () => {
    expect(
      validateQuoteEntryForServiceType("wash_and_fold", "standard", {
        actualWeightLb: 0,
        sameDayApproved: false,
      })
    ).toMatch(/weight/i);
  });

  it("wash_and_fold accepts a positive weight", () => {
    expect(
      validateQuoteEntryForServiceType("wash_and_fold", "standard", {
        actualWeightLb: 20,
        sameDayApproved: false,
      })
    ).toBeNull();
  });

  it("dry_cleaning does not require a weight at all", () => {
    expect(
      validateQuoteEntryForServiceType("dry_cleaning", "dry_cleaning_timeline", {
        dryCleaningItemSubtotalCents: 300,
        sameDayApproved: false,
      })
    ).toBeNull();
  });

  it("dry_cleaning requires a dry-cleaning subtotal — missing is rejected", () => {
    expect(
      validateQuoteEntryForServiceType("dry_cleaning", "dry_cleaning_timeline", { sameDayApproved: false })
    ).toMatch(/subtotal/i);
  });

  it("dry_cleaning rejects a $0 subtotal — $0 is not a valid dry-cleaning subtotal, not a legitimate minimum-floored quote", () => {
    expect(
      validateQuoteEntryForServiceType("dry_cleaning", "dry_cleaning_timeline", {
        dryCleaningItemSubtotalCents: 0,
        sameDayApproved: false,
      })
    ).toMatch(/subtotal/i);
  });

  it("dry_cleaning accepts a positive subtotal", () => {
    expect(
      validateQuoteEntryForServiceType("dry_cleaning", "dry_cleaning_timeline", {
        dryCleaningItemSubtotalCents: 300,
        sameDayApproved: false,
      })
    ).toBeNull();
  });

  it("both rejects a zero weight even with a valid dry-cleaning subtotal", () => {
    expect(
      validateQuoteEntryForServiceType("both", "dry_cleaning_timeline", {
        actualWeightLb: 0,
        dryCleaningItemSubtotalCents: 1800,
        sameDayApproved: false,
      })
    ).toMatch(/weight/i);
  });

  it("both requires both a strictly positive weight and a strictly positive dry-cleaning subtotal", () => {
    expect(
      validateQuoteEntryForServiceType("both", "dry_cleaning_timeline", {
        actualWeightLb: 20,
        sameDayApproved: false,
      })
    ).toMatch(/subtotal/i);
    expect(
      validateQuoteEntryForServiceType("both", "dry_cleaning_timeline", {
        dryCleaningItemSubtotalCents: 1800,
        sameDayApproved: false,
      })
    ).toMatch(/weight/i);
    expect(
      validateQuoteEntryForServiceType("both", "dry_cleaning_timeline", {
        actualWeightLb: 20,
        dryCleaningItemSubtotalCents: 1800,
        sameDayApproved: false,
      })
    ).toBeNull();
  });

  describe("sameDayApproved — only ever valid for an actual wash_and_fold + same_day booking", () => {
    it("accepts wash_and_fold + same_day", () => {
      expect(
        validateQuoteEntryForServiceType("wash_and_fold", "same_day", {
          actualWeightLb: 20,
          sameDayApproved: true,
        })
      ).toBeNull();
    });

    it("rejects Standard wash_and_fold", () => {
      expect(
        validateQuoteEntryForServiceType("wash_and_fold", "standard", {
          actualWeightLb: 20,
          sameDayApproved: true,
        })
      ).toMatch(/same-day/i);
    });

    it("rejects Flexible wash_and_fold", () => {
      expect(
        validateQuoteEntryForServiceType("wash_and_fold", "flexible", {
          actualWeightLb: 20,
          sameDayApproved: true,
        })
      ).toMatch(/same-day/i);
    });

    it("rejects dry_cleaning", () => {
      expect(
        validateQuoteEntryForServiceType("dry_cleaning", "dry_cleaning_timeline", {
          dryCleaningItemSubtotalCents: 3000,
          sameDayApproved: true,
        })
      ).toMatch(/same-day/i);
    });

    it("rejects both", () => {
      expect(
        validateQuoteEntryForServiceType("both", "dry_cleaning_timeline", {
          actualWeightLb: 20,
          dryCleaningItemSubtotalCents: 1800,
          sameDayApproved: true,
        })
      ).toMatch(/same-day/i);
    });
  });
});

describe("canApplySameDayFeeForServiceType", () => {
  it("accepts wash_and_fold + same_day + approved", () => {
    expect(canApplySameDayFeeForServiceType("wash_and_fold", "same_day", true)).toBe(true);
  });

  it("rejects Standard wash_and_fold even if approved", () => {
    expect(canApplySameDayFeeForServiceType("wash_and_fold", "standard", true)).toBe(false);
  });

  it("rejects Flexible wash_and_fold even if approved", () => {
    expect(canApplySameDayFeeForServiceType("wash_and_fold", "flexible", true)).toBe(false);
  });

  it("rejects dry_cleaning even if approved and the speed is same_day-shaped", () => {
    expect(canApplySameDayFeeForServiceType("dry_cleaning", "dry_cleaning_timeline", true)).toBe(false);
  });

  it("rejects both even if approved", () => {
    expect(canApplySameDayFeeForServiceType("both", "dry_cleaning_timeline", true)).toBe(false);
  });

  it("rejects wash_and_fold + same_day when not approved", () => {
    expect(canApplySameDayFeeForServiceType("wash_and_fold", "same_day", false)).toBe(false);
  });
});

describe("canMarkQuoteSentForServiceType", () => {
  it("null dry-cleaning subtotal cannot be sent", () => {
    expect(
      canMarkQuoteSentForServiceType({
        quote_status: "draft",
        service_type: "dry_cleaning",
        actual_weight_lb: null,
        dry_cleaning_item_subtotal_cents: null,
      })
    ).toBe(false);
  });

  it("a $0 dry-cleaning subtotal cannot be sent, even as a saved draft", () => {
    expect(
      canMarkQuoteSentForServiceType({
        quote_status: "draft",
        service_type: "dry_cleaning",
        actual_weight_lb: null,
        dry_cleaning_item_subtotal_cents: 0,
      })
    ).toBe(false);
  });

  it("dry_cleaning is sendable without a weight, given a real subtotal", () => {
    expect(
      canMarkQuoteSentForServiceType({
        quote_status: "draft",
        service_type: "dry_cleaning",
        actual_weight_lb: null,
        dry_cleaning_item_subtotal_cents: 3000,
      })
    ).toBe(true);
  });

  it("wash_and_fold is not sendable without a weight", () => {
    expect(
      canMarkQuoteSentForServiceType({
        quote_status: "draft",
        service_type: "wash_and_fold",
        actual_weight_lb: null,
        dry_cleaning_item_subtotal_cents: null,
      })
    ).toBe(false);
  });

  it("both cannot be sent with a zero or missing dry-cleaning subtotal, even with a real weight", () => {
    expect(
      canMarkQuoteSentForServiceType({
        quote_status: "draft",
        service_type: "both",
        actual_weight_lb: 20,
        dry_cleaning_item_subtotal_cents: 0,
      })
    ).toBe(false);
    expect(
      canMarkQuoteSentForServiceType({
        quote_status: "draft",
        service_type: "both",
        actual_weight_lb: 20,
        dry_cleaning_item_subtotal_cents: null,
      })
    ).toBe(false);
  });

  it("both cannot be sent with a missing weight, even with a real dry-cleaning subtotal", () => {
    expect(
      canMarkQuoteSentForServiceType({
        quote_status: "draft",
        service_type: "both",
        actual_weight_lb: null,
        dry_cleaning_item_subtotal_cents: 1800,
      })
    ).toBe(false);
  });

  it("both is sendable once both a real weight and a real subtotal are present", () => {
    expect(
      canMarkQuoteSentForServiceType({
        quote_status: "draft",
        service_type: "both",
        actual_weight_lb: 20,
        dry_cleaning_item_subtotal_cents: 1800,
      })
    ).toBe(true);
  });

  it("nothing is sendable unless quote_status is draft", () => {
    expect(
      canMarkQuoteSentForServiceType({
        quote_status: "sent",
        service_type: "dry_cleaning",
        actual_weight_lb: null,
        dry_cleaning_item_subtotal_cents: 3000,
      })
    ).toBe(false);
  });
});

describe("buildServiceQuoteUpdatePayload", () => {
  it("dry_cleaning-only: omits every wash-and-fold key, applies the $30 minimum", () => {
    const payload = buildServiceQuoteUpdatePayload(
      "dry_cleaning",
      "dry_cleaning_timeline",
      { dryCleaningItemSubtotalCents: 1800, sameDayApproved: false },
      "user-123"
    );
    expect(payload).not.toHaveProperty("actual_weight_lb");
    expect(payload).not.toHaveProperty("billable_weight_lb");
    expect(payload).not.toHaveProperty("laundry_charge_cents");
    expect(payload).not.toHaveProperty("same_day_fee_cents");
    expect(payload.dry_cleaning_item_subtotal_cents).toBe(1800);
    expect(payload.dry_cleaning_effective_charge_cents).toBe(3000);
  });

  it("wash_and_fold-only: omits every dry-cleaning key", () => {
    const payload = buildServiceQuoteUpdatePayload(
      "wash_and_fold",
      "standard",
      { actualWeightLb: 20, sameDayApproved: false },
      "user-123"
    );
    expect(payload).not.toHaveProperty("dry_cleaning_item_subtotal_cents");
    expect(payload).not.toHaveProperty("dry_cleaning_effective_charge_cents");
    expect(payload.laundry_charge_cents).toBe(3000);
  });

  it("both: $30 Wash & Fold plus $18 dry cleaning — no second minimum applied to the dry-cleaning portion", () => {
    const payload = buildServiceQuoteUpdatePayload(
      "both",
      "dry_cleaning_timeline",
      { actualWeightLb: 20, dryCleaningItemSubtotalCents: 1800, sameDayApproved: false },
      "user-123"
    );
    expect(payload.laundry_charge_cents).toBe(3000);
    expect(payload.dry_cleaning_item_subtotal_cents).toBe(1800);
    expect(payload.dry_cleaning_effective_charge_cents).toBe(1800);
    expect((payload.laundry_charge_cents as number) + (payload.dry_cleaning_effective_charge_cents as number)).toBe(
      4800
    );
  });

  it("writes the dry-cleaning subtotal and effective charge together, never one without the other", () => {
    const dryOnly = buildServiceQuoteUpdatePayload(
      "dry_cleaning",
      "dry_cleaning_timeline",
      { dryCleaningItemSubtotalCents: 500, sameDayApproved: false },
      "user-123"
    );
    expect(dryOnly).toHaveProperty("dry_cleaning_item_subtotal_cents");
    expect(dryOnly).toHaveProperty("dry_cleaning_effective_charge_cents");
  });

  it("includes the surcharge regardless of service type", () => {
    const payload = buildServiceQuoteUpdatePayload(
      "dry_cleaning",
      "dry_cleaning_timeline",
      {
        dryCleaningItemSubtotalCents: 1800,
        sameDayApproved: false,
        surchargeAmountCents: 500,
        surchargeNotes: "Heavily soiled",
      },
      "user-123"
    );
    expect(payload.surcharge_total_cents).toBe(500);
    expect(payload.surcharge_notes).toBe("Heavily soiled");
  });

  it("always resets quote_status to draft and quote_sent_at to null", () => {
    const payload = buildServiceQuoteUpdatePayload(
      "dry_cleaning",
      "dry_cleaning_timeline",
      { dryCleaningItemSubtotalCents: 1800, sameDayApproved: false },
      "user-123"
    );
    expect(payload.quote_status).toBe("draft");
    expect(payload.quote_sent_at).toBeNull();
  });

  describe("never constructs an invalid Same-Day fee, regardless of what sameDayApproved claims", () => {
    it("wash_and_fold + same_day + approved: the one legitimate case actually gets the $10 fee", () => {
      const payload = buildServiceQuoteUpdatePayload(
        "wash_and_fold",
        "same_day",
        { actualWeightLb: 20, sameDayApproved: true },
        "user-123"
      );
      expect(payload.same_day_fee_cents).toBe(1000);
    });

    it("Standard wash_and_fold: sameDayApproved=true is ignored, fee stays 0", () => {
      const payload = buildServiceQuoteUpdatePayload(
        "wash_and_fold",
        "standard",
        { actualWeightLb: 20, sameDayApproved: true },
        "user-123"
      );
      expect(payload.same_day_fee_cents).toBe(0);
    });

    it("Flexible wash_and_fold: sameDayApproved=true is ignored, fee stays 0", () => {
      const payload = buildServiceQuoteUpdatePayload(
        "wash_and_fold",
        "flexible",
        { actualWeightLb: 20, sameDayApproved: true },
        "user-123"
      );
      expect(payload.same_day_fee_cents).toBe(0);
    });

    it("both: sameDayApproved=true is ignored even with a real weight and subtotal, fee stays 0", () => {
      const payload = buildServiceQuoteUpdatePayload(
        "both",
        "dry_cleaning_timeline",
        { actualWeightLb: 20, dryCleaningItemSubtotalCents: 1800, sameDayApproved: true },
        "user-123"
      );
      expect(payload.same_day_fee_cents).toBe(0);
    });

    it("dry_cleaning: sameDayApproved=true never surfaces a same_day_fee_cents key at all", () => {
      const payload = buildServiceQuoteUpdatePayload(
        "dry_cleaning",
        "dry_cleaning_timeline",
        { dryCleaningItemSubtotalCents: 1800, sameDayApproved: true },
        "user-123"
      );
      expect(payload).not.toHaveProperty("same_day_fee_cents");
    });
  });
});
