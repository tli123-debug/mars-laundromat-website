import Link from "next/link";
import { fullAddress, phoneHref, siteConfig } from "@/content/site-config";

const exploreLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Book Now", href: "/book" },
];

const serviceLinks = [
  { label: "Wash & Fold", href: "/services/wash-and-fold" },
  { label: "Dry Cleaning & Ironing", href: "/services/dry-cleaning" },
  { label: "Commercial Laundry", href: "/services/commercial" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="font-display text-lg font-semibold">
              {siteConfig.name}
            </span>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              {siteConfig.description}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Explore</h3>
            <ul className="mt-3 space-y-2">
              {exploreLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Services</h3>
            <ul className="mt-3 space-y-2">
              {serviceLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Get in touch</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href={phoneHref()} className="transition-colors hover:text-foreground">
                  {siteConfig.phoneNumber}
                </a>
              </li>
              <li>{fullAddress()}</li>
              {siteConfig.hours.map((entry) => (
                <li key={entry.days}>
                  <span className="font-semibold text-foreground">{entry.days}:</span>{" "}
                  {entry.time}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {siteConfig.name}. Proudly serving{" "}
          {siteConfig.coverageArea.label}.
        </div>
      </div>
    </footer>
  );
}
