/**
 * Whole-dollar amounts ($30, $10) display with no decimals; anything with
 * actual cents ($1.50) keeps them — toFixed(0) alone would round 150 cents
 * to "$2" instead of showing "$1.50". Shared formatter for the dedicated
 * service pages (Checkpoint 4) — src/content/booking.ts keeps its own
 * pre-existing copy of this logic rather than being refactored to import
 * it, since that file is completed Checkpoint 2 work.
 */
export function formatDollars(cents: number): string {
  const value = cents / 100;
  return value % 1 === 0 ? `$${value.toFixed(0)}` : `$${value.toFixed(2)}`;
}
