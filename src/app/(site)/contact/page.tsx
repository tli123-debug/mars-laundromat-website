import type { Metadata } from "next";
import Link from "next/link";
import { contact } from "@/content/contact";
import { fullAddress, siteConfig, whatsappHref } from "@/content/site-config";

export const metadata: Metadata = {
  title: "Contact | Mars Laundromat",
  description:
    "Reach Mars Laundromat on WhatsApp, or find our address and hours in Park Slope, Brooklyn.",
};

export default function ContactPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-6 pb-4 pt-16 text-center sm:pt-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">
          {contact.hero.eyebrow}
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">
          {contact.hero.headline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          {contact.hero.subheadline}
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="rounded-2xl bg-[#25D366]/10 p-8">
            <h2 className="font-display text-2xl font-semibold">
              {contact.whatsapp.heading}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {contact.whatsapp.body}
            </p>
            <a
              href={whatsappHref("Hi! I have a question about Mars Laundromat.")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {contact.whatsapp.cta.label} — {siteConfig.whatsappNumber}
            </a>
          </div>

          <div className="rounded-2xl bg-muted p-8">
            <h2 className="font-display text-2xl font-semibold">
              {contact.visit.heading}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {contact.visit.body}
            </p>

            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="font-semibold">Address</dt>
                <dd className="mt-1 text-muted-foreground">{fullAddress()}</dd>
              </div>
              <div>
                <dt className="font-semibold">Hours</dt>
                <dd className="mt-1 space-y-1 text-muted-foreground">
                  {siteConfig.hours.map((entry) => (
                    <div key={entry.days}>
                      {entry.days}: {entry.time}
                    </div>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Delivery coverage</dt>
                <dd className="mt-1 text-muted-foreground">
                  {siteConfig.coverageArea.avenues}, {siteConfig.coverageArea.streets}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-foreground py-16 text-background">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-3xl font-semibold">
            Prefer to just book?
          </h2>
          <p className="mt-4 text-base text-background/80">
            Skip the back-and-forth and schedule your pickup directly.
          </p>
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
