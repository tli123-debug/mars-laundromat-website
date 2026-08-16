export const siteConfig = {
  name: "Mars Laundromat",
  tagline: "Wash & fold, pickup & delivery in Park Slope, Brooklyn",
  description:
    "A family-owned laundromat serving Park Slope, Brooklyn with wash & fold drop-off and pickup & delivery service.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  /** PLACEHOLDER — swap for the real business WhatsApp number before launch. */
  whatsappNumber: "+1 (555) 555-0123",

  /** PLACEHOLDER — swap for the real street address before launch. */
  address: {
    line1: "123 7th Avenue",
    neighborhood: "Park Slope",
    city: "Brooklyn",
    state: "NY",
    zip: "11215",
  },

  /** PLACEHOLDER — confirm real hours before launch. */
  hours: [
    { days: "Monday – Friday", time: "7:00 AM – 9:00 PM" },
    { days: "Saturday – Sunday", time: "8:00 AM – 8:00 PM" },
  ],

  coverageArea: {
    avenues: "4th Ave to 8th Ave",
    streets: "1st St to 20th St",
    label: "Park Slope, Brooklyn",
  },
} as const;

export function whatsappHref(message?: string): string {
  const digits = siteConfig.whatsappNumber.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function fullAddress(): string {
  const { line1, neighborhood, city, state, zip } = siteConfig.address;
  return `${line1}, ${neighborhood}, ${city}, ${state} ${zip}`;
}
