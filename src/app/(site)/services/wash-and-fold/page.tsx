import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { washAndFold } from "@/content/wash-and-fold";
import { images } from "@/content/images";

export const metadata: Metadata = {
  title: "Wash & Fold",
  description:
    "Pickup & delivery wash & fold in Park Slope, Brooklyn — $1.50/lb, $30 minimum, free pickup & delivery.",
};

export default function WashAndFoldPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-6 pb-4 pt-16 text-center sm:pt-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          {washAndFold.hero.eyebrow}
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">
          {washAndFold.hero.headline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          {washAndFold.hero.subheadline}
        </p>
        <div className="mx-auto mt-8 flex max-w-xs items-center justify-center gap-4 rounded-2xl bg-muted p-6">
          <div>
            <p className="font-display text-3xl font-semibold text-primary">
              {washAndFold.priceCallout.price}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{washAndFold.priceCallout.minimum}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image
              src={images.washAndFold.src}
              alt={images.washAndFold.alt}
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold">{washAndFold.howPricingWorks.heading}</h2>
            <ul className="mt-5 space-y-3">
              {washAndFold.howPricingWorks.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-muted py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl font-semibold">{washAndFold.speeds.heading}</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {washAndFold.speeds.items.map((speed) => (
              <div key={speed.title} className="rounded-2xl bg-background p-6">
                <h3 className="font-display text-lg font-semibold">{speed.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {speed.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="font-display text-2xl font-semibold">{washAndFold.specialItems.heading}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {washAndFold.specialItems.body}
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
