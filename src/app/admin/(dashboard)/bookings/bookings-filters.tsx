"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DATE_RANGE_OPTIONS, type DateRangeOption } from "./date-range";
import { BOOKING_VIEW_OPTIONS, type BookingView } from "./view-filter";

export function BookingsFilters({
  currentRange,
  currentSearch,
  currentView,
}: {
  currentRange: DateRangeOption;
  currentSearch: string;
  currentView: BookingView;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(currentSearch);

  // Keeps the input in sync when searchParams change from outside a keystroke
  // here (e.g. browser back/forward, or the view/range buttons below).
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  function navigate(view: BookingView, range: DateRangeOption, search: string) {
    const params = new URLSearchParams();
    if (view !== "active") params.set("view", view);
    if (range !== "all-time") params.set("range", range);
    if (search) params.set("q", search);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (searchInput === currentSearch) return;
    const timeout = setTimeout(() => navigate(currentView, currentRange, searchInput), 300);
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
            onClick={() => navigate(option.value, currentRange, searchInput)}
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
        <div className="flex flex-wrap gap-2">
          {DATE_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={currentRange === option.value}
              onClick={() => navigate(currentView, option.value, searchInput)}
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
