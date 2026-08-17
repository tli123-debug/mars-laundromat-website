export type DateRangeOption = "this-week" | "last-week" | "last-month" | "all-time";

export const DATE_RANGE_OPTIONS: { value: DateRangeOption; label: string }[] = [
  { value: "this-week", label: "This week" },
  { value: "last-week", label: "Last week" },
  { value: "last-month", label: "Last month" },
  { value: "all-time", label: "All time" },
];

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function isDateRangeOption(value: string | undefined): value is DateRangeOption {
  return DATE_RANGE_OPTIONS.some((option) => option.value === value);
}

// `end` is exclusive and only set for the closed "last week"/"last month"
// buckets — "this week" and "all time" are open-ended up to now.
export function getDateRange(option: DateRangeOption): { start: Date | null; end: Date | null } {
  const now = new Date();

  switch (option) {
    case "this-week":
      return { start: startOfWeek(now), end: null };
    case "last-week": {
      const thisWeekStart = startOfWeek(now);
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      return { start: lastWeekStart, end: thisWeekStart };
    }
    case "last-month": {
      const thisMonthStart = startOfMonth(now);
      const lastMonthStart = new Date(thisMonthStart);
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
      return { start: lastMonthStart, end: thisMonthStart };
    }
    case "all-time":
      return { start: null, end: null };
  }
}
