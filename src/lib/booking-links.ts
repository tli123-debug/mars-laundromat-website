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
 *
 * The availability/handoff paragraph is the owner-approved replacement for
 * two separate optional "Confirm Pickup/Delivery Availability" assisted
 * texts — folding the expectation into the one message every customer
 * already gets is more reliable than an easy-to-skip optional step later,
 * and states the unattended-handoff policy in writing at the earliest
 * natural touchpoint.
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
    `\n\nPlease make sure someone or a doorman is AVAILABLE to hand off and receive your laundry ` +
    `during those windows — if your plans change, call or text us to pick a different time. ` +
    `We're not able to leave items unattended unless we've specifically agreed on it.` +
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
 * The "we couldn't do exactly what you asked, here's an alternative"
 * message — sent after staff has saved a complete proposed schedule that
 * genuinely differs from what the customer originally requested (the
 * caller, TimeEditor, is responsible for only showing this once
 * proposedScheduleMatchesPreferred() in time-proposal-validation.ts says
 * false; if the proposal matches what was requested, Approve Requested
 * Time — and buildPickupConfirmationMessage() — is the right message
 * instead). Both pickup and delivery are always listed, even if only one
 * of the two actually changed, so the customer always sees the complete
 * picture rather than having to infer what's still the same. This message
 * only opens a prefilled draft for staff to review and send — it never
 * sends automatically, confirms the schedule, or changes booking status;
 * staff still click Mark Times Confirmed once the customer agrees.
 */
export function buildProposedScheduleMessage(
  customerName: string,
  proposedPickup: ConfirmedWindow,
  proposedDelivery: ConfirmedWindow
): string {
  return (
    `Hi ${customerName}, this is Mars Laundromat.\n\n` +
    `We need to adjust the schedule you requested. Would the following work for you?\n\n` +
    `Pickup: ${formatMessageDate(proposedPickup.date)}, ${windowLabel(proposedPickup.time)}\n` +
    `Delivery: ${formatMessageDate(proposedDelivery.date)}, ${windowLabel(proposedDelivery.time)}` +
    `\n\nPlease reply to confirm, or let us know what time would work better.`
  );
}

/** SMS deep link for the assisted proposed-schedule text — see buildProposedScheduleMessage(). */
export function bookingProposedScheduleTextHref(
  phone: string,
  customerName: string,
  proposedPickup: ConfirmedWindow,
  proposedDelivery: ConfirmedWindow
): string {
  return bookingSmsHref(phone, buildProposedScheduleMessage(customerName, proposedPickup, proposedDelivery));
}

/**
 * The post-pickup, delivery-only reschedule message — pickup is already
 * historical by this point (see Correction 3: pickup is locked once a
 * booking is Picked Up or Ready for Delivery), so only the proposed
 * delivery time is mentioned. Deliberately takes the proposed delivery
 * window as a plain argument rather than reading it from the database: the
 * whole point of this message is to ask the customer BEFORE the new
 * delivery time is saved anywhere, so nothing here can come from a
 * "confirmed" column — see saveProposedDeliveryTime() in
 * bookings/[id]/actions.ts, which only writes the new delivery time after
 * the customer has actually agreed.
 *
 * Carries the same availability/handoff reminder as
 * buildPickupConfirmationMessage() (adapted to "receive," since there's no
 * pickup/hand-off leg in a pure delivery reschedule) — otherwise a
 * rescheduled delivery would never see that reminder again after the
 * original one, tied to the now-superseded original window, already went
 * out once at pickup confirmation.
 */
export function buildProposedDeliveryMessage(customerName: string, proposedDelivery: ConfirmedWindow): string {
  return (
    `Hi ${customerName}, this is Mars Laundromat.\n\n` +
    `We need to adjust your delivery schedule. Would the following time work for you?\n\n` +
    `Delivery: ${formatMessageDate(proposedDelivery.date)}, ${windowLabel(proposedDelivery.time)}` +
    `\n\nPlease make sure someone or a doorman will be AVAILABLE to receive your laundry during ` +
    `that window. We're not able to leave items unattended unless we've specifically agreed on it.` +
    `\n\nPlease reply to confirm, or let us know what time would work better.`
  );
}

/** SMS deep link for the assisted proposed-delivery text — see buildProposedDeliveryMessage(). */
export function bookingProposedDeliveryTextHref(
  phone: string,
  customerName: string,
  proposedDelivery: ConfirmedWindow
): string {
  return bookingSmsHref(phone, buildProposedDeliveryMessage(customerName, proposedDelivery));
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
