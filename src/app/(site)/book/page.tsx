import type { Metadata } from "next";
import { BookingForm } from "@/components/booking/booking-form";
import { normalizeAcquisitionSource } from "@/lib/acquisition-source";

export const metadata: Metadata = {
  title: "Book Now",
  description: "Schedule a wash & fold pickup and delivery in Park Slope, Brooklyn.",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BookPage(props: PageProps<"/book">) {
  const searchParams = await props.searchParams;
  // Recognized here means "one of the permitted AcquisitionSource values" —
  // the same check the public form's own optional field and the admin
  // correction control use, not just the illustrative campaign-link
  // examples in the product spec. Anything else (missing, empty, a typo, a
  // hand-edited URL) silently resolves to null: an invalid tracked source
  // must never block the page or the booking, just fall back to asking the
  // customer directly via the form's own optional question.
  const trackedAcquisitionSource = normalizeAcquisitionSource(first(searchParams.source));

  return (
    <section className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">
        Book Now
      </p>
      <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">
        Let&apos;s get your laundry handled.
      </h1>
      <p className="mt-5 text-lg text-muted-foreground">
        Tell us a bit about your pickup, and we&apos;ll text you shortly to confirm
        or adjust your requested windows.
      </p>

      <div className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <BookingForm trackedAcquisitionSource={trackedAcquisitionSource} />
      </div>
    </section>
  );
}
