import { describe, expect, it } from "vitest";
import { buildEventIcs } from "./ical";

function baseContent(overrides: Partial<Parameters<typeof buildEventIcs>[0]> = {}) {
  return {
    uid: "mars-booking-11111111-1111-1111-1111-111111111111-pickup@marslaundromat.com",
    summary: "PICKUP — Jane Smith",
    start: new Date("2026-06-15T14:00:00Z"),
    end: new Date("2026-06-15T15:00:00Z"),
    location: "123 7th Ave, Brooklyn, NY 11215",
    description: "Phone: (718) 555-0134",
    ...overrides,
  };
}

describe("buildEventIcs — alarm requirements (test #9, #10)", () => {
  it("includes exactly one VALARM block", () => {
    const ics = buildEventIcs(baseContent());
    const alarmBlocks = ics.match(/BEGIN:VALARM/g) ?? [];
    expect(alarmBlocks).toHaveLength(1);
  });

  it("the alarm is ACTION:DISPLAY with TRIGGER:-PT1H", () => {
    const ics = buildEventIcs(baseContent());
    expect(ics).toContain("ACTION:DISPLAY");
    expect(ics).toContain("TRIGGER:-PT1H");
  });

  it("never contains an email action or a 30-minute trigger", () => {
    const ics = buildEventIcs(baseContent());
    expect(ics).not.toContain("ACTION:EMAIL");
    expect(ics).not.toContain("PT30M");
  });

  it("omits the alarm when an event is retained only as completed history", () => {
    const ics = buildEventIcs(baseContent({ includeReminder: false }));
    expect(ics).not.toContain("BEGIN:VALARM");
    expect(ics).not.toContain("TRIGGER:");
  });
});

describe("buildEventIcs — required fields", () => {
  it("includes the deterministic UID unmodified", () => {
    // A full booking-UUID-length UID sits right at RFC 5545's 75-octet
    // fold boundary and may legitimately be split across a folded
    // continuation line (a CRLF + single space) — unfold before asserting
    // the value itself, which is what actually matters, survived intact.
    const ics = buildEventIcs(baseContent());
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(
      "UID:mars-booking-11111111-1111-1111-1111-111111111111-pickup@marslaundromat.com"
    );
  });

  it("includes the summary and location", () => {
    const ics = buildEventIcs(baseContent());
    expect(ics).toContain("SUMMARY:PICKUP — Jane Smith");
    expect(ics).toContain("LOCATION:123 7th Ave\\, Brooklyn\\, NY 11215");
  });

  it("uses America/New_York for DTSTART/DTEND", () => {
    const ics = buildEventIcs(baseContent());
    expect(ics).toMatch(/DTSTART;TZID=America\/New_York:\d{8}T\d{6}/);
    expect(ics).toMatch(/DTEND;TZID=America\/New_York:\d{8}T\d{6}/);
  });
});

describe("buildEventIcs — escaping (RFC 5545 correctness, not shape alone)", () => {
  it("escapes commas and semicolons in free text", () => {
    const ics = buildEventIcs(
      baseContent({ location: "123 Main St, Apt 4B; Brooklyn, NY 11215" })
    );
    expect(ics).toContain("LOCATION:123 Main St\\, Apt 4B\\; Brooklyn\\, NY 11215");
  });

  it("escapes embedded newlines in the description as literal \\n", () => {
    const ics = buildEventIcs(baseContent({ description: "Phone: 555-0134\nGate code: 1234" }));
    // Line-folded output may insert a real CRLF + space; strip that before
    // asserting the escaped newline separator survived intact.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("Phone: 555-0134\\nGate code: 1234");
  });

  it("folds a long DESCRIPTION line per RFC 5545 (CRLF + single-space continuation)", () => {
    const longDescription = "Instructions: " + "x".repeat(200);
    const ics = buildEventIcs(baseContent({ description: longDescription }));
    const descriptionLines = ics.split("\r\n").filter((line, i, all) => {
      return line.startsWith("DESCRIPTION:") || (i > 0 && all[i - 1]?.includes("DESCRIPTION"));
    });
    // A 200+ char single-field value must have produced more than one raw
    // line once folded at the 75-octet limit.
    const descriptionBlockStart = ics.indexOf("DESCRIPTION:");
    const nextFieldStart = ics.indexOf("\r\nBEGIN:VALARM");
    const rawBlock = ics.slice(descriptionBlockStart, nextFieldStart);
    expect(rawBlock.split("\r\n").length).toBeGreaterThan(1);
    expect(descriptionLines.length).toBeGreaterThan(0);
  });
});

describe("buildEventIcs — DST correctness (real transition dates, not an arbitrary one)", () => {
  it("resolves the correct EST offset just after the 2026 fall-back transition (Nov 1, 2026)", () => {
    // 14:00 UTC on Nov 3, 2026 (Tuesday, after the Nov 1 transition) is
    // 09:00 EST (UTC-5).
    const ics = buildEventIcs(
      baseContent({ start: new Date("2026-11-03T14:00:00Z"), end: new Date("2026-11-03T15:00:00Z") })
    );
    expect(ics).toContain("DTSTART;TZID=America/New_York:20261103T090000");
  });

  it("resolves the correct EDT offset on the 2026 spring-forward transition day itself (March 8, 2026)", () => {
    // 14:00 UTC is well after the 2am local transition, so EDT (UTC-4)
    // already applies: 10:00 EDT.
    const ics = buildEventIcs(
      baseContent({ start: new Date("2026-03-08T14:00:00Z"), end: new Date("2026-03-08T15:00:00Z") })
    );
    expect(ics).toContain("DTSTART;TZID=America/New_York:20260308T100000");
  });
});
