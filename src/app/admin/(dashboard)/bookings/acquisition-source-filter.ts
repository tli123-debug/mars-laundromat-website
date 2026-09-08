import {
  ACQUISITION_SOURCE_ADMIN_LABELS,
  ACQUISITION_SOURCE_NOT_PROVIDED_LABEL,
  ACQUISITION_SOURCES,
} from "@/lib/acquisition-source";
import type { AcquisitionSource } from "@/types/database.types";

export type AcquisitionSourceFilter = "all" | "not_provided" | AcquisitionSource;

export const ACQUISITION_SOURCE_FILTER_OPTIONS: { value: AcquisitionSourceFilter; label: string }[] = [
  { value: "all", label: "All sources 所有来源" },
  ...ACQUISITION_SOURCES.map((source) => ({ value: source, label: ACQUISITION_SOURCE_ADMIN_LABELS[source] })),
  { value: "not_provided", label: ACQUISITION_SOURCE_NOT_PROVIDED_LABEL },
];

export function isAcquisitionSourceFilter(value: string | undefined): value is AcquisitionSourceFilter {
  return ACQUISITION_SOURCE_FILTER_OPTIONS.some((option) => option.value === value);
}

/**
 * What the bookings query should do for a given filter — mirrors
 * statusesForView()'s "return the decision, let page.tsx apply it to the
 * Supabase query" split in view-filter.ts, so this stays pure-testable
 * without mocking Supabase. "all" applies no filter at all; "not_provided"
 * and a specific source need different Supabase methods (.is() vs .eq()),
 * so the decision is returned as a discriminated union rather than a value
 * page.tsx would have to re-branch on anyway.
 */
export type AcquisitionSourceQueryFilter =
  | { kind: "none" }
  | { kind: "is_null" }
  | { kind: "equals"; value: AcquisitionSource };

export function acquisitionSourceQueryFilterFor(filter: AcquisitionSourceFilter): AcquisitionSourceQueryFilter {
  if (filter === "all") return { kind: "none" };
  if (filter === "not_provided") return { kind: "is_null" };
  return { kind: "equals", value: filter };
}
