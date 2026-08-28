import { describe, expect, it } from "vitest";
import {
  addDays,
  formatClockLabel,
  getBrooklynNowMinutes,
  getBrooklynToday,
  getSameDayEligibleWindows,
  getWindowsForDate,
  isSameDayEligible,
  rangeLabel,
} from "./booking-hours";

const FIXED_WINDOW_VALUES = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

describe("addDays — calendar arithmetic", () => {
  it("advances by whole calendar days, including across a month boundary", () => {
    expect(addDays("2026-08-30", 1)).toBe("2026-08-31");
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01"); // 2026 is not a leap year
  });

  it("is DST-transition-safe — pure calendar math, not clock math", () => {
    // US DST transitions fall in March/November; this must still just add one calendar day.
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });
});

describe("getWindowsForDate — fixed daily window generation", () => {
  const FAR_FUTURE = "2026-12-01"; // never affected by "already started" filtering

  it("generates exactly the ten fixed windows, 9:00 AM through the 6:00 PM-7:00 PM close", () => {
    const windows = getWindowsForDate(FAR_FUTURE);
    expect(windows.map((w) => w.value)).toEqual(FIXED_WINDOW_VALUES);
  });

  it("every generated label is the complete one-hour range, not just the start", () => {
    for (const slot of getWindowsForDate(FAR_FUTURE)) {
      const [startText, endText] = slot.label.split("–");
      expect(startText).toBeTruthy();
      expect(endText).toBeTruthy();
      // The label's start must match formatClockLabel(value) exactly, and the
      // end must be exactly one hour later — not a truncated or point label.
      const [hours, minutes] = slot.value.split(":").map(Number);
      const startMinutes = hours * 60 + minutes;
      expect(startText).toBe(formatClockLabel(startMinutes));
      expect(endText).toBe(formatClockLabel(startMinutes + 60));
    }
  });

  it("the 11:00 AM and 12:00 PM windows correctly cross the noon boundary", () => {
    const windows = getWindowsForDate(FAR_FUTURE);
    expect(windows.find((w) => w.value === "11:00")?.label).toBe("11:00 AM–12:00 PM");
    expect(windows.find((w) => w.value === "12:00")?.label).toBe("12:00 PM–1:00 PM");
  });

  it("the schedule is identical every day of the week — no weekday/weekend distinction", () => {
    // Pinned far from real "now" — without this, once real wall-clock time
    // ever catches up to this hardcoded range, `isToday` would flip true and
    // the result would start depending on what time of day the test happens
    // to run (this bit a prior version of this exact test).
    const now = new Date("2026-12-01T12:00:00Z");
    const start = "2026-08-17"; // spans a full week, including both weekend days
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const windows = getWindowsForDate(date, { now });
      expect(windows.map((w) => w.value)).toEqual(FIXED_WINDOW_VALUES);
    }
  });

  it("excludePast: false includes already-started windows for today (admin backfill)", () => {
    const now = new Date("2026-08-24T14:15:00Z"); // 10:15 AM EDT
    const today = getBrooklynToday(now);
    const windows = getWindowsForDate(today, { now, excludePast: false });
    // Nothing filtered by clock time — the full fixed set, same as any other date.
    expect(windows.map((w) => w.value)).toEqual(FIXED_WINDOW_VALUES);
  });

  it("excludePast defaults to true, matching the existing public-form behavior", () => {
    const now = new Date("2026-08-24T14:15:00Z"); // 10:15 AM EDT
    const today = getBrooklynToday(now);
    const withDefault = getWindowsForDate(today, { now });
    const withExplicitTrue = getWindowsForDate(today, { now, excludePast: true });
    expect(withDefault).toEqual(withExplicitTrue);
    // 9:00 AM and 10:00 AM have both already started by 10:15 AM — first available is 11:00.
    expect(withDefault[0].value).toBe("11:00");
  });

  it("windows never start before 9:00 or after 18:00, always exactly on the hour", () => {
    for (const w of getWindowsForDate(FAR_FUTURE)) {
      expect(w.value >= "09:00").toBe(true);
      expect(w.value <= "18:00").toBe(true);
      const minute = Number(w.value.split(":")[1]);
      expect(minute).toBe(0);
    }
  });

  it("excludes already-started windows when the date is Brooklyn-today", () => {
    const now = new Date("2026-08-24T14:15:00Z"); // 10:15 AM EDT
    const today = getBrooklynToday(now);
    const windows = getWindowsForDate(today, { now });
    expect(windows.map((w) => w.value)).toEqual([
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
    ]);
  });

  it("does not filter by current time for a future date", () => {
    const now = new Date("2026-08-24T23:00:00Z"); // 7:00 PM EDT
    const future = addDays(getBrooklynToday(now), 3);
    const windows = getWindowsForDate(future, { now });
    expect(windows[0].value).toBe("09:00");
  });
});

describe("getSameDayEligibleWindows / isSameDayEligible — the noon rule", () => {
  it("the eligible set is exactly 9:00, 10:00, and 11:00 AM — never 12:00 PM", () => {
    const windows = getSameDayEligibleWindows("2026-12-01");
    expect(windows.map((w) => w.value)).toEqual(["09:00", "10:00", "11:00"]);
    const last = windows[windows.length - 1];
    expect(last.label).toBe("11:00 AM–12:00 PM");
  });

  it("is eligible for a future date regardless of current time", () => {
    const now = new Date("2026-08-24T23:00:00Z"); // 7:00 PM EDT
    const future = addDays(getBrooklynToday(now), 5);
    expect(isSameDayEligible(future, { now })).toBe(true);
  });

  it("is eligible for today right up until the 11:00 AM window itself has started", () => {
    const now = new Date("2026-08-24T14:45:00Z"); // 10:45 AM EDT
    const today = getBrooklynToday(now);
    expect(isSameDayEligible(today, { now })).toBe(true);
    expect(getSameDayEligibleWindows(today, { now }).map((w) => w.value)).toContain("11:00");
  });

  it("becomes ineligible for today the moment the 11:00 AM window has started", () => {
    const now = new Date("2026-08-24T15:01:00Z"); // 11:01 AM EDT
    const today = getBrooklynToday(now);
    expect(getSameDayEligibleWindows(today, { now })).toHaveLength(0);
    expect(isSameDayEligible(today, { now })).toBe(false);
  });

  it("stays ineligible later in the day", () => {
    const now = new Date("2026-08-24T16:00:00Z"); // 12:00 PM EDT
    const today = getBrooklynToday(now);
    expect(isSameDayEligible(today, { now })).toBe(false);
  });

  it("a past date is never eligible, regardless of window math", () => {
    const now = new Date("2026-08-24T14:00:00Z");
    const yesterday = addDays(getBrooklynToday(now), -1);
    expect(isSameDayEligible(yesterday, { now })).toBe(false);
  });
});

describe("formatClockLabel", () => {
  it("formats midnight, noon, and standard hours correctly", () => {
    expect(formatClockLabel(0)).toBe("12:00 AM");
    expect(formatClockLabel(12 * 60)).toBe("12:00 PM");
    expect(formatClockLabel(9 * 60 + 30)).toBe("9:30 AM");
    expect(formatClockLabel(18 * 60)).toBe("6:00 PM");
  });
});

describe("rangeLabel", () => {
  it("joins the start and start+1hr with an en dash", () => {
    expect(rangeLabel(8 * 60)).toBe("8:00 AM–9:00 AM");
    expect(rangeLabel(18 * 60)).toBe("6:00 PM–7:00 PM");
  });

  it("crosses AM/PM correctly for any minute value — a pure formatter, independent of which values are real windows", () => {
    expect(rangeLabel(11 * 60 + 30)).toBe("11:30 AM–12:30 PM");
    expect(rangeLabel(23 * 60 + 30)).toBe("11:30 PM–12:30 AM");
  });
});

describe("getBrooklynToday / getBrooklynNowMinutes", () => {
  it("reflects the injected clock, not real time", () => {
    const now = new Date("2026-08-24T14:30:00Z"); // 10:30 AM EDT
    expect(getBrooklynToday(now)).toBe("2026-08-24");
    expect(getBrooklynNowMinutes(now)).toBe(10 * 60 + 30);
  });

  it("rolls to the next Brooklyn calendar day only once Brooklyn itself crosses midnight", () => {
    // 8:30 PM Pacific on Aug 24 = 11:30 PM Eastern on Aug 24 = 03:30 UTC on Aug 25.
    const now = new Date("2026-08-25T03:30:00Z");
    expect(getBrooklynToday(now)).toBe("2026-08-24");
  });
});
