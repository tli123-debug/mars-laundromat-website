import { describe, expect, it } from "vitest";
import { getWindowsForDate } from "@/lib/booking-hours";
import type { BookingStatus } from "@/types/database.types";
import {
  buildApproveTimePayload,
  buildClearProposedTimePayload,
  buildSaveProposedTimePayload,
  canAdvanceToStatus,
  hasCompleteProposedTime,
  hasRecordedPayment,
  isDeliveryNotBeforePickup,
  isFutureStoreWindow,
  isPreLifecycle,
  isValidStoreWindow,
  proposedScheduleMatchesPreferred,
  STATUSES_REQUIRING_CONFIRMED_SCHEDULE,
  validatePreferredTimeForServiceType,
  validateProposedTime,
} from "./time-proposal-validation";

const PICKUP_DATE = "2026-09-14";
const DELIVERY_DATE = "2026-09-15";

describe("isValidStoreWindow", () => {
  it("accepts the first fixed daily window (9:00 AM) for a given date", () => {
    const firstWindow = getWindowsForDate(PICKUP_DATE, { excludePast: false })[0];
    expect(firstWindow.value).toBe("09:00");
    expect(isValidStoreWindow(PICKUP_DATE, firstWindow.value)).toBe(true);
  });

  it("rejects a time before the fixed windows start on any day", () => {
    expect(isValidStoreWindow(PICKUP_DATE, "03:00")).toBe(false);
  });

  it("rejects a time after the fixed windows end on any day", () => {
    expect(isValidStoreWindow(PICKUP_DATE, "23:30")).toBe(false);
  });

  it("rejects a malformed/nonsense time value", () => {
    expect(isValidStoreWindow(PICKUP_DATE, "not-a-time")).toBe(false);
  });

  it("still validates against past dates (excludePast: false) — staff may be backfilling", () => {
    const firstWindow = getWindowsForDate("2020-01-06", { excludePast: false })[0];
    expect(isValidStoreWindow("2020-01-06", firstWindow.value)).toBe(true);
  });

  it("accepts a stored HH:MM:SS value that matches a real window once normalized", () => {
    // PostgREST can serialize a Postgres `time` column with seconds — a
    // legitimately valid stored time must not be rejected just because it
    // arrives as "09:00:00" instead of the generated "09:00".
    expect(isValidStoreWindow(PICKUP_DATE, "09:00:00")).toBe(true);
  });

  it("rejects trailing garbage after a valid-looking prefix, without throwing", () => {
    expect(() => isValidStoreWindow(PICKUP_DATE, "18:00garbage")).not.toThrow();
    expect(isValidStoreWindow(PICKUP_DATE, "18:00garbage")).toBe(false);
  });

  it("rejects invalid seconds, without throwing", () => {
    expect(() => isValidStoreWindow(PICKUP_DATE, "18:00:99")).not.toThrow();
    expect(isValidStoreWindow(PICKUP_DATE, "18:00:99")).toBe(false);
  });
});

describe("isFutureStoreWindow", () => {
  const NOW = new Date("2026-09-11T19:30:00Z"); // 3:30 PM in Brooklyn

  it("accepts a later window today", () => {
    expect(isFutureStoreWindow("2026-09-11", "16:00", NOW)).toBe(true);
  });

  it("rejects a window that has already started today", () => {
    expect(isFutureStoreWindow("2026-09-11", "15:00", NOW)).toBe(false);
  });

  it("rejects a past date even though it is a normal store window", () => {
    expect(isFutureStoreWindow("2026-09-10", "18:00", NOW)).toBe(false);
  });

  it("accepts a valid window on a future date, including Postgres seconds", () => {
    expect(isFutureStoreWindow("2026-09-12", "09:00:00", NOW)).toBe(true);
  });

  it("rejects the current window at its exact start boundary", () => {
    const exactlyFourPm = new Date("2026-09-11T20:00:00Z");
    expect(isFutureStoreWindow("2026-09-11", "16:00", exactlyFourPm)).toBe(false);
  });
});

describe("isDeliveryNotBeforePickup", () => {
  it("accepts delivery on a later date", () => {
    expect(
      isDeliveryNotBeforePickup({
        confirmedPickupDate: PICKUP_DATE,
        confirmedPickupTime: "10:00",
        confirmedDeliveryDate: DELIVERY_DATE,
        confirmedDeliveryTime: "09:00",
      })
    ).toBe(true);
  });

  it("accepts a later window the same day", () => {
    expect(
      isDeliveryNotBeforePickup({
        confirmedPickupDate: PICKUP_DATE,
        confirmedPickupTime: "10:00",
        confirmedDeliveryDate: PICKUP_DATE,
        confirmedDeliveryTime: "14:00",
      })
    ).toBe(true);
  });

  it("rejects the exact same pickup and delivery window", () => {
    expect(
      isDeliveryNotBeforePickup({
        confirmedPickupDate: PICKUP_DATE,
        confirmedPickupTime: "10:00",
        confirmedDeliveryDate: PICKUP_DATE,
        confirmedDeliveryTime: "10:00",
      })
    ).toBe(false);
  });

  it("rejects an overlapping window (10:00 pickup, 10:30 delivery)", () => {
    expect(
      isDeliveryNotBeforePickup({
        confirmedPickupDate: PICKUP_DATE,
        confirmedPickupTime: "10:00",
        confirmedDeliveryDate: PICKUP_DATE,
        confirmedDeliveryTime: "10:30",
      })
    ).toBe(false);
  });

  it("accepts delivery starting exactly one window after pickup (10:00 pickup, 11:00 delivery)", () => {
    expect(
      isDeliveryNotBeforePickup({
        confirmedPickupDate: PICKUP_DATE,
        confirmedPickupTime: "10:00",
        confirmedDeliveryDate: PICKUP_DATE,
        confirmedDeliveryTime: "11:00",
      })
    ).toBe(true);
  });

  it("rejects an earlier date", () => {
    expect(
      isDeliveryNotBeforePickup({
        confirmedPickupDate: DELIVERY_DATE,
        confirmedPickupTime: "10:00",
        confirmedDeliveryDate: PICKUP_DATE,
        confirmedDeliveryTime: "10:00",
      })
    ).toBe(false);
  });

  it("rejects an earlier window the same day", () => {
    expect(
      isDeliveryNotBeforePickup({
        confirmedPickupDate: PICKUP_DATE,
        confirmedPickupTime: "14:00",
        confirmedDeliveryDate: PICKUP_DATE,
        confirmedDeliveryTime: "10:00",
      })
    ).toBe(false);
  });
});

describe("validateProposedTime", () => {
  it("returns null for a fully valid proposal", () => {
    const pickupWindow = getWindowsForDate(PICKUP_DATE, { excludePast: false })[0];
    const deliveryWindow = getWindowsForDate(DELIVERY_DATE, { excludePast: false })[0];
    expect(
      validateProposedTime({
        confirmedPickupDate: PICKUP_DATE,
        confirmedPickupTime: pickupWindow.value,
        confirmedDeliveryDate: DELIVERY_DATE,
        confirmedDeliveryTime: deliveryWindow.value,
      })
    ).toBeNull();
  });

  it("rejects an out-of-hours pickup window even if delivery is fine", () => {
    const deliveryWindow = getWindowsForDate(DELIVERY_DATE, { excludePast: false })[0];
    const result = validateProposedTime({
      confirmedPickupDate: PICKUP_DATE,
      confirmedPickupTime: "03:00",
      confirmedDeliveryDate: DELIVERY_DATE,
      confirmedDeliveryTime: deliveryWindow.value,
    });
    expect(result).toMatch(/pickup/i);
  });

  it("rejects an out-of-hours delivery window even if pickup is fine", () => {
    const pickupWindow = getWindowsForDate(PICKUP_DATE, { excludePast: false })[0];
    const result = validateProposedTime({
      confirmedPickupDate: PICKUP_DATE,
      confirmedPickupTime: pickupWindow.value,
      confirmedDeliveryDate: DELIVERY_DATE,
      confirmedDeliveryTime: "23:30",
    });
    expect(result).toMatch(/delivery/i);
  });

  it("rejects delivery scheduled before pickup even when both windows are individually valid", () => {
    const windows = getWindowsForDate(PICKUP_DATE, { excludePast: false });
    const earlyWindow = windows[0];
    const lateWindow = windows[windows.length - 1];
    const result = validateProposedTime({
      confirmedPickupDate: PICKUP_DATE,
      confirmedPickupTime: lateWindow.value,
      confirmedDeliveryDate: PICKUP_DATE,
      confirmedDeliveryTime: earlyWindow.value,
    });
    expect(result).toMatch(/before/i);
  });
});

describe("validatePreferredTimeForServiceType", () => {
  const FAR_FUTURE_PICKUP = "2026-12-01"; // pickup+1..+4 all safely away from "already started" filtering

  describe("Wash & Fold Standard/Flexible", () => {
    it("accepts a Standard request that clears the 22-hour gap", () => {
      const result = validatePreferredTimeForServiceType("wash_and_fold", "standard", {
        pickupDate: FAR_FUTURE_PICKUP,
        pickupTime: "09:00",
        deliveryDate: "2026-12-02",
        deliveryTime: "09:00",
      });
      expect(result).toBeNull();
    });

    it("accepts valid HH:MM:SS pickup and delivery values, as PostgREST may actually return them", () => {
      const result = validatePreferredTimeForServiceType("wash_and_fold", "standard", {
        pickupDate: FAR_FUTURE_PICKUP,
        pickupTime: "09:00:00",
        deliveryDate: "2026-12-02",
        deliveryTime: "09:00:00",
      });
      expect(result).toBeNull();
    });

    it("rejects a legacy request that predates the 22-hour gap rule", () => {
      const result = validatePreferredTimeForServiceType("wash_and_fold", "standard", {
        pickupDate: FAR_FUTURE_PICKUP,
        pickupTime: "18:00",
        deliveryDate: "2026-12-02",
        deliveryTime: "16:00", // only 21 hours after the pickup window ends
      });
      expect(result).toMatch(/gap after pickup/i);
    });

    it("rejects a Standard delivery date outside its valid range", () => {
      const result = validatePreferredTimeForServiceType("wash_and_fold", "standard", {
        pickupDate: FAR_FUTURE_PICKUP,
        pickupTime: "09:00",
        deliveryDate: "2026-12-03", // pickup+2 — only Flexible allows this
        deliveryTime: "09:00",
      });
      expect(result).toMatch(/valid range/i);
    });

    it("accepts Flexible's pickup+2 option even for the latest pickup window", () => {
      const result = validatePreferredTimeForServiceType("wash_and_fold", "flexible", {
        pickupDate: FAR_FUTURE_PICKUP,
        pickupTime: "18:00",
        deliveryDate: "2026-12-03",
        deliveryTime: "09:00",
      });
      expect(result).toBeNull();
    });
  });

  describe("Same-Day Rush", () => {
    it("accepts an eligible pickup with the fixed evening delivery", () => {
      const result = validatePreferredTimeForServiceType("wash_and_fold", "same_day", {
        pickupDate: FAR_FUTURE_PICKUP,
        pickupTime: "11:00",
        deliveryDate: FAR_FUTURE_PICKUP,
        deliveryTime: "18:00",
      });
      expect(result).toBeNull();
    });

    it("rejects a pickup time that's no longer Same-Day eligible", () => {
      const result = validatePreferredTimeForServiceType("wash_and_fold", "same_day", {
        pickupDate: FAR_FUTURE_PICKUP,
        pickupTime: "12:00",
        deliveryDate: FAR_FUTURE_PICKUP,
        deliveryTime: "18:00",
      });
      expect(result).toMatch(/Same-Day eligible/i);
    });

    it("accepts '11:00:00' pickup and '18:00:00' delivery, as PostgREST may actually return them", () => {
      const result = validatePreferredTimeForServiceType("wash_and_fold", "same_day", {
        pickupDate: FAR_FUTURE_PICKUP,
        pickupTime: "11:00:00",
        deliveryDate: FAR_FUTURE_PICKUP,
        deliveryTime: "18:00:00",
      });
      expect(result).toBeNull();
    });
  });

  describe("Dry Cleaning / Both", () => {
    it("accepts the fourth-calendar-day request", () => {
      const result = validatePreferredTimeForServiceType("dry_cleaning", "dry_cleaning_timeline", {
        pickupDate: FAR_FUTURE_PICKUP,
        pickupTime: "09:00",
        deliveryDate: "2026-12-05", // pickup+4
        deliveryTime: "09:00",
      });
      expect(result).toBeNull();
    });

    it("rejects a legacy pickup+3 request with a useful, specific error", () => {
      const result = validatePreferredTimeForServiceType("dry_cleaning", "dry_cleaning_timeline", {
        pickupDate: FAR_FUTURE_PICKUP,
        pickupTime: "09:00",
        deliveryDate: "2026-12-04", // pickup+3
        deliveryTime: "09:00",
      });
      expect(result).toMatch(/fourth calendar day/i);
    });

    it("Both follows the exact same rule as Dry Cleaning-only", () => {
      const result = validatePreferredTimeForServiceType("both", "dry_cleaning_timeline", {
        pickupDate: FAR_FUTURE_PICKUP,
        pickupTime: "09:00",
        deliveryDate: "2026-12-04",
        deliveryTime: "09:00",
      });
      expect(result).toMatch(/fourth calendar day/i);
    });

    it("accepts valid HH:MM:SS values on day 4, as PostgREST may actually return them", () => {
      const dryCleaningOnly = validatePreferredTimeForServiceType("dry_cleaning", "dry_cleaning_timeline", {
        pickupDate: FAR_FUTURE_PICKUP,
        pickupTime: "09:00:00",
        deliveryDate: "2026-12-05", // pickup+4
        deliveryTime: "09:00:00",
      });
      const both = validatePreferredTimeForServiceType("both", "dry_cleaning_timeline", {
        pickupDate: FAR_FUTURE_PICKUP,
        pickupTime: "09:00:00",
        deliveryDate: "2026-12-05",
        deliveryTime: "09:00:00",
      });
      expect(dryCleaningOnly).toBeNull();
      expect(both).toBeNull();
    });
  });

  it("rejects malformed stored times without throwing, across every service type", () => {
    const malformedValues = ["not-a-time", "25:00", "10:75", "18:00garbage", "18:00:99", "18:00:00garbage"];
    for (const malformed of malformedValues) {
      for (const [serviceType, serviceSpeed] of [
        ["wash_and_fold", "standard"],
        ["wash_and_fold", "same_day"],
        ["dry_cleaning", "dry_cleaning_timeline"],
      ] as const) {
        expect(() =>
          validatePreferredTimeForServiceType(serviceType, serviceSpeed, {
            pickupDate: FAR_FUTURE_PICKUP,
            pickupTime: malformed,
            deliveryDate: FAR_FUTURE_PICKUP,
            deliveryTime: "09:00",
          })
        ).not.toThrow();
        expect(() =>
          validatePreferredTimeForServiceType(serviceType, serviceSpeed, {
            pickupDate: FAR_FUTURE_PICKUP,
            pickupTime: "09:00",
            deliveryDate: FAR_FUTURE_PICKUP,
            deliveryTime: malformed,
          })
        ).not.toThrow();
      }
    }
  });

  it("does not restrict the manual proposed-time editor — isValidStoreWindow allows a pickup+3 Dry Cleaning date staff confirm by hand", () => {
    // validatePreferredTimeForServiceType is only used by approveRequestedTime;
    // the manual editor calls isValidStoreWindow/isDeliveryNotBeforePickup
    // directly and has no day-4-only restriction at all.
    const plusThree = "2026-12-04";
    expect(isValidStoreWindow(plusThree, "09:00")).toBe(true);
    expect(
      isDeliveryNotBeforePickup({
        confirmedPickupDate: FAR_FUTURE_PICKUP,
        confirmedPickupTime: "09:00",
        confirmedDeliveryDate: plusThree,
        confirmedDeliveryTime: "09:00",
      })
    ).toBe(true);
  });
});

describe("hasCompleteProposedTime", () => {
  it("true when all four fields are set", () => {
    expect(
      hasCompleteProposedTime({
        confirmed_pickup_date: PICKUP_DATE,
        confirmed_pickup_time: "10:00",
        confirmed_delivery_date: DELIVERY_DATE,
        confirmed_delivery_time: "09:00",
      })
    ).toBe(true);
  });

  it("false when delivery fields are missing — an incomplete confirmation", () => {
    expect(
      hasCompleteProposedTime({
        confirmed_pickup_date: PICKUP_DATE,
        confirmed_pickup_time: "10:00",
        confirmed_delivery_date: null,
        confirmed_delivery_time: null,
      })
    ).toBe(false);
  });

  it("false when pickup fields are missing", () => {
    expect(
      hasCompleteProposedTime({
        confirmed_pickup_date: null,
        confirmed_pickup_time: null,
        confirmed_delivery_date: DELIVERY_DATE,
        confirmed_delivery_time: "09:00",
      })
    ).toBe(false);
  });

  it("false when nothing is set", () => {
    expect(
      hasCompleteProposedTime({
        confirmed_pickup_date: null,
        confirmed_pickup_time: null,
        confirmed_delivery_date: null,
        confirmed_delivery_time: null,
      })
    ).toBe(false);
  });
});

describe("isPreLifecycle", () => {
  it("true for pending and confirmed", () => {
    expect(isPreLifecycle("pending")).toBe(true);
    expect(isPreLifecycle("confirmed")).toBe(true);
  });

  it("false for every status at or past picked_up", () => {
    expect(isPreLifecycle("picked_up")).toBe(false);
    expect(isPreLifecycle("ready_for_delivery")).toBe(false);
    expect(isPreLifecycle("completed")).toBe(false);
    expect(isPreLifecycle("cancelled")).toBe(false);
  });
});

describe("post-pickup status preservation — build*Payload never move status once locked", () => {
  const preferred = {
    pickupDate: PICKUP_DATE,
    pickupTime: "10:00",
    deliveryDate: DELIVERY_DATE,
    deliveryTime: "09:00",
  };
  const proposedInput = {
    confirmedPickupDate: PICKUP_DATE,
    confirmedPickupTime: "10:00",
    confirmedDeliveryDate: DELIVERY_DATE,
    confirmedDeliveryTime: "09:00",
  };
  const lockedStatuses = ["picked_up", "ready_for_delivery", "completed", "cancelled"] as const;

  it("buildApproveTimePayload sets status to confirmed pre-lifecycle", () => {
    expect(buildApproveTimePayload(preferred, "pending", "user-1").status).toBe("confirmed");
    expect(buildApproveTimePayload(preferred, "confirmed", "user-1").status).toBe("confirmed");
  });

  it("buildApproveTimePayload omits status once picked_up or later, but still updates the times", () => {
    for (const status of lockedStatuses) {
      const payload = buildApproveTimePayload(preferred, status, "user-1");
      expect(payload).not.toHaveProperty("status");
      expect(payload.confirmed_pickup_date).toBe(preferred.pickupDate);
      expect(payload.confirmed_delivery_time).toBe(preferred.deliveryTime);
    }
  });

  it("buildSaveProposedTimePayload sets status to pending pre-lifecycle", () => {
    expect(buildSaveProposedTimePayload(proposedInput, "pending", "user-1").status).toBe("pending");
    expect(buildSaveProposedTimePayload(proposedInput, "confirmed", "user-1").status).toBe("pending");
  });

  it("buildSaveProposedTimePayload omits status once picked_up or later — the 'Update Confirmed Times' path", () => {
    for (const status of lockedStatuses) {
      const payload = buildSaveProposedTimePayload(proposedInput, status, "user-1");
      expect(payload).not.toHaveProperty("status");
      expect(payload.confirmed_delivery_time).toBe(proposedInput.confirmedDeliveryTime);
    }
  });

  it("buildClearProposedTimePayload sets status to pending pre-lifecycle", () => {
    expect(buildClearProposedTimePayload("confirmed", "user-1")).toEqual({
      confirmed_pickup_date: null,
      confirmed_pickup_time: null,
      confirmed_delivery_date: null,
      confirmed_delivery_time: null,
      status: "pending",
      updated_by: "user-1",
    });
  });

  it("buildClearProposedTimePayload clears the fields but omits status once picked_up or later", () => {
    for (const status of lockedStatuses) {
      const payload = buildClearProposedTimePayload(status, "user-1");
      expect(payload).not.toHaveProperty("status");
      expect(payload).toEqual({
        confirmed_pickup_date: null,
        confirmed_pickup_time: null,
        confirmed_delivery_date: null,
        confirmed_delivery_time: null,
        updated_by: "user-1",
      });
    }
  });
});

describe("canAdvanceToStatus", () => {
  const COMPLETE_SCHEDULE = {
    confirmed_pickup_date: PICKUP_DATE,
    confirmed_pickup_time: "10:00",
    confirmed_delivery_date: DELIVERY_DATE,
    confirmed_delivery_time: "09:00",
    paid: true,
    payment_method: "cash" as const,
  };
  const EMPTY_SCHEDULE = {
    confirmed_pickup_date: null,
    confirmed_pickup_time: null,
    confirmed_delivery_date: null,
    confirmed_delivery_time: null,
    paid: false,
    payment_method: null,
  };
  const UNGATED_STATUSES: BookingStatus[] = ["pending", "cancelled"];
  const GATED_STATUSES: BookingStatus[] = ["confirmed", "picked_up", "ready_for_delivery", "completed"];

  it("STATUSES_REQUIRING_CONFIRMED_SCHEDULE is exactly the four gated statuses, nothing more or less", () => {
    expect(new Set(STATUSES_REQUIRING_CONFIRMED_SCHEDULE)).toEqual(new Set(GATED_STATUSES));
    expect(STATUSES_REQUIRING_CONFIRMED_SCHEDULE.length).toBe(GATED_STATUSES.length);
  });

  it("pending is allowed without any confirmed schedule", () => {
    expect(canAdvanceToStatus("pending", EMPTY_SCHEDULE)).toBe(true);
  });

  it("cancelled is allowed without any confirmed schedule", () => {
    expect(canAdvanceToStatus("cancelled", EMPTY_SCHEDULE)).toBe(true);
  });

  it("pending and cancelled are allowed regardless of schedule completeness", () => {
    for (const status of UNGATED_STATUSES) {
      expect(canAdvanceToStatus(status, EMPTY_SCHEDULE)).toBe(true);
      expect(canAdvanceToStatus(status, COMPLETE_SCHEDULE)).toBe(true);
    }
  });

  it("confirmed is rejected without confirmed times", () => {
    expect(canAdvanceToStatus("confirmed", EMPTY_SCHEDULE)).toBe(false);
  });

  it("picked_up is rejected without confirmed times", () => {
    expect(canAdvanceToStatus("picked_up", EMPTY_SCHEDULE)).toBe(false);
  });

  it("ready_for_delivery is rejected without confirmed times", () => {
    expect(canAdvanceToStatus("ready_for_delivery", EMPTY_SCHEDULE)).toBe(false);
  });

  it("completed is rejected without confirmed times", () => {
    expect(canAdvanceToStatus("completed", EMPTY_SCHEDULE)).toBe(false);
  });

  it("every gated status is accepted once all four confirmed fields exist", () => {
    for (const status of GATED_STATUSES) {
      expect(canAdvanceToStatus(status, COMPLETE_SCHEDULE)).toBe(true);
    }
  });

  it("completed requires a recorded Cash or Zelle payment", () => {
    expect(canAdvanceToStatus("completed", { ...COMPLETE_SCHEDULE, paid: false })).toBe(false);
    expect(
      canAdvanceToStatus("completed", { ...COMPLETE_SCHEDULE, paid: true, payment_method: null })
    ).toBe(false);
    expect(
      canAdvanceToStatus("completed", { ...COMPLETE_SCHEDULE, paid: true, payment_method: "zelle" })
    ).toBe(true);
  });

  it("payment does not block cancellation or the earlier lifecycle statuses", () => {
    const unpaidCompleteSchedule = { ...COMPLETE_SCHEDULE, paid: false, payment_method: null };
    for (const status of ["pending", "confirmed", "picked_up", "ready_for_delivery", "cancelled"] as const) {
      expect(canAdvanceToStatus(status, unpaidCompleteSchedule)).toBe(true);
    }
  });

  it("every partial (incomplete) four-field combination is rejected for every gated status", () => {
    const fieldKeys = [
      "confirmed_pickup_date",
      "confirmed_pickup_time",
      "confirmed_delivery_date",
      "confirmed_delivery_time",
    ] as const;

    // All 16 combinations of the 4 fields being present/absent — every one
    // except "all 4 present" must be rejected, for every gated status.
    for (let bitmask = 0; bitmask < 16; bitmask++) {
      const schedule = {
        confirmed_pickup_date: bitmask & 1 ? PICKUP_DATE : null,
        confirmed_pickup_time: bitmask & 2 ? "10:00" : null,
        confirmed_delivery_date: bitmask & 4 ? DELIVERY_DATE : null,
        confirmed_delivery_time: bitmask & 8 ? "09:00" : null,
        paid: true,
        payment_method: "cash" as const,
      };
      const isComplete = fieldKeys.every((key) => schedule[key] !== null);

      for (const status of GATED_STATUSES) {
        expect(canAdvanceToStatus(status, schedule)).toBe(isComplete);
      }
    }
  });
});

describe("hasRecordedPayment", () => {
  it("requires the paid flag and a supported method together", () => {
    expect(hasRecordedPayment({ paid: true, payment_method: "cash" })).toBe(true);
    expect(hasRecordedPayment({ paid: true, payment_method: "zelle" })).toBe(true);
    expect(hasRecordedPayment({ paid: true, payment_method: null })).toBe(false);
    expect(hasRecordedPayment({ paid: false, payment_method: "cash" })).toBe(false);
    expect(hasRecordedPayment({ paid: false, payment_method: null })).toBe(false);
  });
});

describe("proposedScheduleMatchesPreferred", () => {
  const preferred = {
    pickupDate: PICKUP_DATE,
    pickupTime: "10:00",
    deliveryDate: DELIVERY_DATE,
    deliveryTime: "09:00",
  };

  it("true when every field matches exactly", () => {
    expect(
      proposedScheduleMatchesPreferred(preferred, {
        pickupDate: PICKUP_DATE,
        pickupTime: "10:00",
        deliveryDate: DELIVERY_DATE,
        deliveryTime: "09:00",
      })
    ).toBe(true);
  });

  it("true when times differ only by PostgREST's HH:MM vs HH:MM:SS serialization", () => {
    expect(
      proposedScheduleMatchesPreferred(preferred, {
        pickupDate: PICKUP_DATE,
        pickupTime: "10:00:00",
        deliveryDate: DELIVERY_DATE,
        deliveryTime: "09:00:00",
      })
    ).toBe(true);
  });

  it("false when the proposed pickup date differs", () => {
    expect(
      proposedScheduleMatchesPreferred(preferred, {
        pickupDate: DELIVERY_DATE,
        pickupTime: "10:00",
        deliveryDate: DELIVERY_DATE,
        deliveryTime: "09:00",
      })
    ).toBe(false);
  });

  it("false when the proposed pickup time differs", () => {
    expect(
      proposedScheduleMatchesPreferred(preferred, {
        pickupDate: PICKUP_DATE,
        pickupTime: "14:00",
        deliveryDate: DELIVERY_DATE,
        deliveryTime: "09:00",
      })
    ).toBe(false);
  });

  it("false when the proposed delivery date differs", () => {
    expect(
      proposedScheduleMatchesPreferred(preferred, {
        pickupDate: PICKUP_DATE,
        pickupTime: "10:00",
        deliveryDate: PICKUP_DATE,
        deliveryTime: "09:00",
      })
    ).toBe(false);
  });

  it("false when the proposed delivery time differs", () => {
    expect(
      proposedScheduleMatchesPreferred(preferred, {
        pickupDate: PICKUP_DATE,
        pickupTime: "10:00",
        deliveryDate: DELIVERY_DATE,
        deliveryTime: "16:00",
      })
    ).toBe(false);
  });

  it("false when the booking has no preferred delivery on file — nothing to match against", () => {
    expect(
      proposedScheduleMatchesPreferred(
        { pickupDate: PICKUP_DATE, pickupTime: "10:00", deliveryDate: null, deliveryTime: null },
        { pickupDate: PICKUP_DATE, pickupTime: "10:00", deliveryDate: DELIVERY_DATE, deliveryTime: "09:00" }
      )
    ).toBe(false);
  });
});
