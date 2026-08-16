export const home = {
  hero: {
    eyebrow: "Park Slope, Brooklyn",
    headline: "Your laundry, cared for like family.",
    subheadline:
      "Wash & fold drop-off, plus free pickup & delivery across Park Slope. Family-owned, community-rooted, and never run by an app.",
    primaryCta: { label: "Book a Pickup", href: "/book" },
    secondaryCta: { label: "Message us on WhatsApp", href: "whatsapp" },
  },

  intro: {
    heading: "A neighborhood laundromat, run by an actual neighborhood family.",
    body: "Mars Laundromat has been part of Park Slope's daily rhythm for years — the kind of place where the person answering the phone actually knows your order, your building, and probably your dog's name. We built our pickup & delivery service to bring that same personal care to your door, without losing the parts that make a local laundromat worth walking to in the first place.",
    cta: { label: "Our story", href: "/about" },
  },

  valueProps: [
    {
      title: "Run by a family, not an app",
      description:
        "No call center, no gig workforce. Every bag is handled by people who live in this neighborhood and take pride in the work.",
    },
    {
      title: "Free pickup & delivery",
      description:
        "Covering 4th to 8th Ave, 1st to 20th St — right in the heart of Park Slope. Schedule a window that works for you.",
    },
    {
      title: "Careful, consistent wash & fold",
      description:
        "Your items are washed, dried, and folded to your preferences — every single time, not just when you're watching.",
    },
    {
      title: "A real place you can walk into",
      description:
        "We're not a warehouse on the edge of town. Stop by, meet us, see the garden out front — we like it that way.",
    },
  ],

  ctaBand: {
    heading: "Ready to get your time back?",
    body: "Book a pickup in a couple of minutes, or message us on WhatsApp if you'd rather just talk to a person.",
    primaryCta: { label: "Book Now", href: "/book" },
  },
} as const;
