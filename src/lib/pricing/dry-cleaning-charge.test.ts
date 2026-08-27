import { describe, expect, it } from "vitest";
import { calculateDryCleaningEffectiveCharge, DRY_CLEANING_MINIMUM_CENTS } from "./dry-cleaning-charge";

describe("calculateDryCleaningEffectiveCharge — wash_and_fold", () => {
  it("is always 0, regardless of subtotal", () => {
    expect(calculateDryCleaningEffectiveCharge("wash_and_fold", 0)).toBe(0);
    expect(calculateDryCleaningEffectiveCharge("wash_and_fold", 4200)).toBe(0);
  });
});

describe("calculateDryCleaningEffectiveCharge — dry_cleaning (the $30 minimum applies)", () => {
  it("$3 (a single shirt) is floored to the $30 minimum", () => {
    expect(calculateDryCleaningEffectiveCharge("dry_cleaning", 300)).toBe(3000);
  });

  it("$18 is floored to the $30 minimum", () => {
    expect(calculateDryCleaningEffectiveCharge("dry_cleaning", 1800)).toBe(3000);
  });

  it("$30 stays $30 (exactly at the minimum)", () => {
    expect(calculateDryCleaningEffectiveCharge("dry_cleaning", 3000)).toBe(3000);
  });

  it("$42 stays $42 (above the minimum, charged as-is)", () => {
    expect(calculateDryCleaningEffectiveCharge("dry_cleaning", 4200)).toBe(4200);
  });

  it("DRY_CLEANING_MINIMUM_CENTS is exactly $30", () => {
    expect(DRY_CLEANING_MINIMUM_CENTS).toBe(3000);
  });
});

describe("calculateDryCleaningEffectiveCharge — both (no separate minimum, ever)", () => {
  it("a subtotal below what the dry-cleaning-only minimum would be is charged as-is, not floored", () => {
    expect(calculateDryCleaningEffectiveCharge("both", 1800)).toBe(1800);
  });

  it("the worked example from the spec: $18 dry cleaning stays $18 when combined", () => {
    expect(calculateDryCleaningEffectiveCharge("both", 1800)).toBe(1800);
  });

  it("a subtotal above the dry-cleaning-only minimum is also charged as-is", () => {
    expect(calculateDryCleaningEffectiveCharge("both", 4200)).toBe(4200);
  });
});
