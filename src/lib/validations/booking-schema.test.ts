import { describe, expect, it } from "vitest";
import { bookingSchema, fieldsToResetOnServiceChange, windowLabel } from "./booking-schema";
import { addDays, getBrooklynToday, getWindowsForDate } from "@/lib/booking-hours";
import { getDryCleaningDeliveryDate } from "@/lib/dry-cleaning-schedule";

// Anchored 10 days out so "already started today" filtering never applies —
// these tests exercise the rule logic (delivery-date-matches-speed,
// window-set membership, the noon cutoff, consent), not time-of-day
// behavior, which booking-hours.test.ts already covers deterministically.
const FUTURE_PICKUP_DATE = addDays(getBrooklynToday(), 10);

function pickupWindows(): string[] {
  return getWindowsForDate(FUTURE_PICKUP_DATE).map((w) => w.value);
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Jane Rivera",
    phone: "7185550134",
    address: "123 7th Ave, Brooklyn, NY 11215",
    washAndFold: true,
    dryCleaning: false,
    dryCleaningItemDescription: "",
    dryCleaningBagAcknowledgement: false,
    preferredPickupDate: FUTURE_PICKUP_DATE,
    preferredPickupTime: pickupWindows()[0],
    preferredDeliveryDate: addDays(FUTURE_PICKUP_DATE, 1),
    preferredDeliveryTime: getWindowsForDate(addDays(FUTURE_PICKUP_DATE, 1))[0].value,
    serviceSpeed: "standard",
    smsConsent: true,
    specialInstructions: "",
    companyWebsite: "",
    ...overrides,
  };
}

// Dry Cleaning-only and Both share the exact same scheduling rule, so both
// helpers build on baseInput and only differ in washAndFold.
function dryCleaningInput(overrides: Record<string, unknown> = {}) {
  const deliveryDate = getDryCleaningDeliveryDate(FUTURE_PICKUP_DATE);
  return baseInput({
    washAndFold: false,
    dryCleaning: true,
    dryCleaningBagAcknowledgement: true,
    serviceSpeed: undefined,
    preferredDeliveryDate: deliveryDate,
    preferredDeliveryTime: getWindowsForDate(deliveryDate)[0].value,
    ...overrides,
  });
}

function bothInput(overrides: Record<string, unknown> = {}) {
  return dryCleaningInput({ washAndFold: true, ...overrides });
}

describe("bookingSchema — delivery is required", () => {
  it("accepts a fully valid standard request", () => {
    expect(bookingSchema.safeParse(baseInput()).success).toBe(true);
  });

  it("rejects a missing delivery date", () => {
    expect(bookingSchema.safeParse(baseInput({ preferredDeliveryDate: "" })).success).toBe(false);
  });

  it("rejects a missing delivery time", () => {
    expect(bookingSchema.safeParse(baseInput({ preferredDeliveryTime: "" })).success).toBe(false);
  });
});

describe("bookingSchema — pickup date/time", () => {
  it("rejects a pickup date in the past", () => {
    const yesterday = addDays(getBrooklynToday(), -1);
    const result = bookingSchema.safeParse(baseInput({ preferredPickupDate: yesterday }));
    expect(result.success).toBe(false);
  });

  it("rejects a pickup time that isn't one of the generated windows for that date", () => {
    const result = bookingSchema.safeParse(baseInput({ preferredPickupTime: "03:17" }));
    expect(result.success).toBe(false);
  });

  it("rejects a nonempty malformed pickup time without throwing", () => {
    // Regression test: a malformed preferredPickupTime used to reach
    // getStandardFlexibleDeliveryWindows() unguarded, where valueToMinutes()
    // produced NaN and addDays(pickupDate, NaN) threw "RangeError: Invalid
    // time value" instead of failing validation normally.
    for (const malformed of ["not-a-time", "25:00", "10:75"]) {
      expect(() => bookingSchema.safeParse(baseInput({ preferredPickupTime: malformed }))).not.toThrow();
      const result = bookingSchema.safeParse(baseInput({ preferredPickupTime: malformed }));
      expect(result.success).toBe(false);
    }
  });
});

describe("bookingSchema — standard speed", () => {
  it("rejects delivery two days after pickup (must be exactly one)", () => {
    const twoDaysLater = addDays(FUTURE_PICKUP_DATE, 2);
    const result = bookingSchema.safeParse(
      baseInput({
        preferredDeliveryDate: twoDaysLater,
        preferredDeliveryTime: getWindowsForDate(twoDaysLater)[0].value,
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects same-day delivery", () => {
    const result = bookingSchema.safeParse(
      baseInput({
        preferredDeliveryDate: FUTURE_PICKUP_DATE,
        preferredDeliveryTime: pickupWindows()[1],
      })
    );
    expect(result.success).toBe(false);
  });
});

describe("bookingSchema — flexible speed", () => {
  it("accepts delivery one day after pickup", () => {
    const oneDayLater = addDays(FUTURE_PICKUP_DATE, 1);
    const result = bookingSchema.safeParse(
      baseInput({
        serviceSpeed: "flexible",
        preferredDeliveryDate: oneDayLater,
        preferredDeliveryTime: getWindowsForDate(oneDayLater)[0].value,
      })
    );
    expect(result.success).toBe(true);
  });

  it("accepts delivery two days after pickup", () => {
    const twoDaysLater = addDays(FUTURE_PICKUP_DATE, 2);
    const result = bookingSchema.safeParse(
      baseInput({
        serviceSpeed: "flexible",
        preferredDeliveryDate: twoDaysLater,
        preferredDeliveryTime: getWindowsForDate(twoDaysLater)[0].value,
      })
    );
    expect(result.success).toBe(true);
  });

  it("rejects delivery three days after pickup", () => {
    const threeDaysLater = addDays(FUTURE_PICKUP_DATE, 3);
    const result = bookingSchema.safeParse(
      baseInput({
        serviceSpeed: "flexible",
        preferredDeliveryDate: threeDaysLater,
        preferredDeliveryTime: getWindowsForDate(threeDaysLater)[0].value,
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects same-day delivery", () => {
    const result = bookingSchema.safeParse(
      baseInput({
        serviceSpeed: "flexible",
        preferredDeliveryDate: FUTURE_PICKUP_DATE,
        preferredDeliveryTime: pickupWindows()[1],
      })
    );
    expect(result.success).toBe(false);
  });
});

describe("bookingSchema — the 22-hour delivery gap (Standard/Flexible)", () => {
  it("rejects a next-day delivery window that's within range but doesn't clear the 22-hour gap", () => {
    // 6:00-7:00 PM pickup -> next-day 4:00-5:00 PM is only 21 hours after
    // the pickup window ends, one hour short of the required 22.
    const result = bookingSchema.safeParse(
      baseInput({
        preferredPickupTime: "18:00",
        preferredDeliveryDate: addDays(FUTURE_PICKUP_DATE, 1),
        preferredDeliveryTime: "16:00",
      })
    );
    expect(result.success).toBe(false);
  });

  it("accepts the earliest delivery window that does clear the gap for that same late pickup", () => {
    const result = bookingSchema.safeParse(
      baseInput({
        preferredPickupTime: "18:00",
        preferredDeliveryDate: addDays(FUTURE_PICKUP_DATE, 1),
        preferredDeliveryTime: "17:00",
      })
    );
    expect(result.success).toBe(true);
  });

  it("applies to Flexible's pickup+1 option too, not just Standard", () => {
    const result = bookingSchema.safeParse(
      baseInput({
        serviceSpeed: "flexible",
        preferredPickupTime: "18:00",
        preferredDeliveryDate: addDays(FUTURE_PICKUP_DATE, 1),
        preferredDeliveryTime: "16:00",
      })
    );
    expect(result.success).toBe(false);
  });

  it("never blocks Flexible's pickup+2 option, even for the latest possible pickup window", () => {
    const result = bookingSchema.safeParse(
      baseInput({
        serviceSpeed: "flexible",
        preferredPickupTime: "18:00",
        preferredDeliveryDate: addDays(FUTURE_PICKUP_DATE, 2),
        preferredDeliveryTime: "09:00",
      })
    );
    expect(result.success).toBe(true);
  });

  it("rejects a hand-crafted delivery time that was never a real window at all", () => {
    const result = bookingSchema.safeParse(
      baseInput({
        preferredPickupTime: "18:00",
        preferredDeliveryDate: addDays(FUTURE_PICKUP_DATE, 1),
        preferredDeliveryTime: "16:37",
      })
    );
    expect(result.success).toBe(false);
  });
});

describe("bookingSchema — same-day speed", () => {
  function sameDayInput(pickupTimeValue: string, overrides: Record<string, unknown> = {}) {
    return baseInput({
      serviceSpeed: "same_day",
      preferredPickupTime: pickupTimeValue,
      preferredDeliveryDate: FUTURE_PICKUP_DATE,
      preferredDeliveryTime: "18:00",
      ...overrides,
    });
  }

  it("accepts an 11:00 AM pickup window — the latest eligible", () => {
    expect(bookingSchema.safeParse(sameDayInput("11:00")).success).toBe(true);
  });

  it("rejects a 12:00 PM pickup window — starts after the Same-Day cutoff", () => {
    expect(bookingSchema.safeParse(sameDayInput("12:00")).success).toBe(false);
  });

  it("requires delivery date to equal pickup date", () => {
    const result = bookingSchema.safeParse(
      sameDayInput("09:00", { preferredDeliveryDate: addDays(FUTURE_PICKUP_DATE, 1) })
    );
    expect(result.success).toBe(false);
  });

  it("requires the delivery window to be exactly 6:00–7:00 PM", () => {
    const result = bookingSchema.safeParse(sameDayInput("09:00", { preferredDeliveryTime: "17:00" }));
    expect(result.success).toBe(false);
  });
});

describe("bookingSchema — at least one service is required", () => {
  it("rejects submission when neither Wash & Fold nor Dry Cleaning is selected", () => {
    const result = bookingSchema.safeParse(baseInput({ washAndFold: false, dryCleaning: false }));
    expect(result.success).toBe(false);
  });

  it("accepts Wash & Fold alone", () => {
    expect(bookingSchema.safeParse(baseInput({ washAndFold: true, dryCleaning: false })).success).toBe(
      true
    );
  });

  it("accepts Dry Cleaning alone", () => {
    expect(bookingSchema.safeParse(dryCleaningInput()).success).toBe(true);
  });

  it("accepts both selected together", () => {
    expect(bookingSchema.safeParse(bothInput()).success).toBe(true);
  });
});

describe("bookingSchema — Dry Cleaning-only scheduling", () => {
  it("accepts pickup+4 delivery — the only customer-selectable date", () => {
    const plusFour = getDryCleaningDeliveryDate(FUTURE_PICKUP_DATE);
    const result = bookingSchema.safeParse(
      dryCleaningInput({
        preferredDeliveryDate: plusFour,
        preferredDeliveryTime: getWindowsForDate(plusFour)[0].value,
      })
    );
    expect(result.success).toBe(true);
  });

  it("rejects pickup+3 delivery — no longer offered to the public form", () => {
    const plusThree = addDays(FUTURE_PICKUP_DATE, 3);
    const result = bookingSchema.safeParse(
      dryCleaningInput({
        preferredDeliveryDate: plusThree,
        preferredDeliveryTime: getWindowsForDate(plusThree)[0].value,
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects delivery one day after pickup (too early)", () => {
    const oneDayLater = addDays(FUTURE_PICKUP_DATE, 1);
    const result = bookingSchema.safeParse(
      dryCleaningInput({
        preferredDeliveryDate: oneDayLater,
        preferredDeliveryTime: getWindowsForDate(oneDayLater)[0].value,
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects delivery five days after pickup (too late)", () => {
    const fiveDaysLater = addDays(FUTURE_PICKUP_DATE, 5);
    const result = bookingSchema.safeParse(
      dryCleaningInput({
        preferredDeliveryDate: fiveDaysLater,
        preferredDeliveryTime: getWindowsForDate(fiveDaysLater)[0].value,
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects same-day delivery", () => {
    const result = bookingSchema.safeParse(
      dryCleaningInput({
        preferredDeliveryDate: FUTURE_PICKUP_DATE,
        preferredDeliveryTime: pickupWindows()[1],
      })
    );
    expect(result.success).toBe(false);
  });

  it("does not require a serviceSpeed", () => {
    expect(bookingSchema.safeParse(dryCleaningInput({ serviceSpeed: undefined })).success).toBe(true);
  });
});

describe("bookingSchema — Both scheduling follows the same day-4 rule", () => {
  it("accepts pickup+4 delivery — the only customer-selectable date", () => {
    const plusFour = getDryCleaningDeliveryDate(FUTURE_PICKUP_DATE);
    const result = bookingSchema.safeParse(
      bothInput({
        preferredDeliveryDate: plusFour,
        preferredDeliveryTime: getWindowsForDate(plusFour)[0].value,
      })
    );
    expect(result.success).toBe(true);
  });

  it("rejects pickup+3 delivery — no longer offered to the public form", () => {
    const plusThree = addDays(FUTURE_PICKUP_DATE, 3);
    const result = bookingSchema.safeParse(
      bothInput({
        preferredDeliveryDate: plusThree,
        preferredDeliveryTime: getWindowsForDate(plusThree)[0].value,
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects delivery two days after pickup (too early)", () => {
    const twoDaysLater = addDays(FUTURE_PICKUP_DATE, 2);
    const result = bookingSchema.safeParse(
      bothInput({
        preferredDeliveryDate: twoDaysLater,
        preferredDeliveryTime: getWindowsForDate(twoDaysLater)[0].value,
      })
    );
    expect(result.success).toBe(false);
  });
});

describe("bookingSchema — Same-Day Rush is Wash & Fold-only", () => {
  it("rejects a same-day delivery pattern smuggled into a Dry Cleaning-only booking", () => {
    const result = bookingSchema.safeParse(
      dryCleaningInput({
        serviceSpeed: "same_day",
        preferredDeliveryDate: FUTURE_PICKUP_DATE,
        preferredDeliveryTime: "18:00",
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a same-day delivery pattern smuggled into a Both booking", () => {
    const result = bookingSchema.safeParse(
      bothInput({
        serviceSpeed: "same_day",
        preferredDeliveryDate: FUTURE_PICKUP_DATE,
        preferredDeliveryTime: "18:00",
      })
    );
    expect(result.success).toBe(false);
  });
});

describe("bookingSchema — bag separation acknowledgement", () => {
  it("Dry Cleaning-only requires the acknowledgement", () => {
    const result = bookingSchema.safeParse(dryCleaningInput({ dryCleaningBagAcknowledgement: false }));
    expect(result.success).toBe(false);
  });

  it("Both requires the acknowledgement", () => {
    const result = bookingSchema.safeParse(bothInput({ dryCleaningBagAcknowledgement: false }));
    expect(result.success).toBe(false);
  });

  it("Wash & Fold-only does not require the acknowledgement", () => {
    const result = bookingSchema.safeParse(
      baseInput({ washAndFold: true, dryCleaning: false, dryCleaningBagAcknowledgement: false })
    );
    expect(result.success).toBe(true);
  });
});

describe("bookingSchema — SMS consent", () => {
  it("rejects submission when consent isn't checked", () => {
    expect(bookingSchema.safeParse(baseInput({ smsConsent: false })).success).toBe(false);
  });

  it("rejects submission when consent is omitted entirely", () => {
    const input = baseInput();
    delete (input as Record<string, unknown>).smsConsent;
    expect(bookingSchema.safeParse(input).success).toBe(false);
  });

  it("accepts submission when consent is checked", () => {
    expect(bookingSchema.safeParse(baseInput({ smsConsent: true })).success).toBe(true);
  });
});

describe("windowLabel", () => {
  it("formats a window start as a one-hour range", () => {
    expect(windowLabel("14:30")).toBe("2:30 PM–3:30 PM");
  });

  it("handles Postgres's HH:MM:SS format", () => {
    expect(windowLabel("09:00:00")).toBe("9:00 AM–10:00 AM");
  });

  it("returns null for a missing value", () => {
    expect(windowLabel(null)).toBeNull();
    expect(windowLabel(undefined)).toBeNull();
  });
});

describe("fieldsToResetOnServiceChange", () => {
  it("clears serviceSpeed and delivery date/time when dry cleaning becomes selected", () => {
    expect(fieldsToResetOnServiceChange(true)).toEqual({
      serviceSpeed: undefined,
      preferredDeliveryDate: "",
      preferredDeliveryTime: "",
      dryCleaningItemDescription: "",
      dryCleaningBagAcknowledgement: false,
    });
  });

  it("resets serviceSpeed to standard and clears dry-cleaning fields when Wash & Fold-only is selected", () => {
    expect(fieldsToResetOnServiceChange(false)).toEqual({
      serviceSpeed: "standard",
      preferredDeliveryDate: "",
      preferredDeliveryTime: "",
      dryCleaningItemDescription: "",
      dryCleaningBagAcknowledgement: false,
    });
  });
});
