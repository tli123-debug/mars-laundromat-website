import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { about } from "@/content/about";
import { images } from "@/content/images";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Mars Laundromat is a family-owned, immigrant-owned laundromat rooted in Park Slope, Brooklyn.",
};

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-6 pb-4 pt-16 text-center sm:pt-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          {about.hero.eyebrow}
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">
          {about.hero.headline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          {about.hero.subheadline}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl md:order-2">
            <Image
              src={images.aboutStory.src}
              alt={images.aboutStory.alt}
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="md:order-1">
            <h2 className="font-display text-3xl font-semibold">
              {about.story.heading}
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-muted-foreground">
              {about.story.paragraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-2 md:items-center md:gap-16">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image
              src={images.aboutGarden.src}
              alt={images.aboutGarden.alt}
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="font-display text-3xl font-semibold">
              {about.garden.heading}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              {about.garden.body}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="font-display text-3xl font-semibold">
          {about.community.heading}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {about.community.body}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          {about.values.map((value) => (
            <div key={value.title} className="rounded-2xl bg-muted p-7">
              <h3 className="font-display text-lg font-semibold">
                {value.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-foreground py-16 text-background">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-3xl font-semibold">
            Come meet us in person
          </h2>
          <p className="mt-4 text-base text-background/80">
            Or let us come to you, book a pickup to experience our local service.
          </p>
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
