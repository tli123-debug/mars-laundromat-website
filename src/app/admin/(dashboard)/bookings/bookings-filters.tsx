"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DATE_RANGE_OPTIONS, type DateRangeOption } from "./date-range";

export function BookingsFilters({
  currentRange,
  currentSearch,
}: {
  currentRange: DateRangeOption;
  currentSearch: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(currentSearch);

  // Keeps the input in sync when searchParams change from outside a keystroke
  // here (e.g. browser back/forward, or the range buttons below).
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  function navigate(range: DateRangeOption, search: string) {
    const params = new URLSearchParams();
    if (range !== "all-time") params.set("range", range);
    if (search) params.set("q", search);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (searchInput === currentSearch) return;
    const timeout = setTimeout(() => navigate(currentRange, searchInput), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {DATE_RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => navigate(option.value, searchInput)}
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
  );
}
