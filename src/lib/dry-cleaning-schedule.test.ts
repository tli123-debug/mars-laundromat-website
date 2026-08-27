import { describe, expect, it } from "vitest";
import { getDryCleaningDeliveryDateOptions, isValidDryCleaningDeliveryDate } from "./dry-cleaning-schedule";

const PICKUP_DATE = "2026-09-14";
const PLUS_THREE = "2026-09-17";
const PLUS_FOUR = "2026-09-18";

describe("getDryCleaningDeliveryDateOptions", () => {
  it("returns exactly pickup+3 and pickup+4", () => {
    expect(getDryCleaningDeliveryDateOptions(PICKUP_DATE)).toEqual([PLUS_THREE, PLUS_FOUR]);
  });

  it("crosses a month boundary correctly", () => {
    expect(getDryCleaningDeliveryDateOptions("2026-09-29")).toEqual(["2026-10-02", "2026-10-03"]);
  });
});

describe("isValidDryCleaningDeliveryDate — Dry Cleaning-only and Both share this same rule", () => {
  it("accepts pickup+3", () => {
    expect(isValidDryCleaningDeliveryDate(PICKUP_DATE, PLUS_THREE)).toBe(true);
  });

  it("accepts pickup+4", () => {
    expect(isValidDryCleaningDeliveryDate(PICKUP_DATE, PLUS_FOUR)).toBe(true);
  });

  it("rejects an earlier date (pickup+1, pickup+2)", () => {
    expect(isValidDryCleaningDeliveryDate(PICKUP_DATE, "2026-09-15")).toBe(false);
    expect(isValidDryCleaningDeliveryDate(PICKUP_DATE, "2026-09-16")).toBe(false);
  });

  it("rejects a later date (pickup+5)", () => {
    expect(isValidDryCleaningDeliveryDate(PICKUP_DATE, "2026-09-19")).toBe(false);
  });

  it("rejects the pickup date itself", () => {
    expect(isValidDryCleaningDeliveryDate(PICKUP_DATE, PICKUP_DATE)).toBe(false);
  });
});
