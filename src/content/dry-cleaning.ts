import { MINIMUM_ORDER_CENTS } from "@/lib/pricing/calculate-quote";
import { DRY_CLEANING_MINIMUM_CENTS } from "@/lib/pricing/dry-cleaning-charge";
import { formatDollars } from "@/lib/format-currency";

export const dryCleaning = {
  hero: {
    eyebrow: "Dry Cleaning & Ironing",
    headline: "Professional dry cleaning, picked up and delivered.",
    subheadline:
      "Send us your dry cleaning alone, or combine it with a Wash & Fold pickup — either way, we count and inspect everything, and confirm your quote before it ever leaves our hands.",
  },

  howItWorks: {
    heading: "How it works",
    items: [
      "We count and inspect your garments after pickup",
      "We confirm your quote before anything is sent to the cleaner",
      "Ironing is included where appropriate — never a separate charge",
      "Typically ready in 3–4 calendar days — online bookings schedule delivery on day 4, and we'll text you to arrange an earlier delivery if it's ready on day 3",
    ],
  },

  pricing: {
    heading: "How pricing works",
    dryCleaningOnly: `${formatDollars(DRY_CLEANING_MINIMUM_CENTS)} minimum charge for Dry Cleaning-only pickup & delivery orders`,
    combined: `Combine Dry Cleaning with Wash & Fold and there's no separate Dry Cleaning minimum — your Wash & Fold items still keep their own ${formatDollars(MINIMUM_ORDER_CENTS)} minimum`,
    combinedReturn: "Combined orders are returned together, once your dry cleaning is ready",
  },

  bagReminder:
    "Please pack your dry-cleaning items in a separate bag from your Wash & Fold laundry when you book.",

  priceChart: {
    heading: "Starting prices",
    subheading: "These are our approved starting retail prices, per item.",
    laundryShirtNote: "Laundry Shirt pricing includes washing, drying, and ironing.",
    disclaimer:
      "These are starting prices, not final quotes. Your actual total depends on each garment's type, material, construction, and condition, and is always confirmed after we've counted and inspected everything — never before.",
  },
} as const;
