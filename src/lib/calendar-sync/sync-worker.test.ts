import { describe, expect, it, vi } from "vitest";
import {
  buildEventDescription,
  computeNextAttemptDelaySeconds,
  processPendingCalendarSyncBatch,
  reconcileOneLeg,
} from "./sync-worker";

const credentials = { username: "mars@example.com", appPassword: "wxyz-abcd-efgh-ijkl" };
const CALENDAR = "https://caldav.icloud.com/123/calendars/mars/";

function baseRow(overrides: Partial<Parameters<typeof reconcileOneLeg>[0]> = {}) {
  return {
    desired_disposition: "active",
    desired_start: "2026-09-25T13:00:00.000Z",
    desired_end: "2026-09-25T14:00:00.000Z",
    desired_summary: "🧺 PICKUP — Jane Smith",
    desired_location: "123 7th Ave, Brooklyn, NY 11215",
    desired_phone: "(718) 555-0134",
    desired_service_type: "wash_and_fold",
    desired_instructions: "Gate code 1234",
    booking_id: "11111111-1111-1111-1111-111111111111",
    ical_uid: "mars-booking-11111111-1111-1111-1111-111111111111-pickup@marslaundromat.com",
    caldav_href: null as string | null,
    remote_etag: null as string | null,
    desired_calendar_identity: CALENDAR,
    synced_calendar_identity: CALENDAR,
    ...overrides,
  };
}

function fakeResponse(status: number, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (key: string) => headers[key] ?? null } as Headers,
  } as Response;
}

describe("buildEventDescription", () => {
  it("includes phone, mapped service label, instructions, booking id, and admin link", () => {
    const description = buildEventDescription(
      {
        desired_phone: "(718) 555-0134",
        desired_service_type: "dry_cleaning",
        desired_instructions: "Ring twice",
        booking_id: "abc-123",
      },
      "https://marslaundromat.com"
    );
    expect(description).toContain("Phone: (718) 555-0134");
    expect(description).toContain("Service: Dry Cleaning & Ironing");
    expect(description).toContain("Instructions: Ring twice");
    expect(description).toContain("Booking: abc-123");
    expect(description).toContain("https://marslaundromat.com/admin/bookings/abc-123");
  });

  it("omits an instructions line entirely when there are none — never a stray empty line", () => {
    const description = buildEventDescription(
      { desired_phone: "555", desired_service_type: "wash_and_fold", desired_instructions: null, booking_id: "x" },
      "https://marslaundromat.com"
    );
    expect(description).not.toContain("Instructions:");
  });
});

describe("computeNextAttemptDelaySeconds", () => {
  it("grows exponentially and caps at 30 minutes", () => {
    expect(computeNextAttemptDelaySeconds(1)).toBe(30);
    expect(computeNextAttemptDelaySeconds(2)).toBe(60);
    expect(computeNextAttemptDelaySeconds(3)).toBe(120);
    expect(computeNextAttemptDelaySeconds(20)).toBe(30 * 60);
  });
});

describe("reconcileOneLeg — first-time create (test #6)", () => {
  it("creates with If-None-Match and records the returned href/etag", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(201, { ETag: '"e1"' }));
    const outcome = await reconcileOneLeg(baseRow(), { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" });
    expect(outcome).toEqual({
      status: "synced",
      caldavHref: `${CALENDAR}${baseRow().ical_uid}.ics`,
      remoteEtag: '"e1"',
    });
    const [href, init] = fetchImpl.mock.calls[0];
    expect(href).toBe(`${CALENDAR}${baseRow().ical_uid}.ics`);
    expect((init.headers as Record<string, string>)["If-None-Match"]).toBe("*");
  });
});

describe("reconcileOneLeg — retry/lost-response never duplicates (test #7)", () => {
  it("a create-only retry that hits 412 (resource already exists from a prior lost-response attempt) reconciles instead of erroring", async () => {
    const fetchImpl = vi
      .fn()
      // First call: createOnly PUT -> 412 (it already exists).
      .mockResolvedValueOnce(fakeResponse(412))
      // Second call: GET to learn the real etag.
      .mockResolvedValueOnce(fakeResponse(200, { ETag: '"already-there"' }))
      // Third call: PUT with If-Match using that etag -> success.
      .mockResolvedValueOnce(fakeResponse(204, { ETag: '"reconciled"' }));

    const outcome = await reconcileOneLeg(baseRow(), { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" });

    expect(outcome).toEqual({ status: "synced", caldavHref: `${CALENDAR}${baseRow().ical_uid}.ics`, remoteEtag: '"reconciled"' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const thirdCallInit = fetchImpl.mock.calls[2][1];
    expect((thirdCallInit.headers as Record<string, string>)["If-Match"]).toBe('"already-there"');
  });
});

describe("reconcileOneLeg — reschedule updates the existing event (test #8)", () => {
  it("uses PUT with If-Match against the already-known href, never a fresh create", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(204, { ETag: '"e2"' }));
    const row = baseRow({ caldav_href: `${CALENDAR}uid.ics`, remote_etag: '"e1"' });
    const outcome = await reconcileOneLeg(row, { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" });

    expect(outcome).toEqual({ status: "synced", caldavHref: `${CALENDAR}uid.ics`, remoteEtag: '"e2"' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [href, init] = fetchImpl.mock.calls[0];
    expect(href).toBe(`${CALENDAR}uid.ics`);
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["If-Match"]).toBe('"e1"');
    expect((init.headers as Record<string, string>)["If-None-Match"]).toBeUndefined();
  });

  it("412 on an update triggers a fresh read and one retry with the new etag (test #16)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(412))
      .mockResolvedValueOnce(fakeResponse(200, { ETag: '"newer"' }))
      .mockResolvedValueOnce(fakeResponse(204, { ETag: '"final"' }));
    const row = baseRow({ caldav_href: `${CALENDAR}uid.ics`, remote_etag: '"stale"' });
    const outcome = await reconcileOneLeg(row, { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" });
    expect(outcome).toEqual({ status: "synced", caldavHref: `${CALENDAR}uid.ics`, remoteEtag: '"final"' });
  });

  it("a persistent 412 even after the fresh-read retry reports retry_now, not a crash", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(412))
      .mockResolvedValueOnce(fakeResponse(200, { ETag: '"newer"' }))
      .mockResolvedValueOnce(fakeResponse(412));
    const row = baseRow({ caldav_href: `${CALENDAR}uid.ics`, remote_etag: '"stale"' });
    const outcome = await reconcileOneLeg(row, { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" });
    expect(outcome).toEqual({ status: "retry_now" });
  });
});

describe("reconcileOneLeg — deletion (test #11, #15)", () => {
  it("deletes with If-Match against the known etag", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(204));
    const row = baseRow({ desired_disposition: "absent", caldav_href: `${CALENDAR}uid.ics`, remote_etag: '"e1"' });
    const outcome = await reconcileOneLeg(row, { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" });
    expect(outcome).toEqual({ status: "synced", caldavHref: null, remoteEtag: null });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe("DELETE");
    expect((init.headers as Record<string, string>)["If-Match"]).toBe('"e1"');
  });

  it("an already-deleted resource (404) is treated as success, no error, no extra retry", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(404));
    const row = baseRow({ desired_disposition: "absent", caldav_href: `${CALENDAR}uid.ics`, remote_etag: '"e1"' });
    const outcome = await reconcileOneLeg(row, { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" });
    expect(outcome).toEqual({ status: "synced", caldavHref: null, remoteEtag: null });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("absent with no recorded href still deletes the deterministic href after a possible lost create acknowledgement", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(404));
    const row = baseRow({ desired_disposition: "absent", caldav_href: null, remote_etag: null });
    const outcome = await reconcileOneLeg(row, { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" });
    expect(outcome).toEqual({ status: "synced", caldavHref: null, remoteEtag: null });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${CALENDAR}${baseRow().ical_uid}.ics`);
    expect(fetchImpl.mock.calls[0][1].method).toBe("DELETE");
  });
});

describe("reconcileOneLeg — historical disposition still writes the event (test #14)", () => {
  it("a historical leg is PUT the same way an active one is — preserved, not deleted", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(204, { ETag: '"e1"' }));
    const row = baseRow({ desired_disposition: "historical", caldav_href: `${CALENDAR}uid.ics`, remote_etag: '"e0"' });
    const outcome = await reconcileOneLeg(row, { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" });
    expect(outcome.status).toBe("synced");
    expect(fetchImpl.mock.calls[0][1].method).toBe("PUT");
    expect(fetchImpl.mock.calls[0][1].body).not.toContain("BEGIN:VALARM");
  });
});

describe("reconcileOneLeg — calendar switching", () => {
  const PRODUCTION_CALENDAR = "https://caldav.icloud.com/123/calendars/production/";

  it("creates the replacement in the new calendar before deleting the old-calendar resource", async () => {
    const oldHref = `${CALENDAR}${baseRow().ical_uid}.ics`;
    const newHref = `${PRODUCTION_CALENDAR}${baseRow().ical_uid}.ics`;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(201, { ETag: '"production"' }))
      .mockResolvedValueOnce(fakeResponse(204));

    const outcome = await reconcileOneLeg(
      baseRow({
        desired_calendar_identity: PRODUCTION_CALENDAR,
        synced_calendar_identity: CALENDAR,
        caldav_href: oldHref,
        remote_etag: '"test"',
      }),
      { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" }
    );

    expect(outcome).toEqual({ status: "synced", caldavHref: newHref, remoteEtag: '"production"' });
    expect(fetchImpl.mock.calls[0][0]).toBe(newHref);
    expect(fetchImpl.mock.calls[0][1].method).toBe("PUT");
    expect(fetchImpl.mock.calls[1][0]).toBe(oldHref);
    expect(fetchImpl.mock.calls[1][1].method).toBe("DELETE");
  });

  it("an absent row deletes both old and desired deterministic hrefs to repair a stale switch", async () => {
    const oldHref = `${CALENDAR}${baseRow().ical_uid}.ics`;
    const newHref = `${PRODUCTION_CALENDAR}${baseRow().ical_uid}.ics`;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(404))
      .mockResolvedValueOnce(fakeResponse(204));

    const outcome = await reconcileOneLeg(
      baseRow({
        desired_disposition: "absent",
        desired_calendar_identity: PRODUCTION_CALENDAR,
        synced_calendar_identity: CALENDAR,
        caldav_href: oldHref,
        remote_etag: '"test"',
      }),
      { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" }
    );

    expect(outcome).toEqual({ status: "synced", caldavHref: null, remoteEtag: null });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([oldHref, newHref]);
  });
});

describe("reconcileOneLeg — never touches anything but its own deterministic resource (test #20)", () => {
  it("every fetch call target is derived only from this row's own calendar identity and uid, never a listing/enumeration call", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(204, { ETag: '"e1"' }));
    const row = baseRow({ caldav_href: `${CALENDAR}${baseRow().ical_uid}.ics`, remote_etag: '"e0"' });
    await reconcileOneLeg(row, { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" });
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(url).toBe(row.caldav_href);
      expect(["PUT", "GET", "DELETE"]).toContain(init.method ?? "GET");
    }
  });

  it("no calendar is configured yet — no CalDAV call happens at all, and the row is reported synced as a no-op", async () => {
    const fetchImpl = vi.fn();
    const row = baseRow({ desired_calendar_identity: null });
    const outcome = await reconcileOneLeg(row, { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" });
    expect(outcome.status).toBe("synced");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("reconcileOneLeg — unexpected failures are caught and sanitized, never crash the batch (test #22)", () => {
  it("a thrown network error becomes a 'failed' outcome with a sanitized message", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET while sending Authorization: Basic secretvalue=="));
    const outcome = await reconcileOneLeg(baseRow(), { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" });
    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.sanitizedError).not.toContain("secretvalue==");
    }
  });
});

describe("processPendingCalendarSyncBatch — claim ownership and writeback", () => {
  function claimedRow() {
    return {
      ...baseRow(),
      id: "22222222-2222-2222-2222-222222222222",
      leg: "pickup",
      desired_version: 2,
      synced_version: 1,
      fulfilled: false,
      attempt_count: 3,
      next_attempt_at: "2026-09-25T12:00:00.000Z",
      last_attempted_at: "2026-09-25T12:00:00.000Z",
      last_success_at: null,
      last_error: null,
      claimed_at: "2026-09-25T12:00:00.000Z",
      claimed_by: null,
      created_at: "2026-09-25T12:00:00.000Z",
      updated_at: "2026-09-25T12:00:00.000Z",
    };
  }

  function fakeSupabase(writeResult: { data: { id: string }[] | null; error: unknown }) {
    const update = vi.fn();
    const filters: [string, unknown][] = [];
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.update = vi.fn((payload: unknown) => {
      update(payload);
      return builder;
    });
    builder.eq = vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return builder;
    });
    builder.is = vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return builder;
    });
    builder.select = vi.fn().mockResolvedValue(writeResult);

    const rpc = vi.fn().mockResolvedValue({ data: [claimedRow()], error: null });
    const from = vi.fn(() => builder);
    return {
      client: { rpc, from } as never,
      rpc,
      update,
      filters,
    };
  }

  it("uses a unique claim token and clears it only through a matching conditional success write", async () => {
    const db = fakeSupabase({
      data: [{ id: "22222222-2222-2222-2222-222222222222" }],
      error: null,
    });
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(201, { ETag: '"e1"' }));

    const result = await processPendingCalendarSyncBatch(
      db.client,
      { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" },
      1
    );

    expect(result).toEqual({ claimed: 1, synced: 1, retried: 0, failed: 0 });
    const rpcArgs = db.rpc.mock.calls[0][1];
    expect(rpcArgs.p_claimed_by).toMatch(/^[0-9a-f-]{36}$/);
    expect(db.filters).toContainEqual(["claimed_by", rpcArgs.p_claimed_by]);
    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ attempt_count: 0, claimed_at: null, claimed_by: null })
    );
  });

  it("does not report a database acknowledgement error as a successful sync", async () => {
    const db = fakeSupabase({ data: null, error: { message: "write failed" } });
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(201, { ETag: '"e1"' }));

    const result = await processPendingCalendarSyncBatch(
      db.client,
      { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" },
      1
    );

    expect(result).toEqual({ claimed: 1, synced: 0, retried: 0, failed: 1 });
  });

  it("treats a zero-row conditional acknowledgement as an invalidated stale claim", async () => {
    const db = fakeSupabase({ data: [], error: null });
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(201, { ETag: '"e1"' }));

    const result = await processPendingCalendarSyncBatch(
      db.client,
      { fetchImpl, credentials, adminBaseUrl: "https://marslaundromat.com" },
      1
    );

    expect(result).toEqual({ claimed: 1, synced: 0, retried: 1, failed: 0 });
  });
});
