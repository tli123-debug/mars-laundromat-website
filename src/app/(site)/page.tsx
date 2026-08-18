import Image from "next/image";
import Link from "next/link";
import { home } from "@/content/home";
import { images } from "@/content/images";
import { phoneHref } from "@/content/site-config";
import { GoogleReviews } from "@/components/home/google-reviews";

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={images.heroHome.src}
            alt={images.heroHome.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_25%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/30 to-foreground/10" />
        </div>

        <div className="relative mx-auto flex min-h-[26rem] max-w-6xl flex-col justify-end px-6 py-12 sm:min-h-[38rem] sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/80">
            {home.hero.eyebrow}
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-tight text-white sm:text-5xl md:text-6xl">
            {home.hero.headline}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/90">
            {home.hero.subheadline}
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href={home.hero.primaryCta.href}
              className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {home.hero.primaryCta.label}
            </Link>
            <a
              href={phoneHref()}
              className="inline-flex items-center rounded-full border border-white/60 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              {home.hero.secondaryCta.label}
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
          <div>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">
              {home.intro.heading}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              {home.intro.body}
            </p>
            <Link
              href={home.intro.cta.href}
              className="mt-6 inline-flex items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              {home.intro.cta.label} →
            </Link>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image
              src={images.familyOwners.src}
              alt={images.familyOwners.alt}
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-muted py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="max-w-xl font-display text-3xl font-semibold sm:text-4xl">
            Why Park Slope trusts Mars Laundromat
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {home.valueProps.map((prop) => (
              <div key={prop.title} className="rounded-2xl bg-background p-7">
                <h3 className="font-display text-xl font-semibold">
                  {prop.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {prop.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl">
          <Image
            src={images.gardenExterior.src}
            alt={images.gardenExterior.alt}
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-foreground/70 to-transparent p-8 sm:p-10">
            <p className="max-w-md font-display text-xl text-white sm:text-2xl">
              Look for the garden out front — it's how you'll know you're in the right place.
            </p>
          </div>
        </div>
      </section>

      <GoogleReviews />

      <section className="border-t border-border bg-foreground py-20 text-background">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            {home.ctaBand.heading}
          </h2>
          <p className="mt-4 text-base text-background/80">{home.ctaBand.body}</p>
          <div className="mt-8 flex justify-center">
            <Link
              href={home.ctaBand.primaryCta.href}
              className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {home.ctaBand.primaryCta.label}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
