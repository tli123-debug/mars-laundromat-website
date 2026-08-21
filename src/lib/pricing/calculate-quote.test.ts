import { describe, expect, it } from "vitest";
import { calculateQuote } from "./calculate-quote";

describe("calculateQuote — weight boundaries and rounding", () => {
  it("0 lb: charges the 10 lb minimum", () => {
    const result = calculateQuote({ actualWeightLb: 0 });
    expect(result.billableWeightLb).toBe(10);
    expect(result.laundryChargeCents).toBe(1800);
    expect(result.totalCents).toBe(1800);
  });

  it("7 lb: below minimum, still charges the 10 lb minimum", () => {
    const result = calculateQuote({ actualWeightLb: 7 });
    expect(result.billableWeightLb).toBe(10);
    expect(result.laundryChargeCents).toBe(1800);
  });

  it("9.4 lb: rounds down to 9, minimum still applies", () => {
    const result = calculateQuote({ actualWeightLb: 9.4 });
    expect(result.billableWeightLb).toBe(10);
    expect(result.laundryChargeCents).toBe(1800);
  });

  it("9.5 lb: half-pound rounds UP to 10", () => {
    const result = calculateQuote({ actualWeightLb: 9.5 });
    expect(result.billableWeightLb).toBe(10);
    expect(result.laundryChargeCents).toBe(1800);
  });

  it("10 lb: exactly the minimum", () => {
    const result = calculateQuote({ actualWeightLb: 10 });
    expect(result.billableWeightLb).toBe(10);
    expect(result.laundryChargeCents).toBe(1800);
  });

  it("10.4 lb: rounds down to 10", () => {
    const result = calculateQuote({ actualWeightLb: 10.4 });
    expect(result.billableWeightLb).toBe(10);
    expect(result.laundryChargeCents).toBe(1800);
  });

  it("10.5 lb: half-pound rounds UP to 11, first billable pound over minimum", () => {
    const result = calculateQuote({ actualWeightLb: 10.5 });
    expect(result.billableWeightLb).toBe(11);
    expect(result.laundryChargeCents).toBe(1900);
  });

  it("11 lb: one pound over minimum", () => {
    const result = calculateQuote({ actualWeightLb: 11 });
    expect(result.billableWeightLb).toBe(11);
    expect(result.laundryChargeCents).toBe(1900);
  });

  it("17.5 lb: half-pound rounds UP to 18", () => {
    const result = calculateQuote({ actualWeightLb: 17.5 });
    expect(result.billableWeightLb).toBe(18);
    expect(result.laundryChargeCents).toBe(2600);
  });

  it("matches every worked example from the spec", () => {
    const cases: Array<[number, number]> = [
      [7, 1800],
      [10, 1800],
      [10.4, 1800],
      [10.5, 1900],
      [12, 2000],
      [18, 2600],
      [25, 3300],
    ];
    for (const [actualWeightLb, expectedCents] of cases) {
      expect(calculateQuote({ actualWeightLb }).laundryChargeCents).toBe(expectedCents);
    }
  });
});

describe("calculateQuote — same-day fee", () => {
  it("adds no fee when same-day is not approved (default)", () => {
    const result = calculateQuote({ actualWeightLb: 10 });
    expect(result.sameDayFeeCents).toBe(0);
    expect(result.totalCents).toBe(1800);
  });

  it("adds no fee when explicitly false", () => {
    const result = calculateQuote({ actualWeightLb: 10, sameDayApproved: false });
    expect(result.sameDayFeeCents).toBe(0);
  });

  it("adds a flat $5 fee when approved, independent of weight", () => {
    const light = calculateQuote({ actualWeightLb: 10, sameDayApproved: true });
    const heavy = calculateQuote({ actualWeightLb: 25, sameDayApproved: true });
    expect(light.sameDayFeeCents).toBe(500);
    expect(heavy.sameDayFeeCents).toBe(500);
    expect(light.totalCents).toBe(1800 + 500);
    expect(heavy.totalCents).toBe(3300 + 500);
  });
});

describe("calculateQuote — surcharges", () => {
  it("defaults to no surcharges", () => {
    const result = calculateQuote({ actualWeightLb: 10 });
    expect(result.surcharges).toEqual([]);
    expect(result.surchargeTotalCents).toBe(0);
  });

  it("adds a single surcharge to the total", () => {
    const result = calculateQuote({
      actualWeightLb: 10,
      surcharges: [{ description: "Comforter", amountCents: 1000 }],
    });
    expect(result.surchargeTotalCents).toBe(1000);
    expect(result.totalCents).toBe(1800 + 1000);
  });

  it("sums multiple surcharges correctly", () => {
    const result = calculateQuote({
      actualWeightLb: 10,
      surcharges: [
        { description: "Comforter", amountCents: 1000 },
        { description: "Rug", amountCents: 500 },
        { description: "Extra pillow", amountCents: 250 },
      ],
    });
    expect(result.surchargeTotalCents).toBe(1750);
    expect(result.totalCents).toBe(1800 + 1750);
    expect(result.surcharges).toHaveLength(3);
  });

  it("allows a zero-amount surcharge (nonnegative, not strictly positive)", () => {
    const result = calculateQuote({
      actualWeightLb: 10,
      surcharges: [{ description: "Waived surcharge", amountCents: 0 }],
    });
    expect(result.surchargeTotalCents).toBe(0);
  });

  it("rejects a negative surcharge amount", () => {
    expect(() =>
      calculateQuote({
        actualWeightLb: 10,
        surcharges: [{ description: "Bad line", amountCents: -100 }],
      })
    ).toThrow(/negative/i);
  });

  it("rejects a non-integer surcharge amount (cents must be whole)", () => {
    expect(() =>
      calculateQuote({
        actualWeightLb: 10,
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
    expect(result.laundryChargeCents).toBe(3300);
    expect(result.sameDayFeeCents).toBe(500);
    expect(result.surchargeTotalCents).toBe(750);
    // totalCents must always equal the sum of its three components — this is
    // the same formula the DB's generated quote_total_cents column uses.
    expect(result.totalCents).toBe(
      result.laundryChargeCents + result.sameDayFeeCents + result.surchargeTotalCents
    );
    expect(result.totalCents).toBe(4550);
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
