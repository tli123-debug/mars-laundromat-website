import { isAcquisitionSource, normalizeAcquisitionSource } from "@/lib/acquisition-source";
import type { AcquisitionSource } from "@/types/database.types";

/**
 * Remembers, in the visitor's own browser only, that they arrived from a
 * Google ad (or another tracked link). The booking form uses it to tag the
 * booking correctly even after the visitor browses a few pages first —
 * /book only ever sees its own URL, so a ?gclid= or ?source= on the landing
 * page would otherwise be lost the moment they click "Book a Pickup".
 *
 * Nothing here is sent to the server or saved in the database: the booking
 * form turns the remembered source into the existing acquisition_source
 * value. The raw click IDs and UTM values are kept only so a later phase
 * could store them if it's ever wanted.
 */

export const AD_ATTRIBUTION_STORAGE_KEY = "mars-ad-attribution";

// Matches Google Ads' default 30-day click-through conversion window, so an
// ad click from five weeks ago never gets credited with today's booking.
export const AD_ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AdAttribution {
  /** What the admin shows. null when the visit carried UTM values only. */
  source: AcquisitionSource | null;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  capturedAt: number;
}

/** The subset of the Storage API this module needs — lets tests pass a fake. */
export interface AttributionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Google click IDs are URL-safe base64-style strings. Anything else (spaces,
// angle brackets, quotes) is not a real click ID and is dropped.
const CLICK_ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-search"]);
const MAX_LABEL_LENGTH = 100;

function cleanClickId(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return CLICK_ID_PATTERN.test(trimmed) ? trimmed : undefined;
}

function cleanLabel(value: string | null): string | undefined {
  if (!value) return undefined;
  const printable = [...value]
    .filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127)
    .join("")
    .trim()
    .slice(0, MAX_LABEL_LENGTH);
  return printable || undefined;
}

/**
 * Reads attribution out of a URL query string. Returns null when the visit
 * carries nothing worth remembering, so an ordinary direct visit never
 * overwrites an earlier ad click.
 *
 * Source rules, in priority order:
 *   1. A valid ?source= value (the existing tracked-link convention) wins.
 *   2. A Google click ID (gclid, or the iOS-privacy gbraid/wbraid) means the
 *      visitor clicked a Google ad.
 *   3. utm_source=google with a paid medium (cpc, ppc, ...) means the same.
 */
export function parseAdAttribution(search: string, now: number): AdAttribution | null {
  const params = new URLSearchParams(search);

  const gclid = cleanClickId(params.get("gclid"));
  const gbraid = cleanClickId(params.get("gbraid"));
  const wbraid = cleanClickId(params.get("wbraid"));
  const utmSource = cleanLabel(params.get("utm_source"));
  const utmMedium = cleanLabel(params.get("utm_medium"));
  const utmCampaign = cleanLabel(params.get("utm_campaign"));
  const utmTerm = cleanLabel(params.get("utm_term"));
  const utmContent = cleanLabel(params.get("utm_content"));
  const explicitSource = normalizeAcquisitionSource(params.get("source"));

  const isPaidGoogleUtm =
    utmSource?.toLowerCase() === "google" && PAID_MEDIUMS.has((utmMedium ?? "").toLowerCase());
  const hasGoogleClickId = Boolean(gclid || gbraid || wbraid);
  const source: AcquisitionSource | null =
    explicitSource ?? (hasGoogleClickId || isPaidGoogleUtm ? "google_ads" : null);

  const hasAnything =
    source !== null ||
    hasGoogleClickId ||
    Boolean(utmSource || utmMedium || utmCampaign || utmTerm || utmContent);
  if (!hasAnything) return null;

  return {
    source,
    gclid,
    gbraid,
    wbraid,
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    capturedAt: now,
  };
}

function isAdAttribution(value: unknown): value is AdAttribution {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.capturedAt !== "number" || !Number.isFinite(record.capturedAt)) return false;
  if (record.source !== null && (typeof record.source !== "string" || !isAcquisitionSource(record.source))) {
    return false;
  }
  return true;
}

/** localStorage, or null when the browser blocks it (private mode, strict settings). */
export function getBrowserStorage(): AttributionStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The remembered attribution if it exists, is well-formed, and is under 30 days old. */
export function readAdAttribution(storage: AttributionStorage | null, now: number): AdAttribution | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(AD_ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isAdAttribution(parsed)) return null;
    if (now - parsed.capturedAt > AD_ATTRIBUTION_TTL_MS) {
      storage.removeItem(AD_ATTRIBUTION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Called on page load. Last meaningful touch wins: a new tracked visit
 * replaces an older one, and a plain direct visit changes nothing.
 */
export function captureAdAttribution(
  storage: AttributionStorage | null,
  search: string,
  now: number
): AdAttribution | null {
  const parsed = parseAdAttribution(search, now);
  if (!parsed) return null;
  try {
    storage?.setItem(AD_ATTRIBUTION_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Storage full or blocked: attribution is a nice-to-have, never worth an error.
  }
  return parsed;
}

/** Used after a booking succeeds, so the customer's next order isn't credited to the same ad click. */
export function clearAdAttribution(storage: AttributionStorage | null): void {
  try {
    storage?.removeItem(AD_ATTRIBUTION_STORAGE_KEY);
  } catch {
    // Nothing useful to do if storage is unavailable.
  }
}

export function storedAdSource(storage: AttributionStorage | null, now: number): AcquisitionSource | null {
  return readAdAttribution(storage, now)?.source ?? null;
}
