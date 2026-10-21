"use client";

import Link from "next/link";
import { useState } from "react";
import { siteConfig } from "@/content/site-config";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

const NAV_LINK_CLASSNAME =
  "text-sm font-medium text-foreground/80 transition-colors hover:text-foreground";
const MOBILE_NAV_LINK_CLASSNAME =
  "block rounded-md px-2 py-3 text-base font-medium text-foreground/80 hover:text-foreground";

const serviceLinks = [
  { label: "Wash & Fold", href: "/services/wash-and-fold" },
  { label: "Dry Cleaning & Ironing", href: "/services/dry-cleaning" },
  { label: "Commercial Laundry Services", href: "/services/commercial" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight"
          onClick={() => setIsMenuOpen(false)}
        >
          {siteConfig.name}
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link href="/" className={NAV_LINK_CLASSNAME}>
            Home
          </Link>

          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Services</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="flex flex-col gap-1">
                    {serviceLinks.map((link) => (
                      <li key={link.href}>
                        <NavigationMenuLink href={link.href}>{link.label}</NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <Link href="/about" className={NAV_LINK_CLASSNAME}>
            About
          </Link>
          <Link href="/contact" className={NAV_LINK_CLASSNAME}>
            Contact
          </Link>
        </nav>

        <div className="hidden md:block">
          <Link
            href="/book"
            className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Book Now
          </Link>
        </div>

        <button
          type="button"
          className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted md:hidden"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {isMenuOpen ? (
              <path d="M18 6 6 18M6 6l12 12" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" />
            )}
          </svg>
          {isMenuOpen ? "Close" : "Menu"}
        </button>
      </div>

      {isMenuOpen && (
        <nav className="border-t border-border px-6 pb-6 pt-2 md:hidden">
          <ul className="flex flex-col gap-1">
            <li>
              <Link
                href="/"
                className={MOBILE_NAV_LINK_CLASSNAME}
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
            </li>
            <li>
              <Accordion type="single" collapsible>
                <AccordionItem value="services" className="border-b-0">
                  <AccordionTrigger className="rounded-md px-2 py-3 text-base font-medium text-foreground/80 hover:text-foreground hover:no-underline">
                    Services
                  </AccordionTrigger>
                  <AccordionContent className="pb-1">
                    <ul className="flex flex-col gap-1 pl-2">
                      {serviceLinks.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className="block rounded-md px-2 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </li>
            <li>
              <Link
                href="/about"
                className={MOBILE_NAV_LINK_CLASSNAME}
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                className={MOBILE_NAV_LINK_CLASSNAME}
                onClick={() => setIsMenuOpen(false)}
              >
                Contact
              </Link>
            </li>
            <li className="pt-2">
              <Link
                href="/book"
                className="block rounded-full bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground"
                onClick={() => setIsMenuOpen(false)}
              >
                Book Now
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
