"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SERVICE_TYPE_LABELS } from "@/lib/service-type";
import type { QuoteStatus, ServiceType } from "@/types/database.types";
import { changeServiceType } from "./actions";

const SERVICE_TYPE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: "wash_and_fold", label: SERVICE_TYPE_LABELS.wash_and_fold },
  { value: "dry_cleaning", label: SERVICE_TYPE_LABELS.dry_cleaning },
  { value: "both", label: SERVICE_TYPE_LABELS.both },
];

export function ServiceTypeSelect({
  bookingId,
  serviceType,
  quoteStatus,
}: {
  bookingId: string;
  serviceType: ServiceType;
  quoteStatus: QuoteStatus;
}) {
  const [isPending, startTransition] = useTransition();
  // Bound to the confirmation dialog only — the Select's own displayed value
  // stays tied to the `serviceType` prop (server state), so cancelling the
  // dialog needs no explicit revert: nothing was ever locally applied.
  const [pendingServiceType, setPendingServiceType] = useState<ServiceType | null>(null);

  function confirmChange() {
    if (!pendingServiceType) return;
    const next = pendingServiceType;
    setPendingServiceType(null);
    startTransition(async () => {
      const result = await changeServiceType(bookingId, next);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Service type updated — the quote was cleared. Re-quote this booking.");
      }
    });
  }

  return (
    <>
      <Select
        value={serviceType}
        onValueChange={(next) => setPendingServiceType(next as ServiceType)}
        disabled={isPending}
      >
        <SelectTrigger size="sm" className="w-[240px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SERVICE_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog
        open={pendingServiceType !== null}
        onOpenChange={(open) => !open && setPendingServiceType(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change service type? 更改服务类型？</AlertDialogTitle>
            <AlertDialogDescription>
              This clears the current quote — weight, dry-cleaning subtotal, same-day fee, and surcharge
              are all reset, and you&apos;ll need to re-quote this booking from scratch.
              {quoteStatus === "sent" && (
                <>
                  {" "}
                  A quote was already sent to the customer — that number is no longer correct, so
                  you&apos;ll need to recalculate and let them know the corrected total.
                </>
              )}{" "}
              Also double-check the pickup and delivery times still make sense for the new service —
              they aren&apos;t changed automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Never mind 不要</AlertDialogCancel>
            <AlertDialogAction onClick={confirmChange}>Yes, change it 是，更改</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
