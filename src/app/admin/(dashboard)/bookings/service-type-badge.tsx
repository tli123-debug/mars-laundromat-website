import { Badge } from "@/components/ui/badge";
import { SERVICE_TYPE_BADGE_STYLES, SERVICE_TYPE_LABELS } from "@/lib/service-type";
import type { ServiceType } from "@/types/database.types";

export function ServiceTypeBadge({ serviceType }: { serviceType: ServiceType }) {
  return (
    <Badge variant="outline" className={SERVICE_TYPE_BADGE_STYLES[serviceType]}>
      {SERVICE_TYPE_LABELS[serviceType]}
    </Badge>
  );
}
