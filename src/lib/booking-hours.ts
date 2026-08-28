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
 * All calendar-date arithmetic (addDays) is done by parsing the "YYYY-MM-DD"
 * string as UTC midnight, not local time. That's deliberate: it's calendar
 * math on a plain date, not a real moment in time, and anchoring to UTC
 * avoids DST-transition date-shift bugs that local-time arithmetic is prone
 * to.
 *
 * Every function that depends on "now" accepts an injected `Date` (defaulting
 * to real time) so tests can pin a specific moment instead of being flaky
 * depending on when they happen to run.
 */

export const STORE_TIMEZONE = "America/New_York";
export const WINDOW_DURATION_MINUTES = 60;
export const SAME_DAY_LATEST_PICKUP_WINDOW_START = "11:00";
export const SAME_DAY_DELIVERY_WINDOW_START = "18:00";

/**
 * Fixed daily pickup/delivery window start times, in minutes since midnight —
 * identical every day of the week, no weekday/weekend distinction. The store
 * itself opens earlier (8:00 AM weekdays / 8:30 AM weekends — see the
 * advertised walk-in hours in src/content/site-config.ts), but that early
 * morning is deliberately reserved for opening the store, not for
 * pickup/delivery runs, so the first bookable window starts at 9:00 AM. Each
 * window is exactly one hour and starts exactly where the previous one ends
 * (never overlapping), through the last window ending exactly at 7:00 PM
 * close.
 */
const BOOKING_WINDOW_START_MINUTES = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(
  (hour) => hour * 60
);

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

/** "YYYY-MM-DD" plus/minus whole days, DST-safe (UTC-anchored). */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatClockLabel(totalMinutes: number): string {
  // % 24 wraps a start+60 range that lands exactly on/past midnight (e.g. an
  // 11:30 PM window's end) back to the correct hour-of-day — never hit by
  // real store hours (last start is 6:00 PM), but rangeLabel()'s start+60
  // arithmetic makes this a real edge case worth handling correctly anyway.
  const hour24 = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

/**
 * A window's full one-hour range, e.g. "8:00 AM–9:00 AM" — a stored time
 * means "window start," not "the appointment," so the label always shows
 * the whole hour, never just the start. Exported so booking-schema.ts's
 * windowLabel() (which formats an already-stored value, not a value being
 * generated here) can share this exact formatting instead of duplicating it.
 */
export function rangeLabel(startMinutes: number): string {
  return `${formatClockLabel(startMinutes)}–${formatClockLabel(startMinutes + WINDOW_DURATION_MINUTES)}`;
}

function minutesToValue(totalMinutes: number): string {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * The fixed daily window set for a given date — always the same ten
 * non-overlapping one-hour windows (9:00 AM through the 6:00–7:00 PM close),
 * every day of the week. When dateStr is Brooklyn-today, windows that have
 * already started are excluded — unless `excludePast: false`, which admin
 * staff backfilling data later the same day need (selecting an earlier-today
 * window that's already passed by clock time), a case the public form
 * correctly forbids by default.
 */
export function getWindowsForDate(
  dateStr: string,
  opts: { now?: Date; excludePast?: boolean } = {}
): TimeSlot[] {
  const now = opts.now ?? new Date();
  const excludePast = opts.excludePast ?? true;
  const isToday = dateStr === getBrooklynToday(now);
  const nowMinutes = isToday && excludePast ? getBrooklynNowMinutes(now) : -1;

  const slots: TimeSlot[] = [];
  for (const total of BOOKING_WINDOW_START_MINUTES) {
    if (isToday && total <= nowMinutes) continue;
    slots.push({ value: minutesToValue(total), label: rangeLabel(total) });
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

/**
 * How long a Standard/Flexible delivery must wait after pickup — 22 full
 * hours after the PICKUP WINDOW ENDS, not 22 hours after its stored start.
 * A stored time is a window's start, so the window's own hour is added
 * first (see WINDOW_DURATION_MINUTES). Same-Day Rush is an explicit,
 * separate exception and never uses this rule — see
 * SAME_DAY_DELIVERY_WINDOW_START instead.
 */
export const STANDARD_FLEXIBLE_DELIVERY_GAP_HOURS = 22;

function valueToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * The earliest a Standard/Flexible delivery window may start, as an
 * absolute (date, minutes-since-midnight) pair — the pickup window's end
 * (start + 1 hour) plus the 22-hour gap, normalized across the day
 * boundary that sum almost always crosses.
 */
export function earliestStandardFlexibleDelivery(
  pickupDate: string,
  pickupTime: string
): { date: string; minutes: number } {
  const thresholdMinutes =
    valueToMinutes(pickupTime) + WINDOW_DURATION_MINUTES + STANDARD_FLEXIBLE_DELIVERY_GAP_HOURS * 60;
  const daysPast = Math.floor(thresholdMinutes / (24 * 60));
  return {
    date: daysPast === 0 ? pickupDate : addDays(pickupDate, daysPast),
    minutes: thresholdMinutes - daysPast * 24 * 60,
  };
}

/**
 * The valid Standard/Flexible delivery windows for a given delivery date,
 * given the pickup date/time they follow — the fixed daily window set,
 * filtered down to whichever windows satisfy the 22-hour-after-pickup-end
 * gap. Once deliveryDate is strictly after the threshold date every window
 * qualifies (this is why Flexible's pickup+2 option always satisfies the
 * gap on its own — the threshold always lands on pickup+1); none qualify
 * before the threshold date. Single source of truth for the public form's
 * option filtering, its Zod validation, and anywhere else a Standard/
 * Flexible delivery window needs checking against its pickup.
 */
export function getStandardFlexibleDeliveryWindows(
  pickupDate: string,
  pickupTime: string,
  deliveryDate: string,
  opts: { now?: Date; excludePast?: boolean } = {}
): TimeSlot[] {
  const threshold = earliestStandardFlexibleDelivery(pickupDate, pickupTime);
  if (deliveryDate < threshold.date) return [];
  const windows = getWindowsForDate(deliveryDate, opts);
  if (deliveryDate > threshold.date) return windows;
  return windows.filter((w) => valueToMinutes(w.value) >= threshold.minutes);
}
