import type { Metadata } from "next";
import Link from "next/link";
import { commercial } from "@/content/commercial";
import { phoneHref, siteConfig } from "@/content/site-config";

export const metadata: Metadata = {
  title: "Commercial Laundry",
  description:
    "Mars Laundromat works with nearby businesses on a customized laundry arrangement. Get in touch to start the conversation.",
};

export default function CommercialPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-6 pb-4 pt-16 text-center sm:pt-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          {commercial.hero.eyebrow}
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">
          {commercial.hero.headline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          {commercial.hero.subheadline}
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="font-display text-2xl font-semibold">{commercial.body.heading}</h2>
        <div className="mx-auto mt-5 max-w-2xl space-y-4 text-base leading-relaxed text-muted-foreground">
          {commercial.body.paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </section>

      <section className="bg-muted py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="font-display text-3xl font-semibold">{commercial.businessTypes.heading}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
              {commercial.businessTypes.intro}
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {commercial.businessTypes.categories.map((category) => (
              <div key={category.name} className="rounded-2xl bg-background p-6">
                <h3 className="font-display text-lg font-semibold">{category.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{category.examples}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-foreground py-16 text-background">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-3xl font-semibold">{commercial.cta.heading}</h2>
          <p className="mt-4 text-base text-background/80">{commercial.cta.body}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href={phoneHref()}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Call {siteConfig.phoneNumber}
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-full border border-background/30 px-6 py-3 text-base font-semibold text-background transition-colors hover:bg-background/10"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
