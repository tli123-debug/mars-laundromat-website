import { siteConfig } from "@/content/site-config";
import {
  MINIMUM_BILLABLE_WEIGHT_LB,
  MINIMUM_ORDER_CENTS,
  PRICE_PER_POUND_CENTS,
  SAME_DAY_FEE_CENTS,
} from "@/lib/pricing/calculate-quote";
import { DRY_CLEANING_MINIMUM_CENTS } from "@/lib/pricing/dry-cleaning-charge";

// Whole-dollar amounts ($30, $10) display with no decimals; anything with
// actual cents ($1.50) keeps them — toFixed(0) alone would round 150 cents
// to "$2" instead of showing "$1.50".
function dollars(cents: number): string {
  const value = cents / 100;
  return value % 1 === 0 ? `$${value.toFixed(0)}` : `$${value.toFixed(2)}`;
}

export const booking = {
  pricing: {
    heading: "How pricing works",
    items: [
      `${dollars(PRICE_PER_POUND_CENTS)} per billed pound, ${dollars(MINIMUM_ORDER_CENTS)} minimum charge`,
      `Orders under ${MINIMUM_BILLABLE_WEIGHT_LB} lb are charged the ${dollars(MINIMUM_ORDER_CENTS)} minimum`,
      "The scale weight rounds to the nearest whole pound — exactly half a pound rounds upward",
      "Pickup & delivery are free for approved addresses in our service area",
      `Approved Same-Day Rush adds ${dollars(SAME_DAY_FEE_CENTS)}`,
      "Comforters, blankets, pillows, rugs/floor mats, and other specialty or oversized items may carry a separately disclosed surcharge",
      "Laundry is weighed at the store — we'll text you the exact quote and payment options afterward",
      "This is a request, not an automatically confirmed appointment",
    ],
  },

  sameDay: {
    disclosure: `Same-Day Rush is available when your pickup window ends by 12:00 PM (the latest eligible window is 11:00 AM–12:00 PM). Delivery will be that same evening, between 6:00–7:00 PM. The ${dollars(SAME_DAY_FEE_CENTS)} same-day fee only applies once our team approves your request.`,
    ineligibleToday:
      "Same-Day Rush isn't available for today's pickup anymore — the latest eligible window has passed. Choose a different pickup date, or Standard/Flexible speed.",
  },

  // Shown for Standard/Flexible only — Same-Day has its own fixed evening
  // delivery (see sameDay.disclosure above) and is exempt from this gap.
  deliveryGap: {
    notice:
      "Delivery windows open at least 22 hours after your pickup window ends — a scheduling buffer, not an exact processing-time guarantee.",
  },

  consent: {
    checkboxLabel:
      "By checking this box, you agree to receive non-marketing text messages from Mars Laundromat about this booking, including confirmation, scheduling, quote, payment, and delivery updates. Message frequency varies. Message and data rates may apply. Reply STOP to opt out. If you opt out while an order is active, we may call you about it.",
    callInstead: `Don't want text updates? Call us at ${siteConfig.phoneNumber} and we'll help you book by phone instead.`,
  },

  dryCleaning: {
    deliveryNotice:
      "Choose a delivery window for the fourth calendar day after pickup. Your order may be ready on the third day; if it is, we'll text you to arrange an earlier delivery.",
    // Shown when Dry Cleaning is the only service selected.
    onlyItems: [
      `${dollars(DRY_CLEANING_MINIMUM_CENTS)} minimum for Dry Cleaning-only orders`,
      "Starting prices are confirmed after we count and inspect your garments",
    ],
    // Shown when Dry Cleaning is combined with Wash & Fold.
    bothItems: [
      `Wash & Fold keeps its own ${dollars(MINIMUM_ORDER_CENTS)} minimum`,
      "There's no separate Dry Cleaning minimum when it's combined with Wash & Fold",
      "Starting prices are confirmed after we count and inspect your garments",
      "Everything is returned together once the dry cleaning is ready",
    ],
    itemDescriptionLabel: "What dry-cleaning items are you sending? (optional)",
    itemDescriptionPlaceholder: "2 suits, 3 shirts, 1 dress",
    bothBagReminder:
      'Pack Wash & Fold and Dry Cleaning items in two separate bags. Clearly label each bag "Wash & Fold" or "Dry Cleaning" before pickup.',
  },
} as const;
