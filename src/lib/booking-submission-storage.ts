import { z } from "zod";
import { formatDateDisplay, windowLabel, type BookingInput } from "@/lib/validations/booking-schema";

const STORAGE_KEY = "mars-laundromat:booking-submission";

export const STORED_ATTEMPT_PHASES = ["pending", "succeeded", "conflict", "uncertain", "error"] as const;
export type StoredAttemptPhase = (typeof STORED_ATTEMPT_PHASES)[number];

export interface RequestedScheduleSummary {
  serviceLabel: string;
  pickupLabel: string;
  deliveryLabel: string;
}

export interface StoredAttempt {
  clientSubmissionId: string;
  phase: StoredAttemptPhase;
  // Retained while a safe retry or a refresh-restore might still need the
  // customer's entered data — pending/conflict/uncertain/error. Dropped
  // once succeeded, per "minimal personal information": nothing ambiguous
  // is left once a request is confirmed accepted, so there's no reason to
  // go on holding name/phone/address/etc. in browser storage.
  values?: BookingInput;
  acceptedBookingId?: string;
  summary?: RequestedScheduleSummary;
  // Only for phase "error" — the definite-rejection message, so a refresh
  // restores the same accurate message instead of the form silently
  // falling back to a blank slate, or (worse) being misclassified as
  // "uncertain" from a stale leftover "pending" record.
  errorMessage?: string;
}

// Deliberately loose on `values`/`summary` — this module only needs to
// confirm the record is self-consistent enough to trust (right top-level
// shape, a real phase, an id), not re-validate booking content that
// bookingSchema/bookingSchemaShape will validate again anyway wherever it's
// actually used. Never reject on an unexpected extra key.
const StoredAttemptSchema = z.object({
  clientSubmissionId: z.string().min(1),
  phase: z.enum(STORED_ATTEMPT_PHASES),
  values: z.record(z.string(), z.unknown()).optional(),
  acceptedBookingId: z.string().min(1).optional(),
  summary: z
    .object({ serviceLabel: z.string(), pickupLabel: z.string(), deliveryLabel: z.string() })
    .optional(),
  errorMessage: z.string().min(1).optional(),
});

// globalThis.sessionStorage, not the bare identifier — a plain property
// access that safely evaluates to undefined when the global doesn't exist
// (a Node test environment with no DOM), instead of throwing a
// ReferenceError before the try/catch below ever gets a chance to run. In a
// real browser this is exactly the same object as bare `sessionStorage`.
// Tests stub this directly (no jsdom/happy-dom dependency needed) by
// assigning a fake onto globalThis.sessionStorage.
function getSessionStorage(): Storage | undefined {
  return globalThis.sessionStorage;
}

// In-memory fallback for the one thing that must survive even when
// sessionStorage itself is unavailable (private browsing, quota exceeded,
// a browser that blocks it entirely): the submission id. Without this, two
// calls to getOrMintSubmissionId() in the same page load — e.g. an initial
// submit followed by a Retry click — would each mint a DIFFERENT id when
// storage can't persist anything between them, silently defeating the
// entire dedup mechanism for exactly the customers most likely to need it.
// This does not (and cannot) survive a real page refresh; it only holds
// within the current JS module instance's lifetime, which is all storage
// being unavailable can ever allow.
let inMemorySubmissionId: string | null = null;

/**
 * Every read/write goes through here, wrapped in try/catch — a private
 * window, blocked/quota-exceeded storage, or hand-corrupted data must never
 * break submission itself, only the ability to recover across a refresh.
 * Any record successfully read refreshes the in-memory id fallback above,
 * regardless of which public function triggered the read.
 */
function readRaw(): StoredAttempt | null {
  try {
    const storage = getSessionStorage();
    if (!storage) return null;
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = StoredAttemptSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    inMemorySubmissionId = parsed.data.clientSubmissionId;
    return parsed.data as StoredAttempt;
  } catch {
    return null;
  }
}

function writeRaw(attempt: StoredAttempt): void {
  inMemorySubmissionId = attempt.clientSubmissionId;
  try {
    const storage = getSessionStorage();
    if (!storage) return;
    storage.setItem(STORAGE_KEY, JSON.stringify(attempt));
  } catch {
    // Storage unavailable (private browsing, quota exceeded) — the
    // caller's in-memory React state is still the source of truth for the
    // current page load; only refresh-recovery is lost, not submission
    // itself. The in-memory id fallback above still holds.
  }
}

export function readStoredAttempt(): StoredAttempt | null {
  return readRaw();
}

/**
 * Returns the existing stored submission id if one is present, otherwise
 * mints a fresh one — and durably persists a minimal pending record for
 * that fresh id immediately, so a freshly-minted id can never be silently
 * lost even if a caller somehow doesn't follow up with a fuller write.
 * Never rotates an id that's already stored or already held in memory;
 * only clearStoredAttempt() (called from "Submit another request")
 * removes one.
 */
export function getOrMintSubmissionId(): string {
  const existing = readRaw();
  if (existing) return existing.clientSubmissionId;
  if (inMemorySubmissionId) return inMemorySubmissionId;

  const clientSubmissionId = crypto.randomUUID();
  writeRaw({ clientSubmissionId, phase: "pending" });
  return clientSubmissionId;
}

export function persistPendingAttempt(clientSubmissionId: string, values: BookingInput): void {
  writeRaw({ clientSubmissionId, phase: "pending", values });
}

export function persistUncertainAttempt(clientSubmissionId: string, values: BookingInput): void {
  writeRaw({ clientSubmissionId, phase: "uncertain", values });
}

export function persistConflictAttempt(clientSubmissionId: string, values: BookingInput): void {
  writeRaw({ clientSubmissionId, phase: "conflict", values });
}

/**
 * A definite rejection (bad shape, or a genuinely new attempt that fails
 * business-rule validation) — nothing exists and nothing will be created,
 * but that's still worth remembering under the SAME id across a refresh:
 * without this, a stale "pending" record left over from just before the
 * rejection would restore as "uncertain" instead (see booking-form.tsx's
 * restoration effect), misleadingly suggesting the outcome is unknown when
 * it was actually definite. Never mints a new id — same clientSubmissionId
 * the caller already has.
 */
export function persistErrorAttempt(
  clientSubmissionId: string,
  values: BookingInput,
  errorMessage: string
): void {
  writeRaw({ clientSubmissionId, phase: "error", values, errorMessage });
}

export function persistSucceededAttempt(
  clientSubmissionId: string,
  acceptedBookingId: string,
  summary: RequestedScheduleSummary
): void {
  // values deliberately omitted — see StoredAttempt's own comment.
  writeRaw({ clientSubmissionId, phase: "succeeded", acceptedBookingId, summary });
}

export function clearStoredAttempt(): void {
  inMemorySubmissionId = null;
  try {
    getSessionStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — if storage is unavailable, there was never anything
    // durable to clear in the first place.
  }
}

/**
 * The requested-schedule summary shown on the persistent success panel —
 * "requested, awaiting confirmation," never implying the booking is
 * actually confirmed. Pure and separate from booking-form.tsx so it's
 * directly unit-testable; lives here (not there) because
 * RequestedScheduleSummary is already this module's own type, and this is
 * the one place that both builds and persists it.
 */
export function buildRequestedScheduleSummary(values: BookingInput): RequestedScheduleSummary {
  const serviceLabel = values.dryCleaning
    ? values.washAndFold
      ? "Wash & Fold + Dry Cleaning & Ironing"
      : "Dry Cleaning & Ironing"
    : "Wash & Fold";
  return {
    serviceLabel,
    pickupLabel: `${formatDateDisplay(values.preferredPickupDate)}, ${windowLabel(values.preferredPickupTime) ?? ""}`,
    deliveryLabel: `${formatDateDisplay(values.preferredDeliveryDate)}, ${windowLabel(values.preferredDeliveryTime) ?? ""}`,
  };
}
