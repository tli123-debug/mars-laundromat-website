"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACQUISITION_SOURCE_ADMIN_LABELS,
  ACQUISITION_SOURCE_NOT_PROVIDED_LABEL,
  ACQUISITION_SOURCES,
} from "@/lib/acquisition-source";
import type { AcquisitionSource } from "@/types/database.types";
import { updateAcquisitionSource } from "./actions";

// Radix SelectItem can't take an empty-string value, so "not provided" (the
// database's null) needs its own sentinel token — translated back to null
// in handleChange before it ever reaches the Server Action.
const NOT_PROVIDED_VALUE = "not_provided";

export function AcquisitionSourceSelect({
  bookingId,
  acquisitionSource,
}: {
  bookingId: string;
  acquisitionSource: AcquisitionSource | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    const nextSource = next === NOT_PROVIDED_VALUE ? null : (next as AcquisitionSource);
    startTransition(async () => {
      const result = await updateAcquisitionSource(bookingId, nextSource);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Acquisition source updated.");
      }
    });
  }

  return (
    <Select value={acquisitionSource ?? NOT_PROVIDED_VALUE} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" className="w-full sm:w-[280px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NOT_PROVIDED_VALUE}>{ACQUISITION_SOURCE_NOT_PROVIDED_LABEL}</SelectItem>
        {ACQUISITION_SOURCES.map((source) => (
          <SelectItem key={source} value={source}>
            {ACQUISITION_SOURCE_ADMIN_LABELS[source]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
