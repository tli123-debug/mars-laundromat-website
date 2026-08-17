"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { updateBookingPaid } from "./actions";

export function PaidCheckbox({
  bookingId,
  paid,
}: {
  bookingId: string;
  paid: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    startTransition(async () => {
      const result = await updateBookingPaid(bookingId, checked);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(checked ? "Marked as paid." : "Marked as unpaid.");
      }
    });
  }

  return (
    <Checkbox
      checked={paid}
      onCheckedChange={(checked) => handleChange(checked === true)}
      disabled={isPending}
      aria-label={paid ? "Mark as unpaid" : "Mark as paid"}
    />
  );
}
