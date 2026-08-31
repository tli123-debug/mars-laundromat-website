import { Badge } from "@/components/ui/badge";
import { RECURRING_BADGE_LABELS, recurringBadgeKind } from "@/lib/recurring-schedule";
import { RECURRING_BADGE_STYLES } from "@/lib/recurring-schedule-styles";
import type { RecurringFrequency, RecurringScheduleStatus } from "@/types/database.types";

/**
 * Always derived from a real schedule's (status, frequency) — never a
 * manually-set boolean. Callers decide WHETHER to render this (e.g. only
 * for an active/paused schedule on a source booking's own detail page);
 * this component only decides WHICH badge, given a real pair.
 */
export function RecurringBadge({
  status,
  frequency,
}: {
  status: RecurringScheduleStatus;
  frequency: RecurringFrequency;
}) {
  const kind = recurringBadgeKind(status, frequency);
  return (
    <Badge variant="outline" className={RECURRING_BADGE_STYLES[kind]}>
      {RECURRING_BADGE_LABELS[kind]}
    </Badge>
  );
}
