type PlaceholderImage = {
  src: string;
  alt: string;
};

/**
 * Labeled placeholder box (placehold.co) so it's obvious in the browser which
 * photo still needs to be replaced. Swap the `src` for a real photo path
 * under /public/images once available — the `alt` text is already real copy.
 */
function placeholder(width: number, height: number, label: string): string {
  // Trailing /png matters: placehold.co defaults to SVG, which Next.js's image
  // optimizer blocks by default (dangerouslyAllowSVG) for XSS-sanitization reasons.
  return `https://placehold.co/${width}x${height}/ede7de/2b2622/png?text=${encodeURIComponent(label)}`;
}

export const images = {
  heroHome: {
    src: placeholder(1600, 900, "Mars Laundromat — Storefront"),
    alt: "The storefront of Mars Laundromat on a sunny Park Slope street",
  },
  gardenExterior: {
    src: placeholder(1200, 900, "The Garden Out Front"),
    alt: "The garden maintained outside Mars Laundromat, tended by a family friend",
  },
  familyOwners: {
    src: placeholder(1200, 900, "The Family Behind the Counter"),
    alt: "The family who owns and runs Mars Laundromat",
  },
  washAndFold: {
    src: placeholder(1200, 900, "Wash & Fold"),
    alt: "Freshly washed and folded laundry, ready for pickup",
  },
  pickupDelivery: {
    src: placeholder(1200, 900, "Pickup & Delivery"),
    alt: "A Mars Laundromat delivery bag on a Park Slope stoop",
  },
  interior: {
    src: placeholder(1200, 900, "Inside Mars Laundromat"),
    alt: "Rows of washers and dryers inside Mars Laundromat",
  },
} satisfies Record<string, PlaceholderImage>;
