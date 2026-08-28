import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { dryCleaning } from "@/content/dry-cleaning";
import { dryCleaningPrices } from "@/content/dry-cleaning-prices";
import { images } from "@/content/images";
import { formatDollars } from "@/lib/format-currency";

export const metadata: Metadata = {
  title: "Dry Cleaning & Ironing",
  description:
    "Dry cleaning & ironing, picked up and delivered in Park Slope, Brooklyn. Counted, inspected, and quoted before it's sent to the cleaner.",
};

export default function DryCleaningPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-6 pb-4 pt-16 text-center sm:pt-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          {dryCleaning.hero.eyebrow}
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">
          {dryCleaning.hero.headline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          {dryCleaning.hero.subheadline}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
          <div className="md:order-2 relative aspect-[3/2] overflow-hidden rounded-2xl">
            <Image
              src={images.dryCleaning.src}
              alt={images.dryCleaning.alt}
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="md:order-1">
            <h2 className="font-display text-2xl font-semibold">{dryCleaning.howItWorks.heading}</h2>
            <ul className="mt-5 space-y-3">
              {dryCleaning.howItWorks.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-2xl bg-muted p-6">
          <p className="text-sm font-semibold">Separate bags, please</p>
          <p className="mt-1 text-sm text-muted-foreground">{dryCleaning.bagReminder}</p>
        </div>
      </section>

      <section className="bg-muted py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="font-display text-2xl font-semibold">{dryCleaning.pricing.heading}</h2>
          <ul className="mt-5 space-y-3">
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{dryCleaning.pricing.dryCleaningOnly}</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{dryCleaning.pricing.combined}</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{dryCleaning.pricing.combinedReturn}</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="font-display text-2xl font-semibold">{dryCleaning.priceChart.heading}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{dryCleaning.priceChart.subheading}</p>

        <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl bg-background ring-1 ring-border">
          {dryCleaningPrices.map((entry) => (
            <div key={entry.item} className="flex items-center justify-between gap-4 px-6 py-3.5">
              <span className="text-sm font-medium">{entry.item}</span>
              <span className="font-display text-base font-semibold text-primary">
                {formatDollars(entry.priceCents)}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">{dryCleaning.priceChart.laundryShirtNote}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {dryCleaning.priceChart.disclaimer}
        </p>
      </section>

      <section className="border-t border-border bg-foreground py-16 text-background">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-3xl font-semibold">Ready to book your first pickup?</h2>
          <div className="mt-8 flex justify-center">
            <Link
              href="/book"
              className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Book Now
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
