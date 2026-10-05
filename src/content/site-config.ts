export const siteConfig = {
  name: "Mars Laundromat",
  tagline: "Wash & fold, dry cleaning, pickup & delivery across nearby Brooklyn",
  description:
    "A family-owned Park Slope laundromat offering wash & fold, dry cleaning, and free pickup & delivery across Park Slope and nearby Brooklyn neighborhoods.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  phoneNumber: "+1 (929) 870-1166",

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
    shortLabel: "Park Slope and nearby Brooklyn neighborhoods",
    neighborhoods: [
      "Park Slope",
      "South Slope",
      "Gowanus",
      "Greenwood Heights",
      "Windsor Terrace",
      "Carroll Gardens",
      "Cobble Hill",
      "Boerum Hill",
      "Prospect Heights",
    ],
    mapAnchor: "Brooklyn, NY",
  },
} as const;

export function coverageAreaList(): string {
  return siteConfig.coverageArea.neighborhoods.join(", ");
}

export function phoneHref(): string {
  return `tel:${siteConfig.phoneNumber.replace(/\D/g, "")}`;
}

export function fullAddress(): string {
  const { line1, city, state, zip } = siteConfig.address;
  return `${line1}, ${city}, ${state} ${zip}`;
}
