import type { Metadata } from "next";
import { privacy, type PrivacySection } from "@/content/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Mars Laundromat collects, uses, and protects the information you share when you visit our website or book a pickup.",
};

const sections: readonly PrivacySection[] = privacy.sections;

export default function PrivacyPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-6 pb-4 pt-16 text-center sm:pt-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          {privacy.hero.eyebrow}
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">
          {privacy.hero.headline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          {privacy.hero.subheadline}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {privacy.lastUpdated}</p>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-12">
          {sections.map((section) => (
            <div key={section.heading}>
              <h2 className="font-display text-2xl font-semibold">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-4 text-base leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-4 space-y-3">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-3 text-base leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
              {section.links && (
                <ul className="mt-4 space-y-2">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
