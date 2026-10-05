import { coverageAreaList } from "@/content/site-config";

export const faq = [
  {
    question: "How does pickup & delivery pricing work?",
    answer:
      "Wash & Fold is priced by the pound with a simple per-order minimum. After we weigh your laundry at the store, we'll text you the exact total before delivery.",
  },
  {
    question: "What's your coverage area?",
    answer: `We offer free pickup & delivery throughout ${coverageAreaList()}. If you're nearby but don't see your neighborhood listed, call or text us. We may still be able to accommodate your address.`,
  },
  {
    question: "What if I'm not home for my delivery window?",
    answer:
      "Let us know a safe spot to leave your order (like a doorstep or building lobby) in the special instructions when you book, or coordinate a better time with us by phone.",
  },
  {
    question: "How do I pay?",
    answer:
      "We'll confirm payment details when we send your final quote. Cash and Zelle are accepted.",
  },
  {
    question: "Do you handle delicates or special items?",
    answer:
      "Yes. Just add a note in the special instructions when you book, or mention it when we confirm, so we can treat those items with extra care.",
  },
  {
    question: "How far in advance should I book?",
    answer:
      "As soon as you know your preferred pickup date. We do our best to accommodate short notice too. Call us for same-day requests.",
  },
] as const;
