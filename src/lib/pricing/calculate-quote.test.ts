import { describe, expect, it } from "vitest";
import { calculateQuote } from "./calculate-quote";

describe("calculateQuote — weight boundaries and rounding", () => {
  it("0 lb: charges the 20 lb minimum", () => {
    const result = calculateQuote({ actualWeightLb: 0 });
    expect(result.billableWeightLb).toBe(20);
    expect(result.laundryChargeCents).toBe(3000);
    expect(result.totalCents).toBe(3000);
  });

  it("10 lb: below minimum, still charges the 20 lb minimum", () => {
    const result = calculateQuote({ actualWeightLb: 10 });
    expect(result.billableWeightLb).toBe(20);
    expect(result.laundryChargeCents).toBe(3000);
  });

  it("15 lb: below minimum, still charges the 20 lb minimum", () => {
    const result = calculateQuote({ actualWeightLb: 15 });
    expect(result.billableWeightLb).toBe(20);
    expect(result.laundryChargeCents).toBe(3000);
  });

  it("19.4 lb: rounds down to 19, minimum still applies", () => {
    const result = calculateQuote({ actualWeightLb: 19.4 });
    expect(result.billableWeightLb).toBe(20);
    expect(result.laundryChargeCents).toBe(3000);
  });

  it("19.5 lb: half-pound rounds UP to 20", () => {
    const result = calculateQuote({ actualWeightLb: 19.5 });
    expect(result.billableWeightLb).toBe(20);
    expect(result.laundryChargeCents).toBe(3000);
  });

  it("20 lb: exactly the minimum", () => {
    const result = calculateQuote({ actualWeightLb: 20 });
    expect(result.billableWeightLb).toBe(20);
    expect(result.laundryChargeCents).toBe(3000);
  });

  it("20.4 lb: rounds down to 20", () => {
    const result = calculateQuote({ actualWeightLb: 20.4 });
    expect(result.billableWeightLb).toBe(20);
    expect(result.laundryChargeCents).toBe(3000);
  });

  it("20.5 lb: half-pound rounds UP to 21, first billable pound over minimum", () => {
    const result = calculateQuote({ actualWeightLb: 20.5 });
    expect(result.billableWeightLb).toBe(21);
    expect(result.laundryChargeCents).toBe(3150);
  });

  it("21 lb: one pound over minimum", () => {
    const result = calculateQuote({ actualWeightLb: 21 });
    expect(result.billableWeightLb).toBe(21);
    expect(result.laundryChargeCents).toBe(3150);
  });

  it("22.5 lb: half-pound rounds UP to 23 — rounding applies above the minimum too, not just at its edge", () => {
    const result = calculateQuote({ actualWeightLb: 22.5 });
    expect(result.billableWeightLb).toBe(23);
    expect(result.laundryChargeCents).toBe(3450);
  });

  it("25 lb", () => {
    const result = calculateQuote({ actualWeightLb: 25 });
    expect(result.billableWeightLb).toBe(25);
    expect(result.laundryChargeCents).toBe(3750);
  });

  it("30 lb", () => {
    const result = calculateQuote({ actualWeightLb: 30 });
    expect(result.billableWeightLb).toBe(30);
    expect(result.laundryChargeCents).toBe(4500);
  });

  it("matches every worked example from the spec", () => {
    const cases: Array<[number, number]> = [
      [0, 3000],
      [10, 3000],
      [15, 3000],
      [19.4, 3000],
      [19.5, 3000],
      [20, 3000],
      [20.4, 3000],
      [20.5, 3150],
      [21, 3150],
      [25, 3750],
      [30, 4500],
    ];
    for (const [actualWeightLb, expectedCents] of cases) {
      expect(calculateQuote({ actualWeightLb }).laundryChargeCents).toBe(expectedCents);
    }
  });
});

describe("calculateQuote — same-day fee", () => {
  it("adds no fee when same-day is not approved (default)", () => {
    const result = calculateQuote({ actualWeightLb: 20 });
    expect(result.sameDayFeeCents).toBe(0);
    expect(result.totalCents).toBe(3000);
  });

  it("adds no fee when explicitly false", () => {
    const result = calculateQuote({ actualWeightLb: 20, sameDayApproved: false });
    expect(result.sameDayFeeCents).toBe(0);
  });

  it("adds a flat $8 fee when approved, independent of weight", () => {
    const light = calculateQuote({ actualWeightLb: 20, sameDayApproved: true });
    const heavy = calculateQuote({ actualWeightLb: 25, sameDayApproved: true });
    expect(light.sameDayFeeCents).toBe(800);
    expect(heavy.sameDayFeeCents).toBe(800);
    expect(light.totalCents).toBe(3000 + 800);
    expect(heavy.totalCents).toBe(3750 + 800);
  });
});

describe("calculateQuote — surcharges", () => {
  it("defaults to no surcharges", () => {
    const result = calculateQuote({ actualWeightLb: 20 });
    expect(result.surcharges).toEqual([]);
    expect(result.surchargeTotalCents).toBe(0);
  });

  it("adds a single surcharge to the total", () => {
    const result = calculateQuote({
      actualWeightLb: 20,
      surcharges: [{ description: "Comforter", amountCents: 1000 }],
    });
    expect(result.surchargeTotalCents).toBe(1000);
    expect(result.totalCents).toBe(3000 + 1000);
  });

  it("sums multiple surcharges correctly", () => {
    const result = calculateQuote({
      actualWeightLb: 20,
      surcharges: [
        { description: "Comforter", amountCents: 1000 },
        { description: "Rug", amountCents: 500 },
        { description: "Extra pillow", amountCents: 250 },
      ],
    });
    expect(result.surchargeTotalCents).toBe(1750);
    expect(result.totalCents).toBe(3000 + 1750);
    expect(result.surcharges).toHaveLength(3);
  });

  it("allows a zero-amount surcharge (nonnegative, not strictly positive)", () => {
    const result = calculateQuote({
      actualWeightLb: 20,
      surcharges: [{ description: "Waived surcharge", amountCents: 0 }],
    });
    expect(result.surchargeTotalCents).toBe(0);
  });

  it("rejects a negative surcharge amount", () => {
    expect(() =>
      calculateQuote({
        actualWeightLb: 20,
        surcharges: [{ description: "Bad line", amountCents: -100 }],
      })
    ).toThrow(/negative/i);
  });

  it("rejects a non-integer surcharge amount (cents must be whole)", () => {
    expect(() =>
      calculateQuote({
        actualWeightLb: 20,
        surcharges: [{ description: "Fractional cents", amountCents: 99.5 }],
      })
    ).toThrow(/integer/i);
  });
});

describe("calculateQuote — combined charges", () => {
  it("combines weight, same-day fee, and surcharges into one consistent total", () => {
    const result = calculateQuote({
      actualWeightLb: 25,
      sameDayApproved: true,
      surcharges: [{ description: "Rug", amountCents: 750 }],
    });
    expect(result.billableWeightLb).toBe(25);
    expect(result.laundryChargeCents).toBe(3750);
    expect(result.sameDayFeeCents).toBe(800);
    expect(result.surchargeTotalCents).toBe(750);
    // totalCents must always equal the sum of its three components — this is
    // the same formula the DB's generated quote_total_cents column uses.
    expect(result.totalCents).toBe(
      result.laundryChargeCents + result.sameDayFeeCents + result.surchargeTotalCents
    );
    expect(result.totalCents).toBe(5300);
  });

  it("a 20 lb minimum-order Same-Day quote totals $38 before any other surcharges", () => {
    const result = calculateQuote({ actualWeightLb: 20, sameDayApproved: true });
    expect(result.laundryChargeCents).toBe(3000); // $30 minimum
    expect(result.sameDayFeeCents).toBe(800); // $8
    expect(result.totalCents).toBe(3800); // $38
  });
});

describe("calculateQuote — negative and invalid input", () => {
  it("rejects negative weight", () => {
    expect(() => calculateQuote({ actualWeightLb: -1 })).toThrow(/negative/i);
  });

  it("rejects NaN weight", () => {
    expect(() => calculateQuote({ actualWeightLb: NaN })).toThrow(/finite/i);
  });

  it("rejects infinite weight", () => {
    expect(() => calculateQuote({ actualWeightLb: Infinity })).toThrow(/finite/i);
  });
});
