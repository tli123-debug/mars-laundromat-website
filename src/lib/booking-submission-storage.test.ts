import { beforeEach, describe, expect, it } from "vitest";
import {
  buildRequestedScheduleSummary,
  clearStoredAttempt,
  getOrMintSubmissionId,
  persistConflictAttempt,
  persistErrorAttempt,
  persistPendingAttempt,
  persistSucceededAttempt,
  persistUncertainAttempt,
  readStoredAttempt,
} from "./booking-submission-storage";
import {
  bookingFormDefaults,
  formatDateDisplay,
  windowLabel,
  type BookingInput,
} from "@/lib/validations/booking-schema";

/**
 * A minimal in-memory Storage implementation, stubbed directly onto
 * globalThis — this is what lets this module's tests run under Vitest's
 * default "node" environment with no jsdom/happy-dom dependency. Every
 * production read/write goes through globalThis.sessionStorage specifically
 * so this works.
 */
class FakeStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const sampleValues: BookingInput = { ...bookingFormDefaults, name: "Jane Rivera", smsConsent: true };

beforeEach(() => {
  globalThis.sessionStorage = new FakeStorage();
  // Also resets the module's in-memory id fallback (see
  // booking-submission-storage.ts) — without this, a value minted by one
  // test while simulating "storage unavailable" would leak into the next
  // test's fresh-FakeStorage scenario, since that fallback intentionally
  // outlives any single storage instance.
  clearStoredAttempt();
});

describe("getOrMintSubmissionId", () => {
  it("mints a fresh id and durably persists it immediately", () => {
    const id = getOrMintSubmissionId();
    expect(id).toHaveLength(36); // a UUID
    expect(readStoredAttempt()?.clientSubmissionId).toBe(id);
    expect(readStoredAttempt()?.phase).toBe("pending");
  });

  it("returns the same id on a later call — never rotates on its own", () => {
    const first = getOrMintSubmissionId();
    const second = getOrMintSubmissionId();
    expect(second).toBe(first);
  });

  it("mints a new id only after clearStoredAttempt (the 'Submit another request' path)", () => {
    const first = getOrMintSubmissionId();
    clearStoredAttempt();
    const second = getOrMintSubmissionId();
    expect(second).not.toBe(first);
  });
});

describe("persist*Attempt / readStoredAttempt", () => {
  it("round-trips a pending attempt with its values", () => {
    const id = getOrMintSubmissionId();
    persistPendingAttempt(id, sampleValues);
    const stored = readStoredAttempt();
    expect(stored?.phase).toBe("pending");
    expect(stored?.values?.name).toBe("Jane Rivera");
  });

  it("round-trips an uncertain attempt, keeping values for a safe retry", () => {
    const id = getOrMintSubmissionId();
    persistUncertainAttempt(id, sampleValues);
    const stored = readStoredAttempt();
    expect(stored?.phase).toBe("uncertain");
    expect(stored?.values?.name).toBe("Jane Rivera");
  });

  it("round-trips a conflict attempt, keeping values so the form can still show what was entered", () => {
    const id = getOrMintSubmissionId();
    persistConflictAttempt(id, sampleValues);
    expect(readStoredAttempt()?.phase).toBe("conflict");
  });

  it("drops values once succeeded — minimal personal information, nothing ambiguous left", () => {
    const id = getOrMintSubmissionId();
    persistPendingAttempt(id, sampleValues);
    persistSucceededAttempt(id, "8f14e45f-ceea-4d29-8f39-4c0c35a2a5a4", {
      serviceLabel: "Wash & Fold",
      pickupLabel: "Mon, Sep 21",
      deliveryLabel: "Tue, Sep 22",
    });
    const stored = readStoredAttempt();
    expect(stored?.phase).toBe("succeeded");
    expect(stored?.values).toBeUndefined();
    expect(stored?.acceptedBookingId).toBe("8f14e45f-ceea-4d29-8f39-4c0c35a2a5a4");
  });

  it("clearStoredAttempt removes the record entirely", () => {
    const id = getOrMintSubmissionId();
    persistPendingAttempt(id, sampleValues);
    clearStoredAttempt();
    expect(readStoredAttempt()).toBeNull();
  });
});

describe("malformed or unavailable storage — degrades gracefully, never throws", () => {
  it("treats hand-corrupted JSON as absent", () => {
    globalThis.sessionStorage.setItem("mars-laundromat:booking-submission", "{not valid json");
    expect(readStoredAttempt()).toBeNull();
    // getOrMintSubmissionId must still work — mints fresh rather than throwing.
    expect(() => getOrMintSubmissionId()).not.toThrow();
  });

  it("treats a well-formed-JSON-but-wrong-shape record as absent", () => {
    globalThis.sessionStorage.setItem(
      "mars-laundromat:booking-submission",
      JSON.stringify({ unrelated: "data" })
    );
    expect(readStoredAttempt()).toBeNull();
  });

  it("never throws when sessionStorage itself is unavailable", () => {
    // @ts-expect-error — simulating an environment with no storage at all.
    delete globalThis.sessionStorage;
    expect(() => getOrMintSubmissionId()).not.toThrow();
    expect(readStoredAttempt()).toBeNull();
  });
});

describe("in-memory id fallback when sessionStorage is unavailable", () => {
  it("returns the same UUID across repeated calls, and only clearStoredAttempt() lets a new one be minted", () => {
    // @ts-expect-error — simulating an environment with no storage at all
    // (private browsing, or a browser that blocks it entirely).
    delete globalThis.sessionStorage;

    const first = getOrMintSubmissionId();
    const second = getOrMintSubmissionId();
    expect(second).toBe(first);

    // Without the in-memory fallback, this second call would mint a BRAND
    // NEW id (nothing durable to read back), which is exactly the bug: an
    // initial submit followed by a Retry click, with storage unavailable,
    // would silently defeat the whole dedup mechanism by sending two
    // different ids for what the customer experiences as one attempt.

    clearStoredAttempt();
    const third = getOrMintSubmissionId();
    expect(third).not.toBe(first);
  });
});

describe("persistErrorAttempt / restoration", () => {
  it("round-trips a definite-error attempt under the SAME id, without rotating it", () => {
    const id = getOrMintSubmissionId();
    persistPendingAttempt(id, sampleValues); // mirrors the real flow: pending is written before the network call
    persistErrorAttempt(id, sampleValues, "Please check the form and try again.");

    const stored = readStoredAttempt();
    expect(stored?.clientSubmissionId).toBe(id);
    expect(stored?.phase).toBe("error");
    expect(stored?.errorMessage).toBe("Please check the form and try again.");
    expect(stored?.values?.name).toBe("Jane Rivera");

    // The id itself is untouched by a definite rejection — the next call
    // still returns the same one, never a fresh mint.
    expect(getOrMintSubmissionId()).toBe(id);
  });
});

describe("buildRequestedScheduleSummary", () => {
  const pickupDate = "2026-09-24";
  const pickupTime = "09:00";
  const deliveryDate = "2026-09-25";
  const deliveryTime = "10:00";
  const scheduleValues: BookingInput = {
    ...sampleValues,
    preferredPickupDate: pickupDate,
    preferredPickupTime: pickupTime,
    preferredDeliveryDate: deliveryDate,
    preferredDeliveryTime: deliveryTime,
  };

  it("composes the pickup/delivery labels from the same date+window formatters used elsewhere", () => {
    const summary = buildRequestedScheduleSummary({
      ...scheduleValues,
      washAndFold: true,
      dryCleaning: false,
    });
    expect(summary.pickupLabel).toBe(`${formatDateDisplay(pickupDate)}, ${windowLabel(pickupTime)}`);
    expect(summary.deliveryLabel).toBe(`${formatDateDisplay(deliveryDate)}, ${windowLabel(deliveryTime)}`);
  });

  it("labels a Wash & Fold-only request", () => {
    const summary = buildRequestedScheduleSummary({ ...scheduleValues, washAndFold: true, dryCleaning: false });
    expect(summary.serviceLabel).toBe("Wash & Fold");
  });

  it("labels a Dry Cleaning-only request", () => {
    const summary = buildRequestedScheduleSummary({ ...scheduleValues, washAndFold: false, dryCleaning: true });
    expect(summary.serviceLabel).toBe("Dry Cleaning & Ironing");
  });

  it("labels a combined Wash & Fold + Dry Cleaning request", () => {
    const summary = buildRequestedScheduleSummary({ ...scheduleValues, washAndFold: true, dryCleaning: true });
    expect(summary.serviceLabel).toBe("Wash & Fold + Dry Cleaning & Ironing");
  });
});
