declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Google Ads conversion tracking, switched on by two environment variables
 * and completely inert without them (no script is loaded, no event is
 * sent), the same "safe to leave unset" pattern as the calendar sync:
 *
 *   NEXT_PUBLIC_GOOGLE_ADS_ID             e.g. AW-123456789
 *   NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL  the label from Google Ads' event snippet
 *
 * Both are validated against strict patterns before use, because the ID is
 * interpolated into an inline script.
 */

const ADS_ID_PATTERN = /^AW-\d{6,15}$/;
const CONVERSION_LABEL_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

export function sanitizeGoogleAdsId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && ADS_ID_PATTERN.test(trimmed) ? trimmed : null;
}

export function sanitizeConversionLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && CONVERSION_LABEL_PATTERN.test(trimmed) ? trimmed : null;
}

// process.env.NEXT_PUBLIC_* must be written out literally for Next.js to
// inline it into the browser bundle, so these can't take an env object.
export function getGoogleAdsId(): string | null {
  return sanitizeGoogleAdsId(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID);
}

/** "AW-123456789/AbCdEfGh", the value Google's event snippet calls send_to. */
export function getBookingConversionSendTo(): string | null {
  const id = getGoogleAdsId();
  const label = sanitizeConversionLabel(process.env.NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL);
  return id && label ? `${id}/${label}` : null;
}

export function buildBookingConversionEvent(sendTo: string, bookingId: string) {
  // transaction_id is what lets Google ignore a duplicate report of the same booking.
  return { send_to: sendTo, transaction_id: bookingId };
}

/**
 * Tells Google a booking was successfully created. Call this only after the
 * server has confirmed success, never on page load or button press. Returns
 * whether an event was actually sent; every failure mode (not configured,
 * tag blocked, no booking ID) is a quiet false, never an exception, so
 * tracking can never get in the way of a booking.
 */
export function trackBookingConversion(
  bookingId: string,
  options: { sendTo?: string | null; gtag?: Window["gtag"] } = {}
): boolean {
  const sendTo = options.sendTo !== undefined ? options.sendTo : getBookingConversionSendTo();
  const gtag = options.gtag ?? (typeof window !== "undefined" ? window.gtag : undefined);
  if (!sendTo || !bookingId || typeof gtag !== "function") return false;
  try {
    gtag("event", "conversion", buildBookingConversionEvent(sendTo, bookingId));
    return true;
  } catch {
    return false;
  }
}
