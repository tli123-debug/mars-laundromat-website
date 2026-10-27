import { siteConfig } from "@/content/site-config";

export interface PrivacySection {
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  links?: readonly { label: string; href: string }[];
}

/**
 * Written from what the site actually does (booking form fields, the
 * service providers wired into the code, the browser storage it uses). If
 * any of that changes, e.g. a new analytics tool or a new provider, update
 * this page in the same change.
 */
export const privacy = {
  lastUpdated: "October 26, 2026",

  hero: {
    eyebrow: "Privacy",
    headline: "Privacy Policy",
    subheadline:
      "What we collect when you visit our website or book a pickup, how we use it, and the choices you have. We keep it short and plain on purpose.",
  },

  sections: [
    {
      heading: "Who we are",
      paragraphs: [
        "Mars Laundromat is a family-owned laundromat at 450 6th Ave, Brooklyn, NY 11215. This page covers our website, marslaundromat.com, and the pickup and delivery requests made through it.",
      ],
    },
    {
      heading: "What we collect",
      bullets: [
        "When you request a pickup: your name, phone number, pickup and delivery address, the services and times you ask for, and any notes or special instructions you write, including add-ons you choose.",
        "Your text-message consent: whether you checked the consent box, and when.",
        "How you heard about us, if you tell us, or if you arrived from one of our ads or links.",
        "If you arrive from a Google ad: Google's ad click ID and campaign details, remembered in your browser for up to 30 days so we can tell which bookings came from our ads.",
        "The basic technical details any website receives, such as your device type and IP address, which our hosting provider keeps in routine server logs.",
        "We do not collect payment card details on this website. Orders are paid by cash, Zelle, or Venmo, outside the website.",
      ],
    },
    {
      heading: "How we use it",
      bullets: [
        "To schedule, confirm, and complete your pickup and delivery.",
        "To text you about your order: confirmation, scheduling, quote, payment, and delivery updates. We may call you if we can't reach you by text.",
        "To keep records of orders and payments.",
        "To learn which of our ads and listings lead to bookings, so we spend our advertising money wisely.",
        "To keep the website secure and working.",
      ],
      paragraphs: [
        "We do not sell your personal information, and we do not share it so that others can market to you.",
      ],
    },
    {
      heading: "Text messages",
      paragraphs: [
        "If you check the box on our booking form, you agree to receive non-marketing text messages from Mars Laundromat about your booking, including confirmation, scheduling, quote, payment, and delivery updates. Message frequency varies, and message and data rates may apply. Reply STOP to opt out. If you opt out while an order is active, we may call you about it.",
        `You don't have to agree to texts to use Mars. Call us at ${siteConfig.phoneNumber} and we'll help you book by phone instead.`,
      ],
    },
    {
      heading: "Who we share it with",
      paragraphs: [
        "We use a small number of service providers to run the business. They handle your information only to provide their service to us:",
      ],
      bullets: [
        "Vercel hosts our website.",
        "Supabase stores our booking records.",
        "Resend sends booking notifications to our staff by email.",
        "An AI translation service translates the notes and dry-cleaning item descriptions you type so our staff can read them. Only that text is sent, not the rest of your booking.",
        "Google, through the advertising tag on our pages (see the next section).",
      ],
    },
    {
      heading: "Browser storage and advertising",
      paragraphs: [
        "Our site keeps a little information in your browser. One piece stops a booking from being submitted twice and restores your form if you refresh the page. Another remembers, for up to 30 days, that you arrived from a Google ad or one of our links.",
        "When we run Google ads, our pages load Google's advertising tag. It sets cookies on your device and sends Google information about your visit, such as the pages you view, so Google can tell us when an ad led to a booking and can show relevant ads. You can control how Google uses this information, or turn off personalized ads, with the links below. You can also block or clear cookies in your browser settings. The site will still work, and you can always book by phone.",
      ],
      links: [
        { label: "Google Ads Settings", href: "https://adssettings.google.com" },
        {
          label: "How Google uses information from sites that use its services",
          href: "https://policies.google.com/technologies/partner-sites",
        },
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "We keep booking records for as long as we need them to run the business and to meet our legal, tax, and accounting obligations.",
      ],
    },
    {
      heading: "Your choices",
      bullets: [
        `To see, correct, or delete your information, call or text us at ${siteConfig.phoneNumber} and we'll take care of it.`,
        "To stop text messages, reply STOP to any message from us.",
        "To limit Google's use of ad data, use the Google links above or your browser's cookie settings.",
      ],
    },
    {
      heading: "Children",
      paragraphs: [
        "Our website is meant for adults. We do not knowingly collect information from children under 13.",
      ],
    },
    {
      heading: "Changes to this policy",
      paragraphs: [
        "If we change how we handle information, we will update this page and the date at the top.",
      ],
    },
    {
      heading: "Contact us",
      paragraphs: [
        `Mars Laundromat, 450 6th Ave, Brooklyn, NY 11215. Call or text ${siteConfig.phoneNumber}.`,
      ],
    },
  ] satisfies readonly PrivacySection[],
} as const;
