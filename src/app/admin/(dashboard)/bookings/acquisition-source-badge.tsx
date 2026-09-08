import { Badge } from "@/components/ui/badge";
import { ACQUISITION_SOURCE_ADMIN_LABELS, ACQUISITION_SOURCE_NOT_PROVIDED_LABEL } from "@/lib/acquisition-source";
import type { AcquisitionSource } from "@/types/database.types";

/**
 * Deliberately subdued — plain muted-gray, not a color-coded outline like
 * ServiceTypeBadge/StatusSelect/PaymentControl. Acquisition source is
 * reference metadata staff might glance at, not an operational state they
 * act on, so it shouldn't visually compete with the badges that are.
 */
export function AcquisitionSourceBadge({
  acquisitionSource,
}: {
  acquisitionSource: AcquisitionSource | null;
}) {
  return (
    <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
      {acquisitionSource ? ACQUISITION_SOURCE_ADMIN_LABELS[acquisitionSource] : ACQUISITION_SOURCE_NOT_PROVIDED_LABEL}
    </Badge>
  );
}
