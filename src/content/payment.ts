/**
 * Zelle and Venmo recipient details for the assisted quote-text message
 * (buildQuoteTextMessage in src/lib/booking-links.ts). Either can be left
 * null if that method isn't ready to receive payments yet — the generated
 * message adjusts automatically (which methods it lists as accepted, and
 * which detail line(s) it includes) with no other code change needed.
 */
export const ZELLE_RECIPIENT_DETAIL: string | null = "917-881-2623";

/** Venmo handle, without the leading "@" — buildQuoteTextMessage() adds it. */
export const VENMO_RECIPIENT_DETAIL: string | null = "Yong-Li-234";
