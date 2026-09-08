import type { AcquisitionSource } from "@/types/database.types";

/**
 * The complete, exhaustive set of values acquisition_source may hold in the
 * database — mirrors bookings_acquisition_source_check in
 * supabase/migrations/20260908000000_add_acquisition_source_to_bookings.sql.
 * Add a new source here and to that CHECK constraint together.
 */
export const ACQUISITION_SOURCES: readonly AcquisitionSource[] = [
  "google_ads",
  "google_business",
  "google_search_maps",
  "nextdoor",
  "facebook_instagram",
  "meta_ads",
  "apartment_flyer",
  "storefront",
  "referral",
  "existing_customer",
  "other",
];

export function isAcquisitionSource(value: string): value is AcquisitionSource {
  return (ACQUISITION_SOURCES as readonly string[]).includes(value);
}

/**
 * The single normalization primitive for every untrusted acquisition_source
 * input this feature accepts — a tracked link's `?source=` query parameter
 * and the public form's own optional field both funnel through this same
 * function, so both get identical treatment: missing, blank, or unrecognized
 * all become null (never an empty string, never a raw unchecked value),
 * and a bad value never blocks or fails whatever it's attached to. Server
 * Actions must call this themselves rather than trust a value already
 * normalized client-side (e.g. by the /book page hiding the form question).
 */
export function normalizeAcquisitionSource(rawValue: string | null | undefined): AcquisitionSource | null {
  if (!rawValue) return null;
  return isAcquisitionSource(rawValue) ? rawValue : null;
}

export interface AcquisitionSourceOption {
  value: AcquisitionSource;
  label: string;
}

/**
 * Customer-facing options for the public booking form's optional "How did
 * you hear about us?" question, in display order. google_ads/google_business
 * /meta_ads are deliberately absent: those three are tracked-link-only
 * values a customer filling out the form directly would never pick for
 * themselves — they only ever reach acquisition_source through
 * normalizeAcquisitionSource() on a campaign link's query parameter.
 */
export const ACQUISITION_SOURCE_FORM_OPTIONS: readonly AcquisitionSourceOption[] = [
  { value: "google_search_maps", label: "Google Search or Maps" },
  { value: "nextdoor", label: "Nextdoor" },
  { value: "facebook_instagram", label: "Facebook or Instagram" },
  { value: "apartment_flyer", label: "Apartment or building flyer" },
  { value: "storefront", label: "Walked past the store" },
  { value: "referral", label: "Friend or family" },
  { value: "existing_customer", label: "Existing Mars customer" },
  { value: "other", label: "Other" },
];

/**
 * Bilingual, staff-facing labels for every permitted acquisition_source
 * value — shared by the admin bookings-list badge, the source filter, and
 * the booking-detail correction control so all three always agree on
 * wording. A Record<AcquisitionSource, string> so a future source without
 * an entry here is a compile error, not a silently unlabeled option.
 */
export const ACQUISITION_SOURCE_ADMIN_LABELS: Record<AcquisitionSource, string> = {
  google_ads: "Google Ads 谷歌广告",
  google_business: "Google Business 谷歌商家",
  google_search_maps: "Google Search / Maps 谷歌搜索/地图",
  nextdoor: "Nextdoor",
  facebook_instagram: "Facebook / Instagram",
  meta_ads: "Meta Ads Meta广告",
  apartment_flyer: "Apartment Flyer 公寓传单",
  storefront: "Storefront / Walk-by 路过店面",
  referral: "Friend / Family Referral 亲友推荐",
  existing_customer: "Existing Customer 老顾客",
  other: "Other 其他",
};

/** Shown wherever a booking's acquisition_source is null — list badge, filter, and detail page alike. */
export const ACQUISITION_SOURCE_NOT_PROVIDED_LABEL = "Not provided 未提供";

/**
 * The public booking form's initial `acquisitionSource` field value, given
 * whatever tracked source (if any) the /book page's own ?source= query
 * parameter resolved via normalizeAcquisitionSource(). "" (not null)
 * matches every other optional field's own empty-string default in
 * bookingFormDefaults — react-hook-form/Zod's `.optional().or(z.literal(""))`
 * shape expects a string, not null.
 */
export function resolveAcquisitionSourceFormDefault(
  trackedSource: AcquisitionSource | null
): AcquisitionSource | "" {
  return trackedSource ?? "";
}

/**
 * Whether a raw admin-submitted correction value is acceptable to write:
 * any permitted source, or null to explicitly clear it back to "not
 * provided." Deliberately stricter than normalizeAcquisitionSource(), which
 * silently maps a bad value to null for the public form (where attribution
 * must never block a booking) — an admin correction is a deliberate,
 * authenticated action, so a bad value here should surface as a rejected
 * update, not be quietly swallowed into a different value than what staff
 * asked to save.
 */
export function isValidAcquisitionSourceUpdate(value: unknown): value is AcquisitionSource | null {
  return value === null || (typeof value === "string" && isAcquisitionSource(value));
}
