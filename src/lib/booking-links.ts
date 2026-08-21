import { siteConfig } from "@/content/site-config";

/**
 * Quick-action link builders for a booking's OWN phone/address — distinct
 * from site-config.ts's phoneHref()/fullAddress(), which only ever build
 * links for the business's fixed number/address, not a customer's.
 */

export function bookingPhoneHref(phone: string): string {
  return `tel:${phone.replace(/\D/g, "")}`;
}

/** No prefilled body — Milestone 7 adds templated, prefilled message bodies. */
export function bookingSmsHref(phone: string): string {
  return `sms:${phone.replace(/\D/g, "")}`;
}

/**
 * Keyless Google Maps search URL — no API key or billing dependency.
 * A customer's free-text address has no structured city/state field, so an
 * address that doesn't already mention Brooklyn gets the neighborhood/city/
 * state appended to anchor the query — but not if it's already there, which
 * would otherwise produce a garbled, duplicated query.
 */
export function bookingMapsHref(address: string): string {
  const alreadyAnchored = /brooklyn/i.test(address);
  const query = alreadyAnchored ? address : `${address}, ${siteConfig.coverageArea.label}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
