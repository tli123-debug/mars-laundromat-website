import { describe, expect, it } from "vitest";
import {
  computeDurableCalendarEligibility,
  computeLegDisposition,
  computeLegFulfilled,
  isCalendarWorthy,
  needsReconciliation,
} from "./desired-state";

describe("computeDurableCalendarEligibility (test #1, #2, #3, #4)", () => {
  const launchedAt = new Date("2026-09-19T00:00:00Z");

  it("a website booking created after launch is eligible", () => {
    expect(
      computeDurableCalendarEligibility({
        bookingSource: "website",
        createdAt: new Date("2026-09-20T00:00:00Z"),
        launchedAt,
      })
    ).toBe(true);
  });

  it("a website booking created before launch is never eligible", () => {
    expect(
      computeDurableCalendarEligibility({
        bookingSource: "website",
        createdAt: new Date("2026-09-18T00:00:00Z"),
        launchedAt,
      })
    ).toBe(false);
  });

  it("a phone booking is excluded regardless of timing", () => {
    expect(
      computeDurableCalendarEligibility({
        bookingSource: "phone",
        createdAt: new Date("2026-09-20T00:00:00Z"),
        launchedAt,
      })
    ).toBe(false);
  });

  it("a generated recurring occurrence is excluded regardless of timing", () => {
    expect(
      computeDurableCalendarEligibility({
        bookingSource: "recurring",
        createdAt: new Date("2026-09-20T00:00:00Z"),
        launchedAt,
      })
    ).toBe(false);
  });

  it("nothing is eligible before sync has ever been launched", () => {
    expect(
      computeDurableCalendarEligibility({
        bookingSource: "website",
        createdAt: new Date("2026-09-20T00:00:00Z"),
        launchedAt: null,
      })
    ).toBe(false);
  });
});

describe("durability across a later edit (test #2)", () => {
  it("a pre-launch booking's eligibility, once computed false, has no path back to true", () => {
    // Eligibility is computed ONCE at insert time in the real system —
    // this test's point is that calling the function again LATER, even
    // after launch and with the booking's other fields changed, still
    // can't flip a pre-launch createdAt to eligible. There
    // is no "re-run this with today's date" input to the function at
    // all — createdAt is fixed forever once a row exists, which is
    // exactly the durability property.
    const preLaunchCreatedAt = new Date("2026-09-01T00:00:00Z");
    const launchedAt = new Date("2026-09-19T00:00:00Z");
    const resultRightAfterInsert = computeDurableCalendarEligibility({
      bookingSource: "website",
      createdAt: preLaunchCreatedAt,
      launchedAt: null,
    });
    const resultReEvaluatedMuchLater = computeDurableCalendarEligibility({
      bookingSource: "website",
      createdAt: preLaunchCreatedAt, // unchanged — this is the durable fact
      launchedAt,
    });
    expect(resultRightAfterInsert).toBe(false);
    expect(resultReEvaluatedMuchLater).toBe(false);
  });
});

describe("isCalendarWorthy", () => {
  it("requires durable eligibility and no manual exclusion", () => {
    expect(isCalendarWorthy({ calendarSyncEligible: true, calendarSyncExcluded: false })).toBe(true);
    expect(isCalendarWorthy({ calendarSyncEligible: false, calendarSyncExcluded: false })).toBe(false);
    expect(isCalendarWorthy({ calendarSyncEligible: true, calendarSyncExcluded: true })).toBe(false);
  });
});

describe("computeLegFulfilled", () => {
  it("pickup becomes fulfilled at picked_up, ready_for_delivery, or completed", () => {
    expect(computeLegFulfilled("pickup", "picked_up", false)).toBe(true);
    expect(computeLegFulfilled("pickup", "ready_for_delivery", false)).toBe(true);
    expect(computeLegFulfilled("pickup", "completed", false)).toBe(true);
    expect(computeLegFulfilled("pickup", "confirmed", false)).toBe(false);
    expect(computeLegFulfilled("pickup", "pending", false)).toBe(false);
  });

  it("delivery only becomes fulfilled at completed", () => {
    expect(computeLegFulfilled("delivery", "completed", false)).toBe(true);
    expect(computeLegFulfilled("delivery", "ready_for_delivery", false)).toBe(false);
    expect(computeLegFulfilled("delivery", "picked_up", false)).toBe(false);
  });

  it("once previously fulfilled, stays fulfilled regardless of current status (test #13, #16)", () => {
    // This is the crux of the durability requirement: a later, unrelated
    // status (even 'cancelled', even 'pending') can never un-fulfill a
    // leg that a prior invocation already recorded as fulfilled.
    expect(computeLegFulfilled("pickup", "cancelled", true)).toBe(true);
    expect(computeLegFulfilled("pickup", "pending", true)).toBe(true);
  });
});

describe("computeLegDisposition (test #5, #6, #11, #12, #13, #14, #17)", () => {
  it("unconfirmed booking (pending) produces no event for either leg (test #5)", () => {
    expect(
      computeLegDisposition({ status: "pending", confirmedDate: null, confirmedTime: null, fulfilled: false })
    ).toBe("absent");
    // Even if confirmed_* happens to hold a staff PROPOSAL while status is
    // still pending — that's not a confirmed appointment yet.
    expect(
      computeLegDisposition({ status: "pending", confirmedDate: "2026-09-25", confirmedTime: "09:00", fulfilled: false })
    ).toBe("absent");
  });

  it("confirmed booking with a complete schedule produces an active event (test #6)", () => {
    expect(
      computeLegDisposition({ status: "confirmed", confirmedDate: "2026-09-25", confirmedTime: "09:00", fulfilled: false })
    ).toBe("active");
  });

  it("confirmed status but missing confirmed_* for this leg is absent (partial schedule)", () => {
    expect(
      computeLegDisposition({ status: "confirmed", confirmedDate: null, confirmedTime: null, fulfilled: false })
    ).toBe("absent");
  });

  it("a leg already fulfilled while still pre-completion status is historical, not active (test #17)", () => {
    // e.g. pickup leg once status has moved to ready_for_delivery.
    expect(
      computeLegDisposition({ status: "ready_for_delivery", confirmedDate: "2026-09-25", confirmedTime: "09:00", fulfilled: true })
    ).toBe("historical");
  });

  it("future cancellation (never fulfilled) removes the event (test #11)", () => {
    expect(
      computeLegDisposition({ status: "cancelled", confirmedDate: "2026-09-25", confirmedTime: "09:00", fulfilled: false })
    ).toBe("absent");
  });

  it("cancellation after pickup preserves the historical pickup and removes the future delivery (test #12)", () => {
    const pickupLeg = computeLegDisposition({ status: "cancelled", confirmedDate: "2026-09-25", confirmedTime: "09:00", fulfilled: true });
    const deliveryLeg = computeLegDisposition({ status: "cancelled", confirmedDate: "2026-09-26", confirmedTime: "10:00", fulfilled: false });
    expect(pickupLeg).toBe("historical");
    expect(deliveryLeg).toBe("absent");
  });

  it("editing an already-cancelled booking never removes preserved history or recreates cancelled work (test #13)", () => {
    // Simulates a later, unrelated edit (e.g. admin_notes) re-evaluating
    // disposition for a booking that's been 'cancelled' all along, with
    // pickup already recorded fulfilled and delivery never fulfilled.
    const pickupLeg = computeLegDisposition({ status: "cancelled", confirmedDate: "2026-09-25", confirmedTime: "09:00", fulfilled: true });
    const deliveryLeg = computeLegDisposition({ status: "cancelled", confirmedDate: "2026-09-26", confirmedTime: "10:00", fulfilled: false });
    expect(pickupLeg).toBe("historical"); // still preserved, not absent
    expect(deliveryLeg).toBe("absent"); // still absent, not resurrected to active
  });

  it("fulfilled past events remain as history once the order is fully completed (test #14)", () => {
    expect(
      computeLegDisposition({ status: "completed", confirmedDate: "2026-09-25", confirmedTime: "09:00", fulfilled: true })
    ).toBe("historical");
  });
});

describe("needsReconciliation (test #19) — OR, never AND", () => {
  it("due when only the version differs", () => {
    expect(
      needsReconciliation({ desiredVersion: 2, syncedVersion: 1, desiredCalendarIdentity: "cal-a", syncedCalendarIdentity: "cal-a" })
    ).toBe(true);
  });

  it("due when only the target calendar differs (the calendar-switch case)", () => {
    expect(
      needsReconciliation({ desiredVersion: 1, syncedVersion: 1, desiredCalendarIdentity: "cal-prod", syncedCalendarIdentity: "cal-test" })
    ).toBe(true);
  });

  it("not due when both already match", () => {
    expect(
      needsReconciliation({ desiredVersion: 1, syncedVersion: 1, desiredCalendarIdentity: "cal-a", syncedCalendarIdentity: "cal-a" })
    ).toBe(false);
  });

  it("due when nothing has ever synced yet (syncedVersion null)", () => {
    expect(
      needsReconciliation({ desiredVersion: 1, syncedVersion: null, desiredCalendarIdentity: "cal-a", syncedCalendarIdentity: null })
    ).toBe(true);
  });
});
