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
import type { BookingStatus } from "@/types/database.types";
import { updateBookingStatus } from "./actions";

const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = [
  { value: "pending", label: "Pending 待处理" },
  { value: "confirmed", label: "Confirmed 已确认" },
  { value: "picked_up", label: "Picked Up 已取件" },
  { value: "ready_for_delivery", label: "Ready for Delivery 待送件" },
  { value: "out_for_delivery", label: "Out for Delivery 配送中" },
  { value: "completed", label: "Completed 已完成" },
  { value: "cancelled", label: "Cancelled 已取消" },
];

export function StatusSelect({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  function applyChange(next: BookingStatus) {
    startTransition(async () => {
      const result = await updateBookingStatus(bookingId, next);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Status updated.");
      }
    });
  }

  function handleChange(next: string) {
    if (next === "cancelled") {
      setConfirmingCancel(true);
      return;
    }
    applyChange(next as BookingStatus);
  }

  return (
    <>
      <Select value={status} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger size="sm" className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={confirmingCancel} onOpenChange={setConfirmingCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking? 取消此预约？</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the booking as cancelled. You can change the status again later if
              needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Never mind 不要</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmingCancel(false);
                applyChange("cancelled");
              }}
            >
              Yes, cancel it 是，取消
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
