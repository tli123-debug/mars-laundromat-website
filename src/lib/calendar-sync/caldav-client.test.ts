import { describe, expect, it, vi } from "vitest";
import {
  CalDavError,
  deleteCalendarObject,
  getCalendarObject,
  putCalendarObject,
  resourceHrefForUid,
} from "./caldav-client";

const credentials = { username: "mars@example.com", appPassword: "wxyz-abcd-efgh-ijkl" };

function fakeResponse(status: number, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (key: string) => headers[key] ?? null } as Headers,
  } as Response;
}

describe("resourceHrefForUid", () => {
  it("joins the calendar collection URL and uid deterministically", () => {
    expect(resourceHrefForUid("https://caldav.icloud.com/123/calendars/abc", "mars-booking-1-pickup@marslaundromat.com")).toBe(
      "https://caldav.icloud.com/123/calendars/abc/mars-booking-1-pickup@marslaundromat.com.ics"
    );
  });

  it("handles a collection URL that already ends with a slash", () => {
    expect(resourceHrefForUid("https://caldav.icloud.com/123/calendars/abc/", "uid@marslaundromat.com")).toBe(
      "https://caldav.icloud.com/123/calendars/abc/uid@marslaundromat.com.ics"
    );
  });

  it("is stable across repeated calls with the same inputs (test #7 — retries converge, never duplicate)", () => {
    const first = resourceHrefForUid("https://caldav.icloud.com/x", "uid@marslaundromat.com");
    const second = resourceHrefForUid("https://caldav.icloud.com/x", "uid@marslaundromat.com");
    expect(first).toBe(second);
  });
});

describe("putCalendarObject", () => {
  it("reports 'created' on 201 and sends If-None-Match: * for a create-only write", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(201, { ETag: '"etag-1"' }));
    const result = await putCalendarObject(fetchImpl, credentials, "https://example.com/e.ics", "ICS", {
      createOnly: true,
    });
    expect(result).toEqual({ outcome: "created", etag: '"etag-1"' });
    const [, init] = fetchImpl.mock.calls[0];
    expect((init.headers as Record<string, string>)["If-None-Match"]).toBe("*");
    expect((init.headers as Record<string, string>)["If-Match"]).toBeUndefined();
  });

  it("reports 'updated' on 200/204 and sends If-Match when an etag is supplied", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(204, { ETag: '"etag-2"' }));
    const result = await putCalendarObject(fetchImpl, credentials, "https://example.com/e.ics", "ICS", {
      ifMatch: '"etag-1"',
    });
    expect(result).toEqual({ outcome: "updated", etag: '"etag-2"' });
    const [, init] = fetchImpl.mock.calls[0];
    expect((init.headers as Record<string, string>)["If-Match"]).toBe('"etag-1"');
  });

  it("reports precondition_failed on 412 without throwing (test #16)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(412));
    const result = await putCalendarObject(fetchImpl, credentials, "https://example.com/e.ics", "ICS", {
      ifMatch: '"stale-etag"',
    });
    expect(result).toEqual({ outcome: "precondition_failed" });
  });

  it("reports precondition_failed on 409 the same as 412", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(409));
    const result = await putCalendarObject(fetchImpl, credentials, "https://example.com/e.ics", "ICS", {});
    expect(result).toEqual({ outcome: "precondition_failed" });
  });

  it("throws CalDavError on an unexpected status, with a message containing no credentials (test #22)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(500));
    await expect(putCalendarObject(fetchImpl, credentials, "https://example.com/e.ics", "ICS", {})).rejects.toThrow(
      CalDavError
    );
    try {
      await putCalendarObject(fetchImpl, credentials, "https://example.com/e.ics", "ICS", {});
    } catch (error) {
      expect(String(error)).not.toContain(credentials.appPassword);
      expect(String(error)).not.toContain("Authorization");
    }
  });
});

describe("deleteCalendarObject", () => {
  it("treats 404 as already_absent, not an error (test #15)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(404));
    const result = await deleteCalendarObject(fetchImpl, credentials, "https://example.com/e.ics");
    expect(result).toBe("already_absent");
  });

  it("reports precondition_failed on 412", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(412));
    const result = await deleteCalendarObject(fetchImpl, credentials, "https://example.com/e.ics", '"etag"');
    expect(result).toBe("precondition_failed");
  });

  it("reports deleted on a normal 204", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(204));
    const result = await deleteCalendarObject(fetchImpl, credentials, "https://example.com/e.ics");
    expect(result).toBe("deleted");
  });
});

describe("getCalendarObject", () => {
  it("reports exists: false on 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(404));
    expect(await getCalendarObject(fetchImpl, credentials, "https://example.com/e.ics")).toEqual({
      exists: false,
      etag: null,
    });
  });

  it("reports the current etag on 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(200, { ETag: '"fresh"' }));
    expect(await getCalendarObject(fetchImpl, credentials, "https://example.com/e.ics")).toEqual({
      exists: true,
      etag: '"fresh"',
    });
  });
});

describe("Authorization header never appears verbatim in a thrown error", () => {
  it("CalDavError's message contains only the operation and status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(503));
    await expect(
      getCalendarObject(fetchImpl, credentials, "https://example.com/e.ics")
    ).rejects.toThrowError(/GET https:\/\/example\.com\/e\.ics failed with status 503/);
  });
});
