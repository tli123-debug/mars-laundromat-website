import ical, { ICalAlarmType } from "ical-generator";

/**
 * RFC 5545 generation, via ical-generator — chosen specifically because
 * hand-rolled ICS text is where correct escaping/line-folding/timestamp
 * formatting most often goes subtly wrong, and this library's output was
 * verified directly (not assumed) before this module was written: commas/
 * semicolons/newlines escape correctly, long DESCRIPTION lines fold per
 * RFC 5545 (CRLF + single-space continuation), and a bare
 * `DTSTART;TZID=America/New_York:...` — no embedded VTIMEZONE block — was
 * confirmed to resolve to the correct local wall-clock time, including
 * across both 2026 US DST transition dates (March 8 spring-forward,
 * November 1 fall-back). Apple Calendar, like effectively every modern
 * client, resolves a well-known IANA TZID from its own zone database when
 * no VTIMEZONE is embedded — this is deliberate, not an oversight, but is
 * still called out explicitly in the launch runbook as one of the things
 * the real-device acceptance test should re-confirm, since no automated
 * test here can substitute for actually looking at a phone.
 *
 * Deliberately NOT used for the CalDAV transport itself (PUT/DELETE with
 * conditional headers) — see caldav-client.ts for why a thin, directly
 * mockable fetch wrapper was a better fit for that half than wrapping
 * tsdav's own higher-level client.
 */
export interface CalendarEventContent {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
  includeReminder?: boolean;
}

const ONE_HOUR_IN_SECONDS = 60 * 60;

/**
 * Every active system-created event gets exactly one DISPLAY alarm,
 * triggering 1 hour before start — never an email alarm, never 30
 * minutes, never more than one. This is the ONLY place an alarm is ever
 * added, specifically so that invariant can't drift between call sites.
 */
export function buildEventIcs(content: CalendarEventContent): string {
  const calendar = ical();
  calendar.createEvent({
    id: content.uid,
    start: content.start,
    end: content.end,
    summary: content.summary,
    location: content.location,
    description: content.description,
    timezone: "America/New_York",
    alarms:
      content.includeReminder === false
        ? []
        : [{ type: ICalAlarmType.display, triggerBefore: ONE_HOUR_IN_SECONDS }],
  });
  return calendar.toString();
}
