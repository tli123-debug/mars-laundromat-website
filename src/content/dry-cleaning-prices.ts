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
  { item: "Laundry Shirt", priceCents: 300 },
  { item: "Pants", priceCents: 500 },
  { item: "Two-Piece Suit", priceCents: 1000 },
  { item: "Dress", priceCents: 1000 },
  { item: "Jacket", priceCents: 500 },
  { item: "Skirt", priceCents: 500 },
  { item: "Blouse", priceCents: 500 },
  { item: "Sweater", priceCents: 500 },
  { item: "Coat", priceCents: 1500 },
  { item: "Long Coat", priceCents: 2000 },
  { item: "Tie", priceCents: 400 },
  { item: "Dry-Cleaned Shirt", priceCents: 500 },
];
