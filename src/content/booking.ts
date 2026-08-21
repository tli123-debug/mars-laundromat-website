import { siteConfig } from "@/content/site-config";
import {
  BASE_CHARGE_CENTS,
  MINIMUM_BILLABLE_WEIGHT_LB,
  PER_POUND_OVER_MINIMUM_CENTS,
  SAME_DAY_FEE_CENTS,
} from "@/lib/pricing/calculate-quote";

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export const booking = {
  pricing: {
    heading: "How pricing works",
    items: [
      `${dollars(BASE_CHARGE_CENTS)} minimum, covering the first ${MINIMUM_BILLABLE_WEIGHT_LB} lb`,
      `${dollars(PER_POUND_OVER_MINIMUM_CENTS)} for every billable pound over ${MINIMUM_BILLABLE_WEIGHT_LB}`,
      "Actual weight rounds to the nearest pound — half-pounds round up",
      `Approved Same-Day Rush adds ${dollars(SAME_DAY_FEE_CENTS)}`,
      "Comforters, blankets, rugs/floor mats, and pillows may carry a surcharge",
      "Laundry is weighed at the store — we'll text you the exact quote and payment options afterward",
      "This is a request, not an automatically confirmed appointment",
    ],
  },

  sameDay: {
    disclosure:
      "Same-Day Rush is available when your pickup window ends by 12:00 PM (the latest eligible window is 11:00 AM–12:00 PM). Delivery will be that same evening, between 6:00–7:00 PM. The $5 same-day fee only applies once our team approves your request.",
    ineligibleToday:
      "Same-Day Rush isn't available for today's pickup anymore — the latest eligible window has passed. Choose a different pickup date, or Standard/Flexible speed.",
  },

  consent: {
    checkboxLabel:
      "By checking this box, you agree to receive non-marketing text messages from Mars Laundromat about this booking, including confirmation, scheduling, quote, payment, and delivery updates. Message frequency varies. Message and data rates may apply. Reply STOP to opt out. If you opt out while an order is active, we may call you about it.",
    callInstead: `Don't want text updates? Call us at ${siteConfig.phoneNumber} and we'll help you book by phone instead.`,
  },
} as const;
