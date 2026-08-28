/**
 * Zelle recipient details (phone/email) for the assisted quote-text message
 * (buildQuoteTextMessage in src/lib/booking-links.ts). The owner doesn't
 * have a Zelle-ready number or account yet — leave this null until they do.
 * Once set, the generated message appends it automatically; nothing else
 * about the message-building code needs to change.
 */
export const ZELLE_RECIPIENT_DETAIL: string | null = null;
