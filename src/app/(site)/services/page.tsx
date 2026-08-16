import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { services } from "@/content/services";
import { faq } from "@/content/faq";
import { images } from "@/content/images";
import { siteConfig } from "@/content/site-config";

export const metadata: Metadata = {
  title: "Services | Mars Laundromat",
  description:
    "Wash & fold drop-off and free pickup & delivery across Park Slope, Brooklyn.",
};

const offeringImages = [images.washAndFold, images.pickupDelivery];

export default function ServicesPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-6 pb-4 pt-16 text-center sm:pt-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">
          {services.hero.eyebrow}
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">
          {services.hero.headline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          {services.hero.subheadline}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2">
          {services.offerings.map((offering, i) => (
            <div key={offering.title} className="overflow-hidden rounded-2xl bg-muted">
              <div className="relative aspect-[4/3]">
                <Image
                  src={offeringImages[i].src}
                  alt={offeringImages[i].alt}
                  fill
                  sizes="(min-width: 640px) 45vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="p-7">
                <h2 className="font-display text-2xl font-semibold">
                  {offering.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {offering.description}
                </p>
                <ul className="mt-5 space-y-2">
                  {offering.details.map((detail) => (
                    <li key={detail} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-3xl font-semibold">
            {services.howItWorks.heading}
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {services.howItWorks.steps.map((step, i) => (
              <div key={step.title}>
                <span className="font-display text-3xl font-semibold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <h2 className="font-display text-2xl font-semibold">
              {services.coverage.heading}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {services.coverage.body}
            </p>
            <dl className="mt-6 space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="font-semibold">Avenues:</dt>
                <dd className="text-muted-foreground">{siteConfig.coverageArea.avenues}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">Streets:</dt>
                <dd className="text-muted-foreground">{siteConfig.coverageArea.streets}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold">
              {services.pricing.heading}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {services.pricing.body}
            </p>
            <div className="mt-6 rounded-2xl bg-muted p-6">
              <p className="font-display text-2xl font-semibold text-accent">
                {services.pricing.fromPrice}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {services.pricing.minimum}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-display text-3xl font-semibold">
            Frequently asked questions
          </h2>
          <div className="mt-8 divide-y divide-border rounded-2xl bg-background">
            {faq.map((item) => (
              <details key={item.question} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold">
                  {item.question}
                  <span className="shrink-0 text-accent transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-foreground py-16 text-background">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-3xl font-semibold">
            Ready to book your first pickup?
          </h2>
          <div className="mt-8 flex justify-center">
            <Link
              href="/book"
              className="inline-flex items-center rounded-full bg-accent px-6 py-3 text-base font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              Book Now
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
