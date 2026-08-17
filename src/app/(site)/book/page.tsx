import type { Metadata } from "next";
import { BookingForm } from "@/components/booking/booking-form";

export const metadata: Metadata = {
  title: "Book Now",
  description: "Schedule a wash & fold pickup and delivery in Park Slope, Brooklyn.",
};

export default function BookPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">
        Book Now
      </p>
      <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">
        Let&apos;s get your laundry handled.
      </h1>
      <p className="mt-5 text-lg text-muted-foreground">
        Tell us a bit about your pickup, and we&apos;ll confirm your appointment by
        phone or WhatsApp shortly after.
      </p>

      <div className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <BookingForm />
      </div>
    </section>
  );
}
