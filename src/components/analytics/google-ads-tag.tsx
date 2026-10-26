import Script from "next/script";
import { getGoogleAdsId } from "@/lib/google-ads";

/**
 * Loads Google's tag so it can recognize visitors who arrived from a Google
 * ad. Renders nothing at all unless NEXT_PUBLIC_GOOGLE_ADS_ID is set to a
 * valid AW- ID. Counting a conversion is a separate step that only happens
 * after a booking succeeds (see trackBookingConversion).
 */
export function GoogleAdsTag() {
  const adsId = getGoogleAdsId();
  if (!adsId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${adsId}`} strategy="afterInteractive" />
      {/* adsId is validated against /^AW-\d+$/ above, so it is safe to inline. */}
      <Script id="google-ads-tag" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${adsId}');`}
      </Script>
    </>
  );
}
