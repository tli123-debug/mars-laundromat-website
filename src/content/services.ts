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

  /** PLACEHOLDER — confirm real pricing before launch. */
  pricing: {
    heading: "Pricing",
    body: "Wash & fold is priced by the pound, with a simple minimum per order. Exact pricing is confirmed when we message you back — no surprise fees.",
    fromPrice: "From $2.25 / lb",
    minimum: "15 lb minimum for pickup & delivery orders",
  },
} as const;
