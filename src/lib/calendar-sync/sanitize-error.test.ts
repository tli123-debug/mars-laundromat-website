import { describe, expect, it } from "vitest";
import { sanitizeCalendarSyncError } from "./sanitize-error";

describe("sanitizeCalendarSyncError (test #22)", () => {
  it("redacts an Authorization header value", () => {
    const result = sanitizeCalendarSyncError(
      new Error('PUT failed: Authorization: Basic bWFyc0BleGFtcGxlLmNvbTpzZWNyZXQ=')
    );
    expect(result).not.toContain("bWFyc0BleGFtcGxlLmNvbTpzZWNyZXQ=");
    expect(result).toContain("[redacted]");
  });

  it("redacts a bearer token", () => {
    const result = sanitizeCalendarSyncError("cron call failed with Bearer abc123.def456.ghi789");
    expect(result).not.toContain("abc123.def456.ghi789");
  });

  it("redacts an Apple app-specific-password-shaped string wherever it appears", () => {
    const result = sanitizeCalendarSyncError("auth failed for password wxyz-abcd-efgh-ijkl during PUT");
    expect(result).not.toContain("wxyz-abcd-efgh-ijkl");
    expect(result).toContain("[redacted-app-password]");
  });

  it("truncates very long input so a single bad error can't grow the row unboundedly", () => {
    const result = sanitizeCalendarSyncError("x".repeat(10000));
    expect(result.length).toBeLessThan(600);
  });

  it("passes through an already-safe, short message unchanged", () => {
    expect(sanitizeCalendarSyncError(new Error("PUT to calendar object failed with status 500"))).toBe(
      "PUT to calendar object failed with status 500"
    );
  });

  it("handles a plain thrown string, not just an Error instance", () => {
    expect(sanitizeCalendarSyncError("network timeout")).toBe("network timeout");
  });
});
