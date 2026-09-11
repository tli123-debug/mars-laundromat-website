import { siteConfig } from "@/content/site-config";
import { VENMO_RECIPIENT_DETAIL, ZELLE_RECIPIENT_DETAIL } from "@/content/payment";
import { formatDollars } from "@/lib/format-currency";
import { SERVICE_TYPE_CUSTOMER_LABELS } from "@/lib/service-type";
import { windowLabel } from "@/lib/validations/booking-schema";
import type { ServiceType } from "@/types/database.types";

/**
 * Quick-action link builders for a booking's OWN phone/address — distinct
 * from site-config.ts's phoneHref()/fullAddress(), which only ever build
 * links for the business's fixed number/address, not a customer's.
 */

export function bookingPhoneHref(phone: string): string {
  return `tel:${phone.replace(/\D/g, "")}`;
}

/** A single confirmed pickup or delivery window, as stored on a booking. */
export interface ConfirmedWindow {
  date: string;
  time: string;
}

/** "2026-09-02" -> "Wed, Sep 2" — the same short date format already used across the admin UI. */
function formatMessageDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
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
 * Joins payment method names into a natural English list — "Cash" (1),
 * "Cash or Zelle" (2), "Cash, Zelle, or Venmo" (3+) — so the "accepted"
 * sentence in buildQuoteTextMessage() always lists exactly the methods that
 * actually have a detail line below it, never drifting out of sync with
 * ZELLE_RECIPIENT_DETAIL/VENMO_RECIPIENT_DETAIL.
 */
function joinPaymentMethods(methods: string[]): string {
  if (methods.length <= 1) return methods.join("");
  if (methods.length === 2) return `${methods[0]} or ${methods[1]}`;
  return `${methods.slice(0, -1).join(", ")}, or ${methods[methods.length - 1]}`;
}

/**
 * The exact owner-approved assisted quote-text wording. Cash is always
 * accepted; Zelle/Venmo each join the "accepted" sentence and gain their own
 * detail line only when their respective content/payment.ts constant is set
 * — either can be left null if that method isn't ready yet, and the message
 * adjusts automatically with no other code change needed.
 *
 * `confirmedDelivery` is optional and omitted gracefully: older/legacy rows
 * can have a quote without complete confirmed delivery fields yet (times
 * negotiation and quoting are independent flows), so passing null/undefined
 * here produces the same delivery-free message format, with no dangling or
 * malformed delivery sentence.
 */
export function buildQuoteTextMessage(
  customerName: string,
  quoteTotalCents: number,
  confirmedDelivery?: ConfirmedWindow | null
): string {
  const deliverySentence = confirmedDelivery
    ? `\nWe'll deliver it back ${formatMessageDate(confirmedDelivery.date)}, ${windowLabel(confirmedDelivery.time)}.`
    : "";

  const paymentMethods = ["Cash"];
  const paymentDetailLines: string[] = [];
  if (ZELLE_RECIPIENT_DETAIL) {
    paymentMethods.push("Zelle");
    paymentDetailLines.push(`Zelle: ${ZELLE_RECIPIENT_DETAIL}`);
  }
  if (VENMO_RECIPIENT_DETAIL) {
    paymentMethods.push("Venmo");
    paymentDetailLines.push(`Venmo: @${VENMO_RECIPIENT_DETAIL}`);
  }
  const detailLinesBlock = paymentDetailLines.length > 0 ? `\n${paymentDetailLines.join("\n")}` : "";

  return (
    `Hi ${customerName}, this is Mars Laundromat.\n\n` +
    `Your order total is ${formatDollars(quoteTotalCents)}.` +
    deliverySentence +
    `\n\n${joinPaymentMethods(paymentMethods)} accepted.${detailLinesBlock}\n` +
    `You can pay cash at the door when we deliver.` +
    `\n\nPlease reply if you have any questions.`
  );
}

/** SMS deep link for the assisted quote-text button — see buildQuoteTextMessage(). */
export function bookingQuoteTextHref(
  phone: string,
  customerName: string,
  quoteTotalCents: number,
  confirmedDelivery?: ConfirmedWindow | null
): string {
  return bookingSmsHref(phone, buildQuoteTextMessage(customerName, quoteTotalCents, confirmedDelivery));
}

/**
 * The pickup-confirmation message: sent once staff have approved/saved a
 * complete confirmed pickup AND delivery time (the caller — TimeEditor — only
 * renders the "Text Pickup Confirmation" button once both are non-null, so
 * neither ConfirmedWindow here is optional). Deliberately says nothing about
 * price: the total isn't known until the order is weighed/counted at the
 * store, which is exactly what this message tells the customer to expect
 * next — see buildQuoteTextMessage() for the separate, later quote text.
 */
export function buildPickupConfirmationMessage(
  customerName: string,
  serviceType: ServiceType,
  confirmedPickup: ConfirmedWindow,
  confirmedDelivery: ConfirmedWindow
): string {
  return (
    `Hi ${customerName}, this is Mars Laundromat.\n\n` +
    `Your ${SERVICE_TYPE_CUSTOMER_LABELS[serviceType]} pickup is confirmed for ` +
    `${formatMessageDate(confirmedPickup.date)}, ${windowLabel(confirmedPickup.time)}.\n` +
    `We'll deliver it back ${formatMessageDate(confirmedDelivery.date)}, ${windowLabel(confirmedDelivery.time)}.` +
    `\n\nWe'll text your final total once we've received your order and finished weighing/counting it.` +
    `\n\nPlease reply if you have any questions.`
  );
}

/** SMS deep link for the assisted pickup-confirmation button — see buildPickupConfirmationMessage(). */
export function bookingPickupConfirmationTextHref(
  phone: string,
  customerName: string,
  serviceType: ServiceType,
  confirmedPickup: ConfirmedWindow,
  confirmedDelivery: ConfirmedWindow
): string {
  return bookingSmsHref(
    phone,
    buildPickupConfirmationMessage(customerName, serviceType, confirmedPickup, confirmedDelivery)
  );
}

/**
 * The exact owner-approved recurring-pickup offer, sent once after a
 * completed order. Deliberately not parameterized by service type — it
 * always says "recurring Wash & Fold," even for a completed Both Services
 * order, since Recurring V1 never covers Dry Cleaning; the caller
 * (isEligibleForRecurringOffer in recurring-schedule.ts) is what decides
 * whether this offer should be shown at all for a given booking, not this
 * function. No customer reply is ever interpreted automatically — this
 * only opens a prefilled message for staff to review and send by hand,
 * same as every other assisted-text button in this app.
 */
export function buildRecurringOfferMessage(customerName: string): string {
  return (
    `Hi ${customerName}, this is Mars Laundromat.\n\n` +
    `Thank you for choosing us. We hope everything came back just the way you wanted.\n\n` +
    `If you'd like, we can set up a recurring Wash & Fold pickup every week or every two weeks, so you won't need to book each time.\n\n` +
    `Reply WEEKLY or EVERY 2 WEEKS if you're interested, or let us know if you have any questions.`
  );
}

/** SMS deep link for the assisted recurring-offer button — see buildRecurringOfferMessage(). */
export function bookingRecurringOfferTextHref(phone: string, customerName: string): string {
  return bookingSmsHref(phone, buildRecurringOfferMessage(customerName));
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
