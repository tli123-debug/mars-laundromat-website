export interface DryCleaningPriceItem {
  item: string;
  priceCents: number;
}

/**
 * Owner-approved starting retail prices, display only — never imported by
 * the quote-calculation engine (src/lib/pricing/dry-cleaning-charge.ts).
 * Staff always enter the actual inspected garment subtotal by hand in the
 * admin portal; this chart only sets customer expectations up front.
 */
export const dryCleaningPrices: DryCleaningPriceItem[] = [
  { item: "Laundry Shirt", priceCents: 400 },
  { item: "Pants", priceCents: 600 },
  { item: "Two-Piece Suit", priceCents: 1400 },
  { item: "Dress", priceCents: 1400 },
  { item: "Jacket", priceCents: 700 },
  { item: "Skirt", priceCents: 500 },
  { item: "Blouse", priceCents: 700 },
  { item: "Sweater", priceCents: 700 },
  { item: "Coat", priceCents: 2200 },
  { item: "Long Coat", priceCents: 2800 },
  { item: "Tie", priceCents: 600 },
  { item: "Dry-Cleaned Shirt", priceCents: 700 },
];
