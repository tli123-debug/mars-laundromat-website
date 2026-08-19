export const home = {
  hero: {
    eyebrow: "Park Slope, Brooklyn",
    headline: "Your laundry, cared for like family.",
    subheadline:
      "Wash & fold drop-off, plus free pickup & delivery across Park Slope. Family-owned, community-rooted, and never run by an app.",
    primaryCta: { label: "Book a Pickup", href: "/book" },
    secondaryCta: { label: "Call us", href: "tel" },
  },

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
