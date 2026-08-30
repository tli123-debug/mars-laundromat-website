import {
  MINIMUM_BILLABLE_WEIGHT_LB,
  MINIMUM_ORDER_CENTS,
  PRICE_PER_POUND_CENTS,
  SAME_DAY_FEE_CENTS,
} from "@/lib/pricing/calculate-quote";
import { formatDollars } from "@/lib/format-currency";

export const washAndFold = {
  hero: {
    eyebrow: "Wash & Fold",
    headline: "Pickup & delivery wash & fold, priced simply.",
    subheadline:
      "We wash, dry, and fold your everyday laundry, then bring it back to your door. Here's exactly how the pricing and process work.",
  },

  priceCallout: {
    price: `${formatDollars(PRICE_PER_POUND_CENTS)} / lb`,
    minimum: `${formatDollars(MINIMUM_ORDER_CENTS)} minimum order`,
  },

  howPricingWorks: {
    heading: "How pricing works",
    items: [
      `${formatDollars(PRICE_PER_POUND_CENTS)} per billed pound`,
      `${formatDollars(MINIMUM_ORDER_CENTS)} minimum charge: orders under ${MINIMUM_BILLABLE_WEIGHT_LB} lb are billed at the minimum`,
      "Weight is billed to the nearest whole pound",
      "Pickup & delivery are free for approved addresses in our service area",
      "Cash and Zelle are both accepted, at the same price",
      "Your final quote is sent by text after your laundry reaches the store and is weighed",
    ],
  },

  speeds: {
    heading: "Choose your speed",
    items: [
      {
        title: "Standard",
        description: "Normally returned the next day.",
      },
      {
        title: "Flexible",
        description: "Delivered within 24–48 hours, whichever window works best for you.",
      },
      {
        title: "Same-Day Rush",
        description: `Adds ${formatDollars(SAME_DAY_FEE_CENTS)}. Requires pickup by 12:00 PM and is subject to approval. Normally delivered that evening, between 6:00–7:00 PM.`,
      },
    ],
  },

  specialItems: {
    heading: "Specialty & oversized items",
    body: "Comforters, blankets, rugs/floor mats, and pillows may carry a surcharge depending on their size and condition. We'll always let you know before it's added to your total.",
  },
} as const;
