import { describe, expect, it } from "vitest";
import { buildMarkPaidPayload, buildMarkUnpaidPayload } from "./payment";

describe("buildMarkPaidPayload", () => {
  it("sets paid, method, timestamp, verifier, and updater together", () => {
    const now = new Date("2026-08-25T14:30:00.000Z");
    expect(buildMarkPaidPayload("cash", "user-123", now)).toEqual({
      paid: true,
      payment_method: "cash",
      paid_at: "2026-08-25T14:30:00.000Z",
      payment_verified_by: "user-123",
      updated_by: "user-123",
    });
  });

  it("supports zelle as the other valid method", () => {
    const result = buildMarkPaidPayload("zelle", "user-456", new Date("2026-01-01T00:00:00.000Z"));
    expect(result.payment_method).toBe("zelle");
  });

  it("defaults to the current time when now isn't provided", () => {
    const before = Date.now();
    const result = buildMarkPaidPayload("cash", "user-123");
    const after = Date.now();
    const paidAtMs = new Date(result.paid_at).getTime();
    expect(paidAtMs).toBeGreaterThanOrEqual(before);
    expect(paidAtMs).toBeLessThanOrEqual(after);
  });
});

describe("buildMarkUnpaidPayload", () => {
  it("clears payment fields back to null atomically, alongside paid=false", () => {
    expect(buildMarkUnpaidPayload("user-123")).toEqual({
      paid: false,
      payment_method: null,
      paid_at: null,
      payment_verified_by: null,
      updated_by: "user-123",
    });
  });
});
