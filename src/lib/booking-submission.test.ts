import { describe, expect, it } from "vitest";
import { FindResultSchema, shouldNotifyForOutcome, SubmitResultSchema } from "./booking-submission";

describe("shouldNotifyForOutcome", () => {
  it("notifies for a fresh insert", () => {
    expect(shouldNotifyForOutcome("created")).toBe(true);
  });

  it("does not notify for a deduped identical retry", () => {
    expect(shouldNotifyForOutcome("duplicate")).toBe(false);
  });

  it("does not notify when nothing new was actually saved", () => {
    expect(shouldNotifyForOutcome("conflict")).toBe(false);
  });
});

describe("FindResultSchema", () => {
  it("accepts a well-formed found_matching row", () => {
    const result = FindResultSchema.safeParse({
      booking_id: "8f14e45f-ceea-4d29-8f39-4c0c35a2a5a4",
      outcome: "found_matching",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a null booking_id for not_found", () => {
    const result = FindResultSchema.safeParse({ booking_id: null, outcome: "not_found" });
    expect(result.success).toBe(true);
  });

  it("rejects an unrecognized outcome string", () => {
    const result = FindResultSchema.safeParse({
      booking_id: "8f14e45f-ceea-4d29-8f39-4c0c35a2a5a4",
      outcome: "something_else",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing row entirely (e.g. an empty RPC response array)", () => {
    expect(FindResultSchema.safeParse(undefined).success).toBe(false);
  });

  it("rejects a malformed booking_id", () => {
    const result = FindResultSchema.safeParse({ booking_id: "not-a-uuid", outcome: "found_matching" });
    expect(result.success).toBe(false);
  });

  // Regression: a plain (non-discriminated) object schema with an
  // independently-nullable booking_id would have accepted both of these
  // inconsistent pairings, which submit_booking()'s own contract can never
  // actually produce.
  it("rejects found_matching with a null booking_id", () => {
    const result = FindResultSchema.safeParse({ booking_id: null, outcome: "found_matching" });
    expect(result.success).toBe(false);
  });

  it("rejects found_conflicting with a null booking_id", () => {
    const result = FindResultSchema.safeParse({ booking_id: null, outcome: "found_conflicting" });
    expect(result.success).toBe(false);
  });

  it("rejects not_found with a real (non-null) booking_id", () => {
    const result = FindResultSchema.safeParse({
      booking_id: "8f14e45f-ceea-4d29-8f39-4c0c35a2a5a4",
      outcome: "not_found",
    });
    expect(result.success).toBe(false);
  });
});

describe("SubmitResultSchema", () => {
  it("accepts a well-formed created row", () => {
    const result = SubmitResultSchema.safeParse({
      booking_id: "8f14e45f-ceea-4d29-8f39-4c0c35a2a5a4",
      outcome: "created",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a null booking_id — submit_booking always returns a real one", () => {
    const result = SubmitResultSchema.safeParse({ booking_id: null, outcome: "created" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing row entirely", () => {
    expect(SubmitResultSchema.safeParse(undefined).success).toBe(false);
  });
});
