import { describe, expect, it } from "vitest";
import { getDryCleaningDeliveryDate, isValidDryCleaningDeliveryDate } from "./dry-cleaning-schedule";

const PICKUP_DATE = "2026-09-14";
const PLUS_THREE = "2026-09-17";
const PLUS_FOUR = "2026-09-18";

describe("getDryCleaningDeliveryDate", () => {
  it("returns exactly pickup+4", () => {
    expect(getDryCleaningDeliveryDate(PICKUP_DATE)).toBe(PLUS_FOUR);
  });

  it("crosses a month boundary correctly", () => {
    expect(getDryCleaningDeliveryDate("2026-09-29")).toBe("2026-10-03");
  });

  it("crosses a year boundary correctly", () => {
    expect(getDryCleaningDeliveryDate("2026-12-29")).toBe("2027-01-02");
  });
});

describe("isValidDryCleaningDeliveryDate — Dry Cleaning-only and Both share this same rule", () => {
  it("accepts pickup+4", () => {
    expect(isValidDryCleaningDeliveryDate(PICKUP_DATE, PLUS_FOUR)).toBe(true);
  });

  it("rejects pickup+3 — no longer a customer-selectable option", () => {
    expect(isValidDryCleaningDeliveryDate(PICKUP_DATE, PLUS_THREE)).toBe(false);
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
