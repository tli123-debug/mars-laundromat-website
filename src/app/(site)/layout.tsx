import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PhoneButton } from "@/components/layout/phone-button";
import { GoogleAdsTag } from "@/components/analytics/google-ads-tag";
import { AdAttributionCapture } from "@/components/analytics/ad-attribution-capture";

// Tracking lives here, not in the root layout, so the staff admin pages
// never load Google's tag.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <PhoneButton />
      <GoogleAdsTag />
      <AdAttributionCapture />
    </>
  );
}
