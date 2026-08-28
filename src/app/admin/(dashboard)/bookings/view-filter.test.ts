import { describe, expect, it } from "vitest";
import { ACTIVE_BOOKING_STATUSES, ARCHIVED_BOOKING_STATUSES } from "@/lib/categorize-booking";
import { BOOKING_VIEW_OPTIONS, isBookingView, statusesForView } from "./view-filter";

describe("isBookingView", () => {
  it("accepts the three known views", () => {
    expect(isBookingView("active")).toBe(true);
    expect(isBookingView("archived")).toBe(true);
    expect(isBookingView("all")).toBe(true);
  });

  it("rejects anything else, including a real status or an empty/undefined value", () => {
    expect(isBookingView("completed")).toBe(false);
    expect(isBookingView("")).toBe(false);
    expect(isBookingView(undefined)).toBe(false);
  });
});

describe("statusesForView", () => {
  it("active maps to the shared active status list", () => {
    expect(statusesForView("active")).toBe(ACTIVE_BOOKING_STATUSES);
  });

  it("archived maps to the shared archived status list", () => {
    expect(statusesForView("archived")).toBe(ARCHIVED_BOOKING_STATUSES);
  });

  it("all maps to null — no status filter at all, so every booking matches", () => {
    expect(statusesForView("all")).toBeNull();
  });
});

describe("BOOKING_VIEW_OPTIONS", () => {
  it("has a bilingual label for every option", () => {
    for (const option of BOOKING_VIEW_OPTIONS) {
      expect(option.label).toMatch(/[A-Za-z]/);
      expect(option.label).toMatch(/[一-鿿]/);
    }
  });

  it("every option value is recognized by isBookingView", () => {
    for (const option of BOOKING_VIEW_OPTIONS) {
      expect(isBookingView(option.value)).toBe(true);
    }
  });
});
