/**
 * Pure Brooklyn-local date/time logic for pickup & delivery windows. No UI,
 * no database. Safe to call from the browser or the server — uses native
 * Intl.DateTimeFormat (IANA tz data is bundled with the JS engine), no
 * dependency needed.
 *
 * "Today" and "now" must always be computed in America/New_York, never the
 * customer's browser timezone or the server process's local timezone — a
 * customer booking from California at 9 PM Pacific is already past midnight
 * in Brooklyn, so using their local date would silently pick the wrong day.
 *
 * All calendar-date arithmetic (weekdayOf, addDays) is done by parsing the
 * "YYYY-MM-DD" string as UTC midnight, not local time. That's deliberate:
 * it's calendar math on a plain date, not a real moment in time, and
 * anchoring to UTC avoids DST-transition date-shift bugs that local-time
 * arithmetic is prone to.
 *
 * Every function that depends on "now" accepts an injected `Date` (defaulting
 * to real time) so tests can pin a specific moment instead of being flaky
 * depending on when they happen to run.
 */

export const STORE_TIMEZONE = "America/New_York";
export const WINDOW_DURATION_MINUTES = 60;
export const SLOT_INTERVAL_MINUTES = 30;
export const SAME_DAY_LATEST_PICKUP_WINDOW_START = "11:00";
export const SAME_DAY_DELIVERY_WINDOW_START = "18:00";

export interface TimeSlot {
  value: string;
  label: string;
}

function getBrooklynParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // Some ICU versions render midnight as "24" under hour12:false — guard against it.
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

/** Today's date in America/New_York as "YYYY-MM-DD". */
export function getBrooklynToday(now: Date = new Date()): string {
  const { year, month, day } = getBrooklynParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Current America/New_York wall-clock time as minutes since midnight. */
export function getBrooklynNowMinutes(now: Date = new Date()): number {
  const { hour, minute } = getBrooklynParts(now);
  return hour * 60 + minute;
}

/** 0=Sun..6=Sat for a plain "YYYY-MM-DD" date. Timezone-independent. */
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

export function isWeekend(dateStr: string): boolean {
  const day = weekdayOf(dateStr);
  return day === 0 || day === 6;
}

/** "YYYY-MM-DD" plus/minus whole days, DST-safe (UTC-anchored). */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Open 8:00 AM weekdays / 8:30 AM weekends; close 7:00 PM every day. */
export function storeHoursFor(dateStr: string): { openMinutes: number; closeMinutes: number } {
  return {
    openMinutes: isWeekend(dateStr) ? 8 * 60 + 30 : 8 * 60,
    closeMinutes: 19 * 60,
  };
}

export function formatClockLabel(totalMinutes: number): string {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function minutesToValue(totalMinutes: number): string {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Every 1-hour window's start time for a given date, every 30 minutes, from
 * store open through the last start that still ends by close (close - 1hr).
 * When dateStr is Brooklyn-today, windows that have already started are
 * excluded.
 */
export function getWindowsForDate(dateStr: string, opts: { now?: Date } = {}): TimeSlot[] {
  const { openMinutes, closeMinutes } = storeHoursFor(dateStr);
  const lastStart = closeMinutes - WINDOW_DURATION_MINUTES;
  const now = opts.now ?? new Date();
  const isToday = dateStr === getBrooklynToday(now);
  const nowMinutes = isToday ? getBrooklynNowMinutes(now) : -1;

  const slots: TimeSlot[] = [];
  for (let total = openMinutes; total <= lastStart; total += SLOT_INTERVAL_MINUTES) {
    if (isToday && total <= nowMinutes) continue;
    slots.push({ value: minutesToValue(total), label: formatClockLabel(total) });
  }
  return slots;
}

/**
 * Subset of getWindowsForDate() ending by noon (i.e. starting at or before
 * 11:00 AM) — the Same-Day Rush pickup window rule.
 */
export function getSameDayEligibleWindows(
  dateStr: string,
  opts: { now?: Date } = {}
): TimeSlot[] {
  return getWindowsForDate(dateStr, opts).filter(
    (slot) => slot.value <= SAME_DAY_LATEST_PICKUP_WINDOW_START
  );
}

/** Whether Same-Day Rush can be offered at all for this pickup date right now. */
export function isSameDayEligible(dateStr: string, opts: { now?: Date } = {}): boolean {
  const now = opts.now ?? new Date();
  if (dateStr < getBrooklynToday(now)) return false;
  return getSameDayEligibleWindows(dateStr, opts).length > 0;
}
