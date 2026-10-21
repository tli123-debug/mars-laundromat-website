import {
  MINIMUM_ORDER_CENTS,
  PRICE_PER_POUND_CENTS,
  SAME_DAY_FEE_CENTS,
} from "@/lib/pricing/calculate-quote";
import { formatDollars } from "@/lib/format-currency";
import { coverageAreaList } from "@/content/site-config";

export const pickupDelivery = {
  hero: {
    eyebrow: "Free pickup & delivery in Park Slope",
    heading: "Laundry pickup & delivery from a laundromat you can actually walk into.",
    body:
      "Book Wash & Fold, Dry Cleaning & Ironing, or both in one pickup. Our family-run team collects everything at your door, cares for it at Mars Laundromat on 6th Avenue, and brings it back clean.",
  },
  highlights: [
    {
      value: "Free",
      label: "pickup and delivery for approved addresses in our service area",
    },
    {
      value: `${formatDollars(PRICE_PER_POUND_CENTS)}/lb`,
      label: `Wash & Fold with a ${formatDollars(MINIMUM_ORDER_CENTS)} minimum`,
    },
    {
      value: "Next day",
      label: "normal return for standard Wash & Fold service",
    },
  ],
  steps: [
    {
      number: "01",
      title: "Request a pickup",
      description:
        "Choose your service, address, and preferred pickup window online. It normally takes about a minute.",
    },
    {
      number: "02",
      title: "We confirm with you",
      description:
        "A real person from Mars reviews the request and confirms or adjusts the window by text or phone.",
    },
    {
      number: "03",
      title: "We collect and care for it",
      description:
        "Our team picks up your bags and handles the cleaning at our family laundromat in Park Slope.",
    },
    {
      number: "04",
      title: "We return it to your door",
      description:
        "Your clean laundry and garments come back during the delivery window we agreed on together.",
    },
  ],
  services: [
    {
      title: "Wash & Fold",
      description:
        `Everyday laundry washed, dried, and neatly folded for ${formatDollars(PRICE_PER_POUND_CENTS)} per billed pound, with a ${formatDollars(MINIMUM_ORDER_CENTS)} minimum.`,
      href: "/services/wash-and-fold",
    },
    {
      title: "Dry Cleaning & Ironing",
      description:
        "Garments are counted and inspected by our team. We send the quote before cleaning and return everything with your other items.",
      href: "/services/dry-cleaning",
    },
    {
      title: "Same-Day Rush",
      description:
        `Available for qualifying Wash & Fold requests picked up by noon, subject to approval, for an additional ${formatDollars(SAME_DAY_FEE_CENTS)}.`,
      href: "/book",
    },
  ],
  coverage: {
    heading: "Local service, centered in Park Slope",
    body:
      "We keep our delivery area close enough to provide dependable windows and personal service. Enter your address when booking and our team will confirm coverage.",
    summary: `Our current service area includes ${coverageAreaList()}.`,
  },
  faq: [
    {
      question: "Is pickup and delivery really free?",
      answer:
        `Yes. Pickup and delivery are free for approved addresses in our service area. Wash & Fold has a ${formatDollars(MINIMUM_ORDER_CENTS)} minimum order.`,
    },
    {
      question: "How quickly will my laundry come back?",
      answer:
        "Standard Wash & Fold is normally returned the next day. Flexible 24–48 hour and qualifying same-day options are also available. Dry Cleaning & Ironing normally takes longer.",
    },
    {
      question: "Can I send Wash & Fold and dry cleaning together?",
      answer:
        "Yes. Select both services in the booking form and place the items in separate bags so our team can identify them at pickup.",
    },
    {
      question: "Who handles my order?",
      answer:
        "Mars Laundromat's own local team confirms the pickup, cleans the items at our Park Slope storefront, and coordinates the return. We are not an app or marketplace.",
    },
  ],
} as const;
