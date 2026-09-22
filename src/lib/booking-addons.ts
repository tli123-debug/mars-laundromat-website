export interface BookingAddOns {
  scentFreeDetergent: boolean;
  separateWhitesBlacks: boolean;
  bleachWhites: boolean;
  comforter: boolean;
  downComforter: boolean;
  hangDrySelectItems: boolean;
}

export const BOOKING_ADD_ONS_DEFAULT: BookingAddOns = {
  scentFreeDetergent: false,
  separateWhitesBlacks: false,
  bleachWhites: false,
  comforter: false,
  downComforter: false,
  hangDrySelectItems: false,
};

/**
 * Display order doubles as summary-line order — bleachWhites is listed
 * right after separateWhitesBlacks since the UI always presents it nested
 * underneath, and the composed note should read the same way.
 */
export const BOOKING_ADD_ON_OPTIONS: { key: keyof BookingAddOns; label: string }[] = [
  { key: "scentFreeDetergent", label: "Scent-free detergent" },
  { key: "separateWhitesBlacks", label: "Separate whites & blacks (+$3)" },
  { key: "bleachWhites", label: "Also bleach whites (+$5)" },
  { key: "comforter", label: "Comforter included (+$20)" },
  { key: "downComforter", label: "Down comforter included (+$30)" },
  { key: "hangDrySelectItems", label: "Hang dry select items (mesh bag required)" },
];

/**
 * One line summarizing the checked add-ons for staff, or null if nothing
 * is checked — so a customer who never opens the section adds nothing to
 * their notes. bleachWhites alone is normalized to imply
 * separateWhitesBlacks too (bleaching only makes sense alongside
 * separating): the form UI already keeps them paired by disabling bleach
 * until separate is checked, but this keeps the function correct on its
 * own regardless of what called it.
 */
export function buildAddOnsSummaryLine(addOns: BookingAddOns): string | null {
  const effective = addOns.bleachWhites ? { ...addOns, separateWhitesBlacks: true } : addOns;
  const selected = BOOKING_ADD_ON_OPTIONS.filter((option) => effective[option.key]).map(
    (option) => option.label
  );
  if (selected.length === 0) return null;
  return `Add-ons: ${selected.join("; ")}`;
}

/**
 * The single string actually sent as special_instructions — the add-ons
 * summary line (if any) followed by the customer's own free text. Staff
 * read this exactly like any other special_instructions value today;
 * nothing downstream needs to know individual checkboxes ever existed.
 */
export function composeSpecialInstructions(addOns: BookingAddOns, freeText: string): string {
  const addOnsLine = buildAddOnsSummaryLine(addOns);
  return [addOnsLine, freeText.trim()].filter(Boolean).join("\n\n");
}
