export const siteConfig = {
  name: "Mars Laundromat",
  tagline: "Wash & fold, pickup & delivery in Park Slope, Brooklyn",
  description:
    "A family-owned laundromat serving Park Slope, Brooklyn with wash & fold drop-off and pickup & delivery service.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  /** PLACEHOLDER — swap for the real business phone number. */
  phoneNumber: "+1 (718) 555-0199",

  /** PLACEHOLDER — swap for the real street address before launch. */
  address: {
    line1: "450 6th Ave",
    neighborhood: "Park Slope",
    city: "Brooklyn",
    state: "NY",
    zip: "11215",
  },

  hours: [
    { days: "Monday – Friday", time: "8:00 AM – 7:00 PM" },
    { days: "Saturday – Sunday", time: "8:30 AM – 7:00 PM" },
  ],

  coverageArea: {
    avenues: "4th Ave to 8th Ave",
    streets: "1st St to 20th St",
    label: "Park Slope, Brooklyn",
  },
} as const;

export function phoneHref(): string {
  return `tel:${siteConfig.phoneNumber.replace(/\D/g, "")}`;
}

export function fullAddress(): string {
  const { line1, city, state, zip } = siteConfig.address;
  return `${line1}, ${city}, ${state} ${zip}`;
}
