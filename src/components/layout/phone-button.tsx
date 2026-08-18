"use client";

import { Phone } from "lucide-react";
import { usePathname } from "next/navigation";
import { phoneHref } from "@/content/site-config";

export function PhoneButton() {
  const pathname = usePathname();

  // The booking form has its own submit button in the same bottom-right
  // corner on mobile — the floating bubble visually overlaps it when scrolled
  // partway down, so it's suppressed on that page.
  if (pathname.startsWith("/book")) {
    return null;
  }

  return (
    <a
      href={phoneHref()}
      aria-label="Call us"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
    >
      <Phone className="h-6 w-6" fill="currentColor" aria-hidden="true" />
    </a>
  );
}
