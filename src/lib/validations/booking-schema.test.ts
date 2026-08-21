import { describe, expect, it } from "vitest";
import { bookingSchema, windowLabel } from "./booking-schema";
import { addDays, getBrooklynToday, getWindowsForDate } from "@/lib/booking-hours";

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

  it("rejects an 11:30 AM pickup window — ends after noon", () => {
    expect(bookingSchema.safeParse(sameDayInput("11:30")).success).toBe(false);
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
