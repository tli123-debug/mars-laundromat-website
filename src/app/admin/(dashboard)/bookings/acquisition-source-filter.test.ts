import { describe, expect, it } from "vitest";
import { ACQUISITION_SOURCES } from "@/lib/acquisition-source";
import {
  ACQUISITION_SOURCE_FILTER_OPTIONS,
  acquisitionSourceQueryFilterFor,
  isAcquisitionSourceFilter,
} from "./acquisition-source-filter";

describe("ACQUISITION_SOURCE_FILTER_OPTIONS", () => {
  it("lists 'All sources' first and 'Not provided' last, with every permitted source in between", () => {
    expect(ACQUISITION_SOURCE_FILTER_OPTIONS[0].value).toBe("all");
    expect(ACQUISITION_SOURCE_FILTER_OPTIONS.at(-1)!.value).toBe("not_provided");
    expect(ACQUISITION_SOURCE_FILTER_OPTIONS.length).toBe(ACQUISITION_SOURCES.length + 2);
  });
});

describe("isAcquisitionSourceFilter", () => {
  it("accepts 'all', 'not_provided', and every permitted source", () => {
    expect(isAcquisitionSourceFilter("all")).toBe(true);
    expect(isAcquisitionSourceFilter("not_provided")).toBe(true);
    for (const source of ACQUISITION_SOURCES) {
      expect(isAcquisitionSourceFilter(source)).toBe(true);
    }
  });

  it("rejects unknown or missing values", () => {
    expect(isAcquisitionSourceFilter("billboard")).toBe(false);
    expect(isAcquisitionSourceFilter(undefined)).toBe(false);
    expect(isAcquisitionSourceFilter("")).toBe(false);
  });
});

describe("acquisitionSourceQueryFilterFor", () => {
  it("'all' applies no filter", () => {
    expect(acquisitionSourceQueryFilterFor("all")).toEqual({ kind: "none" });
  });

  it("'not_provided' filters to null", () => {
    expect(acquisitionSourceQueryFilterFor("not_provided")).toEqual({ kind: "is_null" });
  });

  it("a specific source filters by equality to that exact source", () => {
    for (const source of ACQUISITION_SOURCES) {
      expect(acquisitionSourceQueryFilterFor(source)).toEqual({ kind: "equals", value: source });
    }
  });
});
