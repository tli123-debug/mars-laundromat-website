import { describe, expect, it } from "vitest";
import { RECURRING_BADGE_STYLES } from "./recurring-schedule-styles";
import type { RecurringBadgeKind } from "@/lib/recurring-schedule";

const ALL_KINDS: RecurringBadgeKind[] = ["weekly", "every_two_weeks", "paused", "cancelled"];

describe("RECURRING_BADGE_STYLES", () => {
  it("has a non-empty style entry for every RecurringBadgeKind", () => {
    for (const kind of ALL_KINDS) {
      expect(RECURRING_BADGE_STYLES[kind]).toBeTruthy();
    }
  });

  it("gives each badge kind a distinct color treatment", () => {
    const styles = ALL_KINDS.map((kind) => RECURRING_BADGE_STYLES[kind]);
    expect(new Set(styles).size).toBe(ALL_KINDS.length);
  });
});
