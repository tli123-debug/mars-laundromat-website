"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DATE_RANGE_OPTIONS, type DateRangeOption } from "./date-range";
import { BOOKING_VIEW_OPTIONS, type BookingView } from "./view-filter";
import { ACQUISITION_SOURCE_FILTER_OPTIONS, type AcquisitionSourceFilter } from "./acquisition-source-filter";

export function BookingsFilters({
  currentRange,
  currentSearch,
  currentView,
  currentSource,
}: {
  currentRange: DateRangeOption;
  currentSearch: string;
  currentView: BookingView;
  currentSource: AcquisitionSourceFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(currentSearch);

  // Keeps the input in sync when searchParams change from outside a keystroke
  // here (e.g. browser back/forward, or the view/range buttons below).
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  function navigate(view: BookingView, range: DateRangeOption, search: string, source: AcquisitionSourceFilter) {
    const params = new URLSearchParams();
    if (view !== "active") params.set("view", view);
    if (range !== "all-time") params.set("range", range);
    if (search) params.set("q", search);
    if (source !== "all") params.set("source", source);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (searchInput === currentSearch) return;
    const timeout = setTimeout(() => navigate(currentView, currentRange, searchInput, currentSource), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Booking view 预约视图">
        {BOOKING_VIEW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={currentView === option.value}
            onClick={() => navigate(option.value, currentRange, searchInput, currentSource)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
              currentView === option.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground/80 hover:bg-muted"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {DATE_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={currentRange === option.value}
              onClick={() => navigate(currentView, option.value, searchInput, currentSource)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                currentRange === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground/80 hover:bg-muted"
              )}
            >
              {option.label}
            </button>
          ))}
          <Select
            value={currentSource}
            onValueChange={(value) =>
              navigate(currentView, currentRange, searchInput, value as AcquisitionSourceFilter)
            }
          >
            <SelectTrigger size="sm" aria-label="Filter by acquisition source 按来源筛选" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACQUISITION_SOURCE_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          type="search"
          placeholder="Search name, phone, or address"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="sm:w-64"
        />
      </div>
    </div>
  );
}
