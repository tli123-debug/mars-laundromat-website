import { describe, expect, it } from "vitest";
import {
  BOOKING_ADD_ONS_DEFAULT,
  buildAddOnsSummaryLine,
  composeSpecialInstructions,
  type BookingAddOns,
} from "./booking-addons";

const ALL_ADD_ONS_CHECKED: BookingAddOns = {
  scentFreeDetergent: true,
  separateWhitesBlacks: true,
  bleachWhites: true,
  comforter: true,
  downComforter: true,
  hangDrySelectItems: true,
};

describe("buildAddOnsSummaryLine", () => {
  it("returns null when nothing is checked", () => {
    expect(buildAddOnsSummaryLine(BOOKING_ADD_ONS_DEFAULT)).toBeNull();
  });

  it("returns a single-item line for one checked option", () => {
    expect(
      buildAddOnsSummaryLine({ ...BOOKING_ADD_ONS_DEFAULT, scentFreeDetergent: true })
    ).toBe("Add-ons: Scent-free detergent");
  });

  it("joins multiple checked options with semicolons, in catalog order", () => {
    const line = buildAddOnsSummaryLine({
      ...BOOKING_ADD_ONS_DEFAULT,
      hangDrySelectItems: true,
      scentFreeDetergent: true,
      comforter: true,
    });
    expect(line).toBe(
      "Add-ons: Scent-free detergent; Comforter included (+$20); Hang dry select items (mesh bag required)"
    );
  });

  it("includes every option when all are checked", () => {
    const line = buildAddOnsSummaryLine(ALL_ADD_ONS_CHECKED);
    expect(line).toBe(
      "Add-ons: Scent-free detergent; Separate whites & blacks (+$3); Also bleach whites (+$5); " +
        "Comforter included (+$20); Down comforter included (+$30); Hang dry select items (mesh bag required)"
    );
  });

  it("normalizes bleachWhites alone to also imply separateWhitesBlacks", () => {
    // The form UI disables bleach until separate is checked, but this
    // function stays correct on its own regardless of what called it.
    const line = buildAddOnsSummaryLine({ ...BOOKING_ADD_ONS_DEFAULT, bleachWhites: true });
    expect(line).toBe("Add-ons: Separate whites & blacks (+$3); Also bleach whites (+$5)");
  });

  it("does not duplicate separateWhitesBlacks when both it and bleachWhites are already checked", () => {
    const line = buildAddOnsSummaryLine({
      ...BOOKING_ADD_ONS_DEFAULT,
      separateWhitesBlacks: true,
      bleachWhites: true,
    });
    expect(line).toBe("Add-ons: Separate whites & blacks (+$3); Also bleach whites (+$5)");
  });
});

describe("composeSpecialInstructions", () => {
  it("returns just the free text when nothing is checked", () => {
    expect(composeSpecialInstructions(BOOKING_ADD_ONS_DEFAULT, "Gate code is 1234")).toBe(
      "Gate code is 1234"
    );
  });

  it("returns just the add-ons line when free text is empty", () => {
    const addOns = { ...BOOKING_ADD_ONS_DEFAULT, comforter: true };
    expect(composeSpecialInstructions(addOns, "")).toBe("Add-ons: Comforter included (+$20)");
  });

  it("returns an empty string when neither is present", () => {
    expect(composeSpecialInstructions(BOOKING_ADD_ONS_DEFAULT, "")).toBe("");
  });

  it("joins the add-ons line and free text with a blank line between", () => {
    const addOns = { ...BOOKING_ADD_ONS_DEFAULT, downComforter: true };
    expect(composeSpecialInstructions(addOns, "Please ring the bell twice")).toBe(
      "Add-ons: Down comforter included (+$30)\n\nPlease ring the bell twice"
    );
  });

  it("trims surrounding whitespace from the free text", () => {
    expect(composeSpecialInstructions(BOOKING_ADD_ONS_DEFAULT, "  spaced out  \n")).toBe(
      "spaced out"
    );
  });

  it("is idempotent when re-run with no add-ons checked against its own prior output", () => {
    // Mirrors what happens on a post-refresh retry: addOns resets to
    // defaults in local component state, but the already-composed text
    // (restored from storage) is passed back through unchanged.
    const addOns = { ...BOOKING_ADD_ONS_DEFAULT, scentFreeDetergent: true };
    const firstPass = composeSpecialInstructions(addOns, "call ahead");
    const secondPass = composeSpecialInstructions(BOOKING_ADD_ONS_DEFAULT, firstPass);
    expect(secondPass).toBe(firstPass);
  });

  it("stays within the 1200-char special_instructions ceiling even with everything checked and near-max free text", () => {
    const nearMaxFreeText = "x".repeat(1000);
    expect(
      composeSpecialInstructions(ALL_ADD_ONS_CHECKED, nearMaxFreeText).length
    ).toBeLessThanOrEqual(1200);
  });
});
