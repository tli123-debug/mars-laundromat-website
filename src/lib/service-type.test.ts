import { describe, expect, it } from "vitest";
import {
  buildServiceTypeChangePayload,
  canChangeServiceType,
  normalizeServiceType,
  resolveServiceSpeed,
  serviceTypeIncludesDryCleaning,
  serviceTypeIncludesWashAndFold,
} from "./service-type";

describe("normalizeServiceType", () => {
  it("both selected -> both", () => {
    expect(normalizeServiceType(true, true)).toBe("both");
  });

  it("only wash and fold selected -> wash_and_fold", () => {
    expect(normalizeServiceType(true, false)).toBe("wash_and_fold");
  });

  it("only dry cleaning selected -> dry_cleaning", () => {
    expect(normalizeServiceType(false, true)).toBe("dry_cleaning");
  });

  it("neither selected -> null (caller must require at least one)", () => {
    expect(normalizeServiceType(false, false)).toBeNull();
  });
});

describe("serviceTypeIncludesWashAndFold / serviceTypeIncludesDryCleaning", () => {
  it("wash_and_fold includes wash-and-fold only", () => {
    expect(serviceTypeIncludesWashAndFold("wash_and_fold")).toBe(true);
    expect(serviceTypeIncludesDryCleaning("wash_and_fold")).toBe(false);
  });

  it("dry_cleaning includes dry-cleaning only", () => {
    expect(serviceTypeIncludesWashAndFold("dry_cleaning")).toBe(false);
    expect(serviceTypeIncludesDryCleaning("dry_cleaning")).toBe(true);
  });

  it("both includes both", () => {
    expect(serviceTypeIncludesWashAndFold("both")).toBe(true);
    expect(serviceTypeIncludesDryCleaning("both")).toBe(true);
  });
});

describe("resolveServiceSpeed — Same-Day is only ever reachable for Wash & Fold-only", () => {
  it("wash_and_fold keeps whichever speed was selected", () => {
    expect(resolveServiceSpeed("wash_and_fold", "standard")).toBe("standard");
    expect(resolveServiceSpeed("wash_and_fold", "flexible")).toBe("flexible");
    expect(resolveServiceSpeed("wash_and_fold", "same_day")).toBe("same_day");
  });

  it("dry_cleaning always normalizes to dry_cleaning_timeline, even if 'same_day' was passed in", () => {
    expect(resolveServiceSpeed("dry_cleaning", "standard")).toBe("dry_cleaning_timeline");
    expect(resolveServiceSpeed("dry_cleaning", "flexible")).toBe("dry_cleaning_timeline");
    expect(resolveServiceSpeed("dry_cleaning", "same_day")).toBe("dry_cleaning_timeline");
  });

  it("both always normalizes to dry_cleaning_timeline, even if 'same_day' was passed in", () => {
    expect(resolveServiceSpeed("both", "standard")).toBe("dry_cleaning_timeline");
    expect(resolveServiceSpeed("both", "same_day")).toBe("dry_cleaning_timeline");
  });
});

describe("canChangeServiceType", () => {
  it("rejects a paid booking regardless of status", () => {
    expect(canChangeServiceType({ status: "pending", paid: true })).toBe(false);
    expect(canChangeServiceType({ status: "confirmed", paid: true })).toBe(false);
    expect(canChangeServiceType({ status: "picked_up", paid: true })).toBe(false);
  });

  it("rejects a completed booking", () => {
    expect(canChangeServiceType({ status: "completed", paid: false })).toBe(false);
  });

  it("rejects a cancelled booking", () => {
    expect(canChangeServiceType({ status: "cancelled", paid: false })).toBe(false);
  });

  it("allows a sent-but-unpaid booking", () => {
    expect(canChangeServiceType({ status: "picked_up", paid: false })).toBe(true);
  });

  it("allows an unpaid active booking", () => {
    expect(canChangeServiceType({ status: "pending", paid: false })).toBe(true);
    expect(canChangeServiceType({ status: "confirmed", paid: false })).toBe(true);
  });
});

describe("buildServiceTypeChangePayload", () => {
  it("wash_and_fold -> dry_cleaning: sets service_speed to dry_cleaning_timeline and clears every quote field", () => {
    const payload = buildServiceTypeChangePayload("dry_cleaning", "user-123");
    expect(payload).toEqual({
      service_type: "dry_cleaning",
      service_speed: "dry_cleaning_timeline",
      actual_weight_lb: null,
      billable_weight_lb: null,
      laundry_charge_cents: null,
      same_day_fee_cents: null,
      dry_cleaning_item_subtotal_cents: null,
      dry_cleaning_effective_charge_cents: null,
      surcharge_total_cents: 0,
      surcharge_notes: null,
      dry_cleaning_notes: null,
      quote_status: "not_started",
      quote_sent_at: null,
      updated_by: "user-123",
    });
  });

  it("wash_and_fold -> both: also sets service_speed to dry_cleaning_timeline", () => {
    const payload = buildServiceTypeChangePayload("both", "user-123");
    expect(payload.service_type).toBe("both");
    expect(payload.service_speed).toBe("dry_cleaning_timeline");
  });

  it("both -> wash_and_fold: resets service_speed to standard, not whatever it was before", () => {
    const payload = buildServiceTypeChangePayload("wash_and_fold", "user-123");
    expect(payload.service_type).toBe("wash_and_fold");
    expect(payload.service_speed).toBe("standard");
  });

  it("always clears quote_status/quote_sent_at together, regardless of what a prior 'sent' quote looked like", () => {
    // The function is unconditional — it always produces this same reset
    // shape no matter what the booking's prior quote_status/quote_sent_at
    // were, which is exactly what makes a correction on a previously-sent
    // quote safe: there's no path that leaves a stale quote_sent_at behind.
    const payload = buildServiceTypeChangePayload("wash_and_fold", "user-123");
    expect(payload.quote_status).toBe("not_started");
    expect(payload.quote_sent_at).toBeNull();
  });

  it("always clears the wash-and-fold and dry-cleaning amounts together, never leaving one stale", () => {
    const payload = buildServiceTypeChangePayload("dry_cleaning", "user-123");
    expect(payload.actual_weight_lb).toBeNull();
    expect(payload.billable_weight_lb).toBeNull();
    expect(payload.laundry_charge_cents).toBeNull();
    expect(payload.same_day_fee_cents).toBeNull();
    expect(payload.dry_cleaning_item_subtotal_cents).toBeNull();
    expect(payload.dry_cleaning_effective_charge_cents).toBeNull();
  });

  it("does not touch preferred_* or confirmed_* date/time fields", () => {
    const payload = buildServiceTypeChangePayload("dry_cleaning", "user-123");
    expect(payload).not.toHaveProperty("preferred_pickup_date");
    expect(payload).not.toHaveProperty("confirmed_pickup_date");
    expect(payload).not.toHaveProperty("confirmed_delivery_date");
  });
});
