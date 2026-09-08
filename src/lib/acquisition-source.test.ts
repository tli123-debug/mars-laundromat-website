import { describe, expect, it } from "vitest";
import {
  ACQUISITION_SOURCE_ADMIN_LABELS,
  ACQUISITION_SOURCE_FORM_OPTIONS,
  ACQUISITION_SOURCES,
  isAcquisitionSource,
  isValidAcquisitionSourceUpdate,
  normalizeAcquisitionSource,
  resolveAcquisitionSourceFormDefault,
} from "./acquisition-source";

describe("ACQUISITION_SOURCES", () => {
  it("has no duplicate values", () => {
    expect(new Set(ACQUISITION_SOURCES).size).toBe(ACQUISITION_SOURCES.length);
  });
});

describe("isAcquisitionSource", () => {
  it("accepts every permitted value", () => {
    for (const source of ACQUISITION_SOURCES) {
      expect(isAcquisitionSource(source)).toBe(true);
    }
  });

  it("rejects unknown or garbage strings", () => {
    expect(isAcquisitionSource("billboard")).toBe(false);
    expect(isAcquisitionSource("Nextdoor")).toBe(false); // case-sensitive, not the stored form
    expect(isAcquisitionSource("")).toBe(false);
    expect(isAcquisitionSource("<script>alert(1)</script>")).toBe(false);
  });
});

describe("normalizeAcquisitionSource", () => {
  it("passes through every permitted value unchanged", () => {
    for (const source of ACQUISITION_SOURCES) {
      expect(normalizeAcquisitionSource(source)).toBe(source);
    }
  });

  it("normalizes null, undefined, and empty string to null", () => {
    expect(normalizeAcquisitionSource(null)).toBeNull();
    expect(normalizeAcquisitionSource(undefined)).toBeNull();
    expect(normalizeAcquisitionSource("")).toBeNull();
  });

  it("normalizes an unrecognized value to null rather than throwing or passing it through", () => {
    expect(normalizeAcquisitionSource("billboard")).toBeNull();
    expect(normalizeAcquisitionSource("google_search_maps ")).toBeNull(); // no trimming/fuzzy-matching
    expect(normalizeAcquisitionSource("GOOGLE_ADS")).toBeNull();
  });
});

describe("ACQUISITION_SOURCE_FORM_OPTIONS", () => {
  it("excludes the tracked-link-only sources", () => {
    const values = ACQUISITION_SOURCE_FORM_OPTIONS.map((option) => option.value);
    expect(values).not.toContain("google_ads");
    expect(values).not.toContain("google_business");
    expect(values).not.toContain("meta_ads");
  });

  it("every option value is a permitted acquisition source", () => {
    for (const option of ACQUISITION_SOURCE_FORM_OPTIONS) {
      expect(isAcquisitionSource(option.value)).toBe(true);
    }
  });

  it("has no duplicate values or blank labels", () => {
    const values = ACQUISITION_SOURCE_FORM_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
    for (const option of ACQUISITION_SOURCE_FORM_OPTIONS) {
      expect(option.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("ACQUISITION_SOURCE_ADMIN_LABELS", () => {
  it("has a non-empty label for every permitted source, including the tracked-link-only ones", () => {
    for (const source of ACQUISITION_SOURCES) {
      expect(ACQUISITION_SOURCE_ADMIN_LABELS[source]?.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("resolveAcquisitionSourceFormDefault", () => {
  it("uses the tracked source when present, for every permitted source", () => {
    for (const source of ACQUISITION_SOURCES) {
      expect(resolveAcquisitionSourceFormDefault(source)).toBe(source);
    }
  });

  it("falls back to empty string when there's no tracked source", () => {
    expect(resolveAcquisitionSourceFormDefault(null)).toBe("");
  });
});

describe("isValidAcquisitionSourceUpdate", () => {
  it("accepts every permitted source", () => {
    for (const source of ACQUISITION_SOURCES) {
      expect(isValidAcquisitionSourceUpdate(source)).toBe(true);
    }
  });

  it("accepts null (clearing the value back to 'not provided')", () => {
    expect(isValidAcquisitionSourceUpdate(null)).toBe(true);
  });

  it("rejects arbitrary strings", () => {
    expect(isValidAcquisitionSourceUpdate("billboard")).toBe(false);
    expect(isValidAcquisitionSourceUpdate("")).toBe(false);
  });

  it("rejects undefined and non-string types", () => {
    expect(isValidAcquisitionSourceUpdate(undefined)).toBe(false);
    expect(isValidAcquisitionSourceUpdate(123)).toBe(false);
    expect(isValidAcquisitionSourceUpdate(["nextdoor"])).toBe(false);
  });
});
