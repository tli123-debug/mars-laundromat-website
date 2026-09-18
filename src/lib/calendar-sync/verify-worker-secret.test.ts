import { describe, expect, it } from "vitest";
import { isAuthorizedCalendarSyncRequest } from "./verify-worker-secret";

const SECRET = "super-long-random-shared-secret-value-123456";

describe("isAuthorizedCalendarSyncRequest (test #21)", () => {
  it("accepts the correct bearer secret", () => {
    expect(isAuthorizedCalendarSyncRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("rejects a missing Authorization header", () => {
    expect(isAuthorizedCalendarSyncRequest(null, SECRET)).toBe(false);
  });

  it("rejects when the expected secret is not configured at all", () => {
    expect(isAuthorizedCalendarSyncRequest(`Bearer ${SECRET}`, undefined)).toBe(false);
  });

  it("rejects a wrong secret of the same length", () => {
    const wrong = SECRET.slice(0, -1) + "x";
    expect(isAuthorizedCalendarSyncRequest(`Bearer ${wrong}`, SECRET)).toBe(false);
  });

  it("rejects a wrong secret of a different length", () => {
    expect(isAuthorizedCalendarSyncRequest("Bearer short", SECRET)).toBe(false);
  });

  it("rejects a header missing the Bearer prefix", () => {
    expect(isAuthorizedCalendarSyncRequest(SECRET, SECRET)).toBe(false);
  });

  it("rejects an empty string secret in either position", () => {
    expect(isAuthorizedCalendarSyncRequest("Bearer ", SECRET)).toBe(false);
    expect(isAuthorizedCalendarSyncRequest(`Bearer ${SECRET}`, "")).toBe(false);
  });
});
