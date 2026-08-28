export const commercial = {
  hero: {
    eyebrow: "Commercial Laundry",
    headline: "Laundry service for your business.",
    subheadline:
      "Run a business nearby and need a laundry partner? We'd love to talk through what you need and put together an arrangement that works for you.",
  },

  body: {
    heading: "Let's talk about what you need",
    paragraphs: [
      "Every business has different laundry needs — volume, schedule, and turnaround all vary. Rather than a one-size-fits-all plan, we'd rather have a conversation first, so we can figure out what actually fits how your business runs.",
      "Give us a call or stop by the store, and we'll go from there.",
    ],
  },

  // "We can work with" — deliberately not "we work with" or "our clients
  // include." No partnerships are confirmed yet; this section is an
  // invitation to talk, not a client list or a service guarantee. Every
  // example below is an ordinary washable textile — nothing here implies
  // medical/healthcare laundry, sanitized protocols, hypoallergenic
  // processing, a guaranteed turnaround, confirmed capacity, or pricing.
  businessTypes: {
    heading: "Businesses we can work with",
    intro:
      "We can work with a range of local businesses on their everyday washable textiles — here are a few examples of who we'd love to talk to.",
    categories: [
      { name: "Hotels and hospitality", examples: "Sheets, towels, pillowcases" },
      { name: "Spas, salons and barbers", examples: "Towels, robes, capes" },
      { name: "Fitness and wellness studios", examples: "Studio towels, staff shirts, yoga towels" },
      { name: "Restaurants and cafés", examples: "Aprons, kitchen towels, tablecloths" },
      { name: "Uniforms and workwear", examples: "Staff uniforms, polos, work shirts" },
      { name: "Schools and community organizations", examples: "Team jerseys, staff polos, event linens" },
    ],
  },

  cta: {
    heading: "Get in touch",
    body: "Call us to start the conversation, or reach out through our contact page.",
  },
} as const;
