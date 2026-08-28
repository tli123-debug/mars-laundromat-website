import { siteConfig } from "@/content/site-config";
import { ZELLE_RECIPIENT_DETAIL } from "@/content/payment";
import { formatDollars } from "@/lib/format-currency";

/**
 * Quick-action link builders for a booking's OWN phone/address — distinct
 * from site-config.ts's phoneHref()/fullAddress(), which only ever build
 * links for the business's fixed number/address, not a customer's.
 */

export function bookingPhoneHref(phone: string): string {
  return `tel:${phone.replace(/\D/g, "")}`;
}

/**
 * `body` is a query param, not part of the path — encoded the same way
 * bookingMapsHref() encodes its query, since it's free text that can
 * contain spaces, punctuation, and dollar signs. Omitting it keeps the
 * original no-prefill behavior (the quick-action "Text" button) exactly as
 * before; passing one is what buildQuoteTextMessage()'s assisted quote text
 * uses.
 */
export function bookingSmsHref(phone: string, body?: string): string {
  const base = `sms:${phone.replace(/\D/g, "")}`;
  return body ? `${base}?body=${encodeURIComponent(body)}` : base;
}

/**
 * The exact owner-approved assisted quote-text wording. ZELLE_RECIPIENT_DETAIL
 * is null until the owner has real Zelle-ready details to share — once
 * that's set, it's appended automatically and this function never needs to
 * change again for that reason alone.
 */
export function buildQuoteTextMessage(customerName: string, quoteTotalCents: number): string {
  const zelleDetail = ZELLE_RECIPIENT_DETAIL ? ` (Zelle: ${ZELLE_RECIPIENT_DETAIL})` : "";
  return (
    `Hi ${customerName}, this is Mars Laundromat. Your order total is ${formatDollars(quoteTotalCents)}. ` +
    `Cash or Zelle accepted${zelleDetail}. You can pay cash at the door when we deliver. ` +
    `Please reply if you have any questions.`
  );
}

/** SMS deep link for the assisted quote-text button — see buildQuoteTextMessage(). */
export function bookingQuoteTextHref(phone: string, customerName: string, quoteTotalCents: number): string {
  return bookingSmsHref(phone, buildQuoteTextMessage(customerName, quoteTotalCents));
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
