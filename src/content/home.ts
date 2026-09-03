import {
  MINIMUM_ORDER_CENTS,
  PRICE_PER_POUND_CENTS,
} from "@/lib/pricing/calculate-quote";
import { DRY_CLEANING_MINIMUM_CENTS } from "@/lib/pricing/dry-cleaning-charge";
import { formatDollars } from "@/lib/format-currency";

// Deliberately not a single "from $X" figure — the cheapest chart entry
// (Laundry Shirt, $3) is washed/dried/ironed, not dry-cleaned, so leading
// with it would misstate what a Dry Cleaning order actually starts at.
const dryCleaningMinimumNote = `${formatDollars(DRY_CLEANING_MINIMUM_CENTS)} minimum for Dry Cleaning-only orders`;

export const home = {
  hero: {
    eyebrow: "Park Slope, Brooklyn",
    headline: "Your laundry, cared for like family.",
    subheadline:
      "Wash & fold and dry cleaning, with free pickup & delivery across Park Slope. Family-owned, community-rooted, and never run by an app.",
    primaryCta: { label: "Book a Pickup", href: "/book" },
    secondaryCta: { label: "Call us", href: "tel" },
  },

  services: {
    heading: "One pickup, however you need it",
    body: "Book Wash & Fold, Dry Cleaning & Ironing, or both together since everything comes back on the same trip.",
    items: [
      {
        title: "Wash & Fold",
        description: "Washed, dried, and folded, priced by the pound.",
        priceHint: `${formatDollars(PRICE_PER_POUND_CENTS)}/lb, ${formatDollars(MINIMUM_ORDER_CENTS)} minimum`,
        href: "/services/wash-and-fold",
        icon: "/images/wash-and-fold-icon.svg",
      },
      {
        title: "Dry Cleaning & Ironing",
        description: "Counted, inspected, and quoted before it ever leaves our hands.",
        priceHint: `Starting garment prices listed online – ${dryCleaningMinimumNote}`,
        href: "/services/dry-cleaning",
        icon: "/images/dry-cleaning-icon.svg",
      },
    ],
  },

  howItWorks: {
    heading: "How it works",
    steps: [
      {
        title: "Book online",
        description: "Tell us what you need and choose a preferred pickup window. It takes about a minute.",
      },
      {
        title: "We confirm",
        description: "A real person on our team confirms your pickup time by text or phone.",
      },
      {
        title: "We pick up",
        description: "We collect your laundry, dry cleaning, or both, right from your door.",
      },
      {
        title: "We deliver it back",
        description: "Clean, folded, and pressed, dropped off on the schedule we agreed on.",
      },
    ],
  },

  pricingPreview: [
    `${formatDollars(PRICE_PER_POUND_CENTS)}/lb Wash & Fold, ${formatDollars(MINIMUM_ORDER_CENTS)} minimum`,
    `Dry Cleaning: starting garment prices listed online, ${dryCleaningMinimumNote}`,
    "Next-day standard, or 3–4 days for dry cleaning",
    "Free pickup & delivery in our service area",
  ],

  intro: {
    heading: "A neighborhood laundromat, run by Park Slope locals.",
    body: "Mars Laundromat has been serving Park Slope for many years, the kind of place where the person answering the phone actually knows your order, your building, and probably your dog's name. We built our pickup & delivery service to bring that same personal care to your door, without losing the parts that make a local laundromat worth walking to in the first place.",
    cta: { label: "Our story", href: "/about" },
  },

  valueProps: [
    {
      title: "Family-owned, not by an app",
      description:
        "No call center, no gig workforce. Every bag is handled by people who live in this neighborhood and take pride in the work.",
    },
    {
      title: "Free pickup & delivery",
      description:
        "Covering 4th to 8th Ave, 1st to 20th St, right in the heart of Park Slope. Schedule a window that works for you.",
    },
    {
      title: "Careful, consistent wash & fold",
      description:
        "Your items are washed, dried, and folded to your preferences every single time, all types of special instructions are welcome.",
    },
    {
      title: "A real place you can walk into",
      description:
        "Stop by, meet us, see the garden out front, and sit on our benches on a nice sunny day.",
    },
  ],

  ctaBand: {
    heading: "Ready to get your time back?",
    body: "Book a pickup in a couple of minutes, or give us a call if you'd rather just talk to a person.",
    primaryCta: { label: "Book Now", href: "/book" },
  },
} as const;
