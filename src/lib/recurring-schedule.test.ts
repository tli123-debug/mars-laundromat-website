import { describe, expect, it } from "vitest";
import {
  advanceByCadence,
  advanceToDueDate,
  advanceToNextAvailablePickup,
  buildCancelSchedulePayload,
  cadenceDays,
  decideSkipNextOccurrence,
  isEligibleForRecurringOffer,
  isValidRecurringFrequency,
  nextDayDeliveryDate,
  normalizeAddress,
  normalizePhoneNumber,
  RECURRING_BADGE_LABELS,
  recurringBadgeKind,
  validateRecurringWindows,
} from "./recurring-schedule";
import { addDays, getBrooklynToday } from "@/lib/booking-hours";
import type { RecurringFrequency, RecurringScheduleStatus } from "@/types/database.types";

const FUTURE_PICKUP_DATE = addDays(getBrooklynToday(), 10);

describe("isValidRecurringFrequency", () => {
  it("accepts weekly and every_two_weeks", () => {
    expect(isValidRecurringFrequency("weekly")).toBe(true);
    expect(isValidRecurringFrequency("every_two_weeks")).toBe(true);
  });

  it("rejects anything else, including the old service-speed spellings", () => {
    for (const value of ["biweekly", "every-two-weeks", "monthly", "standard", "flexible", "same_day", "", "Weekly"]) {
      expect(isValidRecurringFrequency(value)).toBe(false);
    }
  });
});

describe("cadenceDays", () => {
  it("weekly is exactly 7", () => {
    expect(cadenceDays("weekly")).toBe(7);
  });

  it("every_two_weeks is exactly 14", () => {
    expect(cadenceDays("every_two_weeks")).toBe(14);
  });
});

describe("advanceByCadence", () => {
  it("weekly advances by 7 calendar days", () => {
    expect(advanceByCadence("2026-09-14", "weekly")).toBe("2026-09-21");
  });

  it("every_two_weeks advances by 14 calendar days", () => {
    expect(advanceByCadence("2026-09-14", "every_two_weeks")).toBe("2026-09-28");
  });

  it("crosses a month boundary correctly", () => {
    expect(advanceByCadence("2026-09-28", "weekly")).toBe("2026-10-05");
  });

  it("crosses a year boundary correctly", () => {
    expect(advanceByCadence("2026-12-29", "weekly")).toBe("2027-01-05");
  });
});

describe("advanceToDueDate — stale-date advancement without backfilling history", () => {
  it("leaves an already-current date untouched", () => {
    expect(advanceToDueDate("2026-09-14", "weekly", "2026-09-14")).toBe("2026-09-14");
  });

  it("leaves a future date untouched", () => {
    expect(advanceToDueDate("2026-09-21", "weekly", "2026-09-14")).toBe("2026-09-21");
  });

  it("advances a single missed weekly occurrence by exactly one cadence step", () => {
    // Stale by 8 days (just past one week) -> lands on the next weekly date, not today.
    expect(advanceToDueDate("2026-09-14", "weekly", "2026-09-22")).toBe("2026-09-28");
  });

  it("advances through several missed weekly occurrences (e.g. after a long pause)", () => {
    // 2026-09-14 + 7*7 = 2026-11-02 is the first weekly date >= 2026-11-01.
    expect(advanceToDueDate("2026-09-14", "weekly", "2026-11-01")).toBe("2026-11-02");
  });

  it("advances through several missed every_two_weeks occurrences", () => {
    // 2026-09-14 + 14*4 = 2026-11-09 is the first biweekly date >= 2026-11-01.
    expect(advanceToDueDate("2026-09-14", "every_two_weeks", "2026-11-01")).toBe("2026-11-09");
  });

  it("landing exactly on asOfDate counts as due, not stale", () => {
    expect(advanceToDueDate("2026-09-07", "weekly", "2026-09-14")).toBe("2026-09-14");
  });
});

describe("advanceToNextAvailablePickup — Resume must not reactivate an elapsed pickup window", () => {
  it("a genuine future date is returned untouched, regardless of pickup time or now", () => {
    const now = new Date("2026-09-14T14:00:00Z"); // 10:00 AM EDT
    expect(advanceToNextAvailablePickup("2026-09-21", "weekly", "09:00", now)).toBe("2026-09-21");
  });

  it("today with the window still upcoming (before it starts) stays today", () => {
    const now = new Date("2026-09-14T12:00:00Z"); // 8:00 AM EDT — before the 9:00 AM window
    expect(advanceToNextAvailablePickup("2026-09-14", "weekly", "09:00", now)).toBe("2026-09-14");
  });

  it("the owner's exact example: resuming a 9:00-10:00 AM schedule at 5:00 PM today advances one cadence step", () => {
    const now = new Date("2026-09-14T21:00:00Z"); // 5:00 PM EDT
    expect(advanceToNextAvailablePickup("2026-09-14", "weekly", "09:00", now)).toBe("2026-09-21");
  });

  it("boundary: now exactly at the window's start minute counts as already started (matches getWindowsForDate's own <= boundary)", () => {
    const now = new Date("2026-09-14T13:00:00Z"); // 9:00 AM EDT exactly
    expect(advanceToNextAvailablePickup("2026-09-14", "weekly", "09:00", now)).toBe("2026-09-21");
  });

  it("a genuinely stale (past) date is first caught up by date, then advanced again if that lands on today with an elapsed window", () => {
    const now = new Date("2026-09-14T21:00:00Z"); // 5:00 PM EDT, Brooklyn-today = 2026-09-14
    // 2026-08-31 -> +7 -> 2026-09-07 -> +7 -> 2026-09-14 (today), which then
    // fails the elapsed-window check at 5 PM and advances once more.
    expect(advanceToNextAvailablePickup("2026-08-31", "weekly", "09:00", now)).toBe("2026-09-21");
  });

  it("works the same way for every_two_weeks", () => {
    const now = new Date("2026-09-14T21:00:00Z"); // 5:00 PM EDT
    expect(advanceToNextAvailablePickup("2026-09-14", "every_two_weeks", "09:00", now)).toBe("2026-09-28");
  });

  it("a later window (e.g. 6:00-7:00 PM) can still be available even late in the day", () => {
    const now = new Date("2026-09-14T21:00:00Z"); // 5:00 PM EDT — before the 6:00 PM window
    expect(advanceToNextAvailablePickup("2026-09-14", "weekly", "18:00", now)).toBe("2026-09-14");
  });

  it("accepts a stored HH:MM:SS pickup time exactly like HH:MM", () => {
    const now = new Date("2026-09-14T21:00:00Z"); // 5:00 PM EDT
    expect(advanceToNextAvailablePickup("2026-09-14", "weekly", "09:00:00", now)).toBe("2026-09-21");
  });
});

describe("nextDayDeliveryDate", () => {
  it("returns exactly pickup+1", () => {
    expect(nextDayDeliveryDate("2026-09-14")).toBe("2026-09-15");
  });

  it("crosses a month boundary correctly", () => {
    expect(nextDayDeliveryDate("2026-09-30")).toBe("2026-10-01");
  });
});

describe("validateRecurringWindows", () => {
  // FUTURE_PICKUP_DATE is real-"today" + 10 days, so it's never treated as
  // "today" by getWindowsForDate()'s own excludePast logic — no fake `now`
  // needed, matching how booking-schema.test.ts exercises the same rules.
  function validInput(overrides: Partial<Parameters<typeof validateRecurringWindows>[0]> = {}) {
    return {
      pickupDate: FUTURE_PICKUP_DATE,
      pickupTime: "09:00",
      deliveryDate: addDays(FUTURE_PICKUP_DATE, 1),
      deliveryTime: "10:00",
      ...overrides,
    };
  }

  it("accepts a 9 AM pickup with a next-day 10 AM delivery", () => {
    expect(validateRecurringWindows(validInput())).toBeNull();
  });

  it("rejects a pickup date in the past", () => {
    const yesterday = addDays(getBrooklynToday(), -1);
    const result = validateRecurringWindows(validInput({ pickupDate: yesterday }));
    expect(result).not.toBeNull();
  });

  it("rejects a pickup time that isn't a real store window", () => {
    const result = validateRecurringWindows(validInput({ pickupTime: "09:17" }));
    expect(result).not.toBeNull();
  });

  it("rejects same-day delivery", () => {
    const result = validateRecurringWindows(validInput({ deliveryDate: FUTURE_PICKUP_DATE }));
    expect(result).not.toBeNull();
  });

  it("rejects pickup+2 delivery — V1 has no Flexible option", () => {
    const result = validateRecurringWindows(
      validInput({ deliveryDate: addDays(FUTURE_PICKUP_DATE, 2) })
    );
    expect(result).not.toBeNull();
  });

  it("enforces the existing 22-hour gap: 6-7 PM pickup rejects a next-day 4-5 PM delivery", () => {
    const result = validateRecurringWindows(validInput({ pickupTime: "18:00", deliveryTime: "16:00" }));
    expect(result).not.toBeNull();
  });

  it("enforces the existing 22-hour gap: 6-7 PM pickup accepts the earliest valid next-day 5-6 PM delivery", () => {
    const result = validateRecurringWindows(validInput({ pickupTime: "18:00", deliveryTime: "17:00" }));
    expect(result).toBeNull();
  });

  it("a 9 AM pickup accepts every delivery window the next day (the gap is never the binding constraint)", () => {
    const result = validateRecurringWindows(validInput({ pickupTime: "09:00", deliveryTime: "09:00" }));
    expect(result).toBeNull();
  });

  it("never throws on a malformed pickup time", () => {
    expect(() => validateRecurringWindows(validInput({ pickupTime: "not-a-time" }))).not.toThrow();
    expect(validateRecurringWindows(validInput({ pickupTime: "not-a-time" }))).not.toBeNull();
  });

  it("accepts a stored HH:MM:SS pickup/delivery time exactly like HH:MM", () => {
    const result = validateRecurringWindows(
      validInput({ pickupTime: "09:00:00", deliveryTime: "10:00:00" })
    );
    expect(result).toBeNull();
  });
});

describe("normalizePhoneNumber", () => {
  it("strips non-digit formatting", () => {
    expect(normalizePhoneNumber("(718) 555-0134")).toBe("7185550134");
  });

  it("leaves a bare 10-digit number unchanged", () => {
    expect(normalizePhoneNumber("7185550134")).toBe("7185550134");
  });

  it("drops a leading US country-code 1 from an 11-digit number", () => {
    expect(normalizePhoneNumber("17185550134")).toBe("7185550134");
  });

  it("drops the country code from a formatted +1 number", () => {
    expect(normalizePhoneNumber("+1 (718) 555-0134")).toBe("7185550134");
  });

  it("drops the country code from a dashed 1-prefixed number", () => {
    expect(normalizePhoneNumber("1-718-555-0134")).toBe("7185550134");
  });

  it("all equivalent formats normalize identically", () => {
    const normalized = normalizePhoneNumber("7185550134");
    for (const variant of ["(718) 555-0134", "718-555-0134", "718.555.0134", "+17185550134", "1 718 555 0134"]) {
      expect(normalizePhoneNumber(variant)).toBe(normalized);
    }
  });
});

describe("normalizeAddress", () => {
  it("trims leading/trailing whitespace", () => {
    expect(normalizeAddress("  123 7th Ave  ")).toBe("123 7th ave");
  });

  it("lowercases", () => {
    expect(normalizeAddress("123 7TH AVE")).toBe("123 7th ave");
  });

  it("equivalent addresses normalize identically", () => {
    const normalized = normalizeAddress("123 7th Ave, Brooklyn, NY 11215");
    expect(normalizeAddress("  123 7th ave, brooklyn, ny 11215  ")).toBe(normalized);
    expect(normalizeAddress("123 7TH AVE, BROOKLYN, NY 11215")).toBe(normalized);
  });

  it("does not collapse internal whitespace differences (matches the SQL index's lower(btrim()) exactly, not a fuzzier match)", () => {
    expect(normalizeAddress("123  7th Ave")).not.toBe(normalizeAddress("123 7th Ave"));
  });
});

describe("RECURRING_BADGE_LABELS / recurringBadgeKind", () => {
  it("has a label for every possible badge kind", () => {
    expect(RECURRING_BADGE_LABELS.weekly).toBe("Recurring: Weekly 定期：每周");
    expect(RECURRING_BADGE_LABELS.every_two_weeks).toBe("Recurring: Every 2 Weeks 定期：每两周");
    expect(RECURRING_BADGE_LABELS.paused).toBe("Recurring Paused 定期服务已暂停");
    expect(RECURRING_BADGE_LABELS.cancelled).toBe("Recurring Cancelled 定期服务已取消");
  });

  it("an active weekly schedule shows the weekly badge", () => {
    expect(recurringBadgeKind("active", "weekly")).toBe("weekly");
  });

  it("an active every_two_weeks schedule shows the every_two_weeks badge", () => {
    expect(recurringBadgeKind("active", "every_two_weeks")).toBe("every_two_weeks");
  });

  it("a paused schedule shows the paused badge regardless of frequency", () => {
    expect(recurringBadgeKind("paused", "weekly")).toBe("paused");
    expect(recurringBadgeKind("paused", "every_two_weeks")).toBe("paused");
  });

  it("a cancelled schedule shows the cancelled badge regardless of frequency", () => {
    expect(recurringBadgeKind("cancelled", "weekly")).toBe("cancelled");
    expect(recurringBadgeKind("cancelled", "every_two_weeks")).toBe("cancelled");
  });

  it("every RecurringScheduleStatus x RecurringFrequency pair resolves to a labeled badge kind", () => {
    const statuses: RecurringScheduleStatus[] = ["active", "paused", "cancelled"];
    const frequencies: RecurringFrequency[] = ["weekly", "every_two_weeks"];
    for (const status of statuses) {
      for (const frequency of frequencies) {
        const kind = recurringBadgeKind(status, frequency);
        expect(RECURRING_BADGE_LABELS[kind]).toBeTruthy();
      }
    }
  });
});

describe("decideSkipNextOccurrence", () => {
  // Matches the owner's own worked example exactly: a weekly schedule
  // whose pointer has already been advanced (by the generator, when it
  // created the Sep 7 booking) to Sep 14.
  const POINTER = "2026-09-14";
  const GENERATED_DATE = "2026-09-07";
  const ADVANCED_POINTER = "2026-09-21";

  it("Pointer Sep 14 + pending generated Sep 7 => cancel Sep 7, keep pointer Sep 14 (cancel_only, no re-advance)", () => {
    const result = decideSkipNextOccurrence(POINTER, {
      id: "booking-1",
      status: "pending",
      occurrenceDate: GENERATED_DATE,
    });
    expect(result).toEqual({ action: "cancel_only", bookingId: "booking-1" });
  });

  it("Pointer Sep 14 + confirmed generated Sep 7 => reject, nothing altered", () => {
    const result = decideSkipNextOccurrence(POINTER, {
      id: "booking-1",
      status: "confirmed",
      occurrenceDate: GENERATED_DATE,
    });
    expect(result.action).toBe("rejected");
  });

  it("rejects every other progressed status the same way", () => {
    for (const status of ["picked_up", "ready_for_delivery", "completed"] as const) {
      const result = decideSkipNextOccurrence(POINTER, {
        id: "booking-1",
        status,
        occurrenceDate: GENERATED_DATE,
      });
      expect(result.action).toBe("rejected");
    }
  });

  it("Pointer Sep 14 + no upcoming generated booking => advance pointer to Sep 21", () => {
    expect(decideSkipNextOccurrence(POINTER, null)).toEqual({ action: "advance_only" });
  });

  it("Pointer Sep 14 + already-cancelled Sep 7 => advance pointer to Sep 21 (caller excludes cancelled rows, surfacing as null)", () => {
    // The Server Action's own lookup filters out status='cancelled'
    // before ever calling this function — an already-cancelled occurrence
    // is indistinguishable from "nothing generated yet" by the time it
    // reaches here, which is exactly the point: both advance_only.
    expect(decideSkipNextOccurrence(POINTER, null)).toEqual({ action: "advance_only" });
  });

  it("Defensive: pointer Sep 14 + pending generated Sep 14 (occurrenceDate equals nextPickupDate) => cancel it AND advance to Sep 21", () => {
    const result = decideSkipNextOccurrence(POINTER, {
      id: "booking-1",
      status: "pending",
      occurrenceDate: POINTER,
    });
    expect(result).toEqual({ action: "cancel_and_advance", bookingId: "booking-1" });
  });

  it("advance_only and cancel_and_advance both actually advance the pointer by one cadence step when applied", () => {
    // Documents what the Server Action does with these two outcomes —
    // decideSkipNextOccurrence itself never touches dates, it only
    // signals which action to take.
    expect(advanceByCadence(POINTER, "weekly")).toBe(ADVANCED_POINTER);
  });
});

describe("buildCancelSchedulePayload", () => {
  const NOW = new Date("2026-09-14T18:00:00Z");

  it("sets status cancelled, a real cancelled_at, and explicitly nulls paused_at", () => {
    const payload = buildCancelSchedulePayload("user-123", NOW);
    expect(payload).toEqual({
      status: "cancelled",
      cancelled_at: NOW.toISOString(),
      paused_at: null,
      updated_by: "user-123",
    });
  });

  it("produces a constraint-compatible payload when cancelling from active (cancelled_at set, paused_at already null so no conflict)", () => {
    const payload = buildCancelSchedulePayload("user-123", NOW);
    // recurring_schedules_status_timestamps_check: (status='cancelled') = (cancelled_at is not null)
    expect(payload.status).toBe("cancelled");
    expect(payload.cancelled_at).not.toBeNull();
  });

  it("produces a constraint-compatible payload when cancelling from paused — paused_at is explicitly cleared, not left stale", () => {
    const payload = buildCancelSchedulePayload("user-123", NOW);
    // The same unconditional payload is used regardless of the prior
    // status — this is what actually makes cancelling FROM paused safe:
    // (status='paused') = (paused_at is not null) would otherwise reject
    // a cancelled row that still carried a non-null paused_at from before.
    expect(payload.paused_at).toBeNull();
  });

  it("is unconditional — the same shape every time, regardless of prior schedule state", () => {
    expect(buildCancelSchedulePayload("user-a", NOW)).toEqual(buildCancelSchedulePayload("user-a", NOW));
  });
});

describe("isEligibleForRecurringOffer", () => {
  it("eligible: completed wash_and_fold, no existing schedule", () => {
    expect(isEligibleForRecurringOffer({ status: "completed", service_type: "wash_and_fold" }, false)).toBe(
      true
    );
  });

  it("eligible: completed both, no existing schedule — Both orders can still offer recurring Wash & Fold", () => {
    expect(isEligibleForRecurringOffer({ status: "completed", service_type: "both" }, false)).toBe(true);
  });

  it("not eligible: dry_cleaning-only, even if completed with no existing schedule", () => {
    expect(isEligibleForRecurringOffer({ status: "completed", service_type: "dry_cleaning" }, false)).toBe(
      false
    );
  });

  it("not eligible: not yet completed", () => {
    for (const status of ["pending", "confirmed", "picked_up", "ready_for_delivery", "cancelled"] as const) {
      expect(isEligibleForRecurringOffer({ status, service_type: "wash_and_fold" }, false)).toBe(false);
    }
  });

  it("not eligible: an active or paused schedule already exists for this customer", () => {
    expect(isEligibleForRecurringOffer({ status: "completed", service_type: "wash_and_fold" }, true)).toBe(
      false
    );
    expect(isEligibleForRecurringOffer({ status: "completed", service_type: "both" }, true)).toBe(false);
  });
});
