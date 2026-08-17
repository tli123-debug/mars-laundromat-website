"use client";

import { usePathname } from "next/navigation";
import { whatsappHref } from "@/content/site-config";

export function WhatsAppButton() {
  const pathname = usePathname();

  // The booking form has its own submit button in the same bottom-right
  // corner on mobile — the floating bubble visually overlaps it when scrolled
  // partway down, so it's suppressed on that page.
  if (pathname.startsWith("/book")) {
    return null;
  }

  return (
    <a
      href={whatsappHref("Hi! I'd like to ask about laundry pickup & delivery.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Message us on WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        width="28"
        height="28"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.317.653 4.484 1.786 6.33L4 29l7.86-1.748A11.94 11.94 0 0 0 16 27c6.627 0 12-5.373 12-12S22.628 3 16.001 3Zm0 21.75c-1.98 0-3.83-.55-5.408-1.505l-.388-.23-4.665 1.038 1.062-4.55-.253-.4A9.71 9.71 0 0 1 5.25 15c0-5.937 4.813-10.75 10.75-10.75S26.75 9.063 26.75 15 21.938 24.75 16 24.75Zm5.63-8.043c-.309-.155-1.828-.902-2.111-1.005-.283-.103-.489-.155-.694.155-.206.31-.798 1.005-.978 1.212-.18.206-.36.232-.669.077-.309-.155-1.304-.48-2.484-1.529-.918-.818-1.538-1.83-1.719-2.139-.18-.31-.019-.477.136-.63.14-.14.309-.362.463-.542.155-.18.206-.31.309-.516.103-.206.052-.387-.026-.542-.077-.155-.694-1.674-.952-2.293-.25-.601-.505-.52-.694-.53-.18-.008-.386-.01-.592-.01a1.14 1.14 0 0 0-.823.387c-.283.31-1.08 1.056-1.08 2.575 0 1.52 1.106 2.988 1.26 3.194.154.206 2.177 3.324 5.274 4.66.737.318 1.312.508 1.76.65.739.235 1.412.202 1.944.123.593-.089 1.828-.747 2.086-1.468.257-.72.257-1.338.18-1.468-.077-.129-.283-.206-.592-.361Z" />
      </svg>
    </a>
  );
}
