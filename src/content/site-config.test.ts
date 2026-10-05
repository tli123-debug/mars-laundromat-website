import { describe, expect, it } from "vitest";
import { coverageAreaList, siteConfig } from "./site-config";

const APPROVED_NEIGHBORHOODS = [
  "Park Slope",
  "South Slope",
  "Gowanus",
  "Greenwood Heights",
  "Windsor Terrace",
  "Carroll Gardens",
  "Cobble Hill",
  "Boerum Hill",
  "Prospect Heights",
] as const;

describe("siteConfig coverage area", () => {
  it("keeps the owner-approved neighborhoods in one canonical list", () => {
    expect(siteConfig.coverageArea.neighborhoods).toEqual(APPROVED_NEIGHBORHOODS);
  });

  it("builds customer-facing coverage copy from the canonical list", () => {
    expect(coverageAreaList()).toBe(APPROVED_NEIGHBORHOODS.join(", "));
  });

  it("uses a neutral Brooklyn map anchor rather than mislabeling every address as Park Slope", () => {
    expect(siteConfig.coverageArea.mapAnchor).toBe("Brooklyn, NY");
  });
});
