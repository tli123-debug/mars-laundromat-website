import {
  MINIMUM_BILLABLE_WEIGHT_LB,
  MINIMUM_ORDER_CENTS,
  PRICE_PER_POUND_CENTS,
  SAME_DAY_FEE_CENTS,
} from "@/lib/pricing/calculate-quote";

// Whole-dollar amounts ($30, $10) display with no decimals; anything with
// actual cents ($1.50) keeps them — toFixed(0) alone would round 150 cents
// to "$2" instead of showing "$1.50".
function dollars(cents: number): string {
  const value = cents / 100;
  return value % 1 === 0 ? `$${value.toFixed(0)}` : `$${value.toFixed(2)}`;
}

export const services = {
  hero: {
    eyebrow: "Services",
    headline: "Wash & fold, and pickup & delivery — done right.",
    subheadline:
      "Two ways to work with us: drop off in person, or let us come to you. Either way, your laundry gets the same careful attention.",
  },

  offerings: [
    {
      title: "Wash & Fold Drop-Off",
      description:
        "Bring your laundry by the store any time we're open. We wash, dry, and fold it to your preferences, and it's ready for pickup within a couple of days.",
      details: [
        "Standard turnaround: 24–48 hours",
        "Separated wash on request (darks, lights, delicates)",
        "Folded and bagged, ready to put away",
      ],
    },
    {
      title: "Pickup & Delivery",
      description:
        "Schedule a pickup window, leave your bag out (or hand it to us directly), and we'll bring it back clean, folded, and on time.",
      details: [
        "Free pickup & delivery within our coverage area",
        "Choose a morning, afternoon, or evening window",
        "Same wash & fold care as our in-store service",
      ],
    },
  ],

  howItWorks: {
    heading: "How pickup & delivery works",
    steps: [
      {
        title: "Book online",
        description: "Tell us your address and a preferred pickup window — takes about a minute.",
      },
      {
        title: "We confirm",
        description: "A real person on our team confirms your pickup time by phone.",
      },
      {
        title: "We pick up & wash",
        description: "We collect your laundry and take care of it back at the shop.",
      },
      {
        title: "We deliver it back",
        description: "Clean, folded, and dropped off at your door on the schedule we agreed on.",
      },
    ],
  },

  coverage: {
    heading: "Where we deliver",
    body: "Our free pickup & delivery service currently covers the heart of Park Slope — from 4th Avenue to 8th Avenue, and 1st Street to 20th Street. Not sure if you're in range? Give us a call and we'll let you know.",
  },

  pricing: {
    heading: "Pricing",
    body: `Pickup & delivery is priced by the pound. We weigh your laundry at the store and text your exact quote and payment options afterward — pickup & delivery is free for approved addresses within our service area. Approved Same-Day Rush adds ${dollars(SAME_DAY_FEE_CENTS)}, and oversized or specialty items may carry an additional quoted surcharge based on size, condition, and handling.`,
    fromPrice: `${dollars(PRICE_PER_POUND_CENTS)} / lb`,
    minimum: `${dollars(MINIMUM_ORDER_CENTS)} minimum — orders under ${MINIMUM_BILLABLE_WEIGHT_LB} lb are billed at the minimum`,
  },
} as const;
