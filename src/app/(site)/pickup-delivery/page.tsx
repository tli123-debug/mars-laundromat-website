import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { images } from "@/content/images";
import { pickupDelivery } from "@/content/pickup-delivery";
import { phoneHref, siteConfig } from "@/content/site-config";

export const metadata: Metadata = {
  title: "Laundry Pickup & Delivery in Park Slope, Brooklyn",
  description:
    "Free laundry pickup and delivery in Park Slope and nearby Brooklyn. Wash & Fold is $1.50/lb with a $30 minimum, from a local family-run laundromat.",
  alternates: {
    canonical: "/pickup-delivery",
  },
  openGraph: {
    title: "Laundry Pickup & Delivery in Park Slope, Brooklyn",
    description:
      "Schedule free pickup and delivery for Wash & Fold or Dry Cleaning & Ironing from Mars Laundromat in Park Slope.",
    url: "/pickup-delivery",
  },
};

export default function PickupDeliveryPage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            {pickupDelivery.hero.eyebrow}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            {pickupDelivery.hero.heading}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {pickupDelivery.hero.body}
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/book"
              className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Book a Free Pickup
            </Link>
            <a
              href={phoneHref()}
              className="inline-flex items-center rounded-full border border-border px-6 py-3 text-base font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Call or Text {siteConfig.phoneNumber}
            </a>
          </div>
        </div>

        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl">
          <Image
            src={images.washAndFold.src}
            alt={images.washAndFold.alt}
            fill
            priority
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/90 to-transparent px-6 pb-6 pt-24 text-white">
            <p className="font-display text-2xl font-semibold">Cleaned locally in Park Slope</p>
            <p className="mt-1 text-sm text-white/80">By the same family-run team you can visit at 450 6th Ave.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted">
        <dl className="mx-auto grid max-w-6xl gap-px px-6 py-10 sm:grid-cols-3 sm:py-0">
          {pickupDelivery.highlights.map((highlight) => (
            <div key={highlight.label} className="py-4 sm:px-8 sm:py-10 sm:first:pl-0 sm:last:pr-0">
              <dt className="text-sm leading-relaxed text-muted-foreground">{highlight.label}</dt>
              <dd className="mt-2 font-display text-3xl font-semibold text-primary">{highlight.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">How it works</p>
        <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold sm:text-4xl">
          Four simple steps, handled by real people.
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {pickupDelivery.steps.map((step) => (
            <div key={step.number} className="border-t border-border pt-6">
              <span className="font-display text-3xl font-semibold text-primary">{step.number}</span>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-foreground py-20 text-background">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">What we collect</p>
          <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="max-w-2xl font-display text-3xl font-semibold sm:text-4xl">
              One pickup for the laundry that fills your week.
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-background/65">
              Choose one service or combine them. We confirm the details before the pickup so you always know what to expect.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {pickupDelivery.services.map((service) => (
              <Link
                key={service.title}
                href={service.href}
                className="group rounded-2xl border border-background/15 p-6 transition-colors hover:bg-background/5"
              >
                <h3 className="font-display text-xl font-semibold">{service.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-background/70">{service.description}</p>
                <span className="mt-6 inline-flex text-sm font-semibold text-primary underline-offset-4 group-hover:underline">
                  Learn more →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Service area</p>
          <h2 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">
            {pickupDelivery.coverage.heading}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            {pickupDelivery.coverage.body}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {pickupDelivery.coverage.summary}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {siteConfig.coverageArea.neighborhoods.map((neighborhood) => (
            <div
              key={neighborhood}
              className="flex min-h-20 items-center justify-center rounded-2xl border border-border bg-card px-4 py-5 text-center text-sm font-semibold"
            >
              {neighborhood}
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted py-20">
        <div className="mx-auto max-w-3xl px-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Common questions</p>
          <h2 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">
            Before your first pickup
          </h2>
          <div className="mt-10 divide-y divide-border border-y border-border">
            {pickupDelivery.faq.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span aria-hidden="true" className="text-2xl font-normal text-primary transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-foreground/70">
            Ready when you are
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">
            Let us take laundry day off your list.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-primary-foreground/80">
            Request your pickup online. A real person from Mars will confirm the schedule with you shortly.
          </p>
          <Link
            href="/book"
            className="mt-8 inline-flex items-center rounded-full bg-background px-6 py-3 text-base font-semibold text-foreground transition-opacity hover:opacity-90"
          >
            Book a Free Pickup
          </Link>
        </div>
      </section>
    </>
  );
}
