import { describe, expect, it } from "vitest";
import {
  addDays,
  formatClockLabel,
  getBrooklynNowMinutes,
  getBrooklynToday,
  getSameDayEligibleWindows,
  getWindowsForDate,
  isSameDayEligible,
  isWeekend,
  storeHoursFor,
  weekdayOf,
} from "./booking-hours";

describe("weekdayOf / addDays — calendar arithmetic", () => {
  it("weekdayOf matches native Date's UTC day-of-week", () => {
    const dates = [
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ];
    for (const date of dates) {
      expect(weekdayOf(date)).toBe(new Date(`${date}T00:00:00Z`).getUTCDay());
    }
  });

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

  it("isWeekend agrees with weekdayOf across a full week", () => {
    const start = "2026-08-17";
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const wd = weekdayOf(date);
      expect(isWeekend(date)).toBe(wd === 0 || wd === 6);
    }
  });
});

describe("storeHoursFor — weekday vs weekend open time", () => {
  it("opens 8:00 AM weekdays / 8:30 AM weekends, closes 7:00 PM every day, across a full week", () => {
    const start = "2026-08-17";
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const { openMinutes, closeMinutes } = storeHoursFor(date);
      expect(closeMinutes).toBe(19 * 60);
      expect(openMinutes).toBe(isWeekend(date) ? 8 * 60 + 30 : 8 * 60);
    }
  });
});

describe("getWindowsForDate — window generation", () => {
  const FAR_FUTURE = "2026-12-01"; // never affected by "already started" filtering

  it("the last ordinary window starts at 6:00 PM, ending exactly at close", () => {
    const windows = getWindowsForDate(FAR_FUTURE);
    const last = windows[windows.length - 1];
    expect(last.value).toBe("18:00");
    expect(last.label).toBe("6:00 PM");
  });

  it("weekday windows start at 08:00, weekend windows start at 08:30", () => {
    const start = "2026-08-17";
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const windows = getWindowsForDate(date);
      expect(windows[0].value).toBe(isWeekend(date) ? "08:30" : "08:00");
    }
  });

  it("windows step every 30 minutes and never start after 18:00", () => {
    for (const w of getWindowsForDate(FAR_FUTURE)) {
      expect(w.value <= "18:00").toBe(true);
      const minute = Number(w.value.split(":")[1]);
      expect([0, 30]).toContain(minute);
    }
  });

  it("excludes already-started windows when the date is Brooklyn-today", () => {
    const now = new Date("2026-08-24T14:15:00Z"); // 10:15 AM EDT
    const today = getBrooklynToday(now);
    const windows = getWindowsForDate(today, { now });
    expect(windows[0].value).toBe("10:30");
    for (const w of windows) {
      expect(w.value > "10:15").toBe(true);
    }
  });

  it("does not filter by current time for a future date", () => {
    const now = new Date("2026-08-24T23:00:00Z"); // 7:00 PM EDT
    const future = addDays(getBrooklynToday(now), 3);
    const windows = getWindowsForDate(future, { now });
    expect(windows[0].value).toBe(isWeekend(future) ? "08:30" : "08:00");
  });
});

describe("getSameDayEligibleWindows / isSameDayEligible — the noon rule", () => {
  it("the eligible set always ends at the 11:00 AM start (11:00 AM-12:00 PM window), never 11:30", () => {
    const windows = getSameDayEligibleWindows("2026-12-01");
    expect(windows[windows.length - 1].value).toBe("11:00");
    expect(windows.some((w) => w.value === "11:30")).toBe(false);
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
