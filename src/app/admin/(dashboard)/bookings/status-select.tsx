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
import { BOOKING_STATUS_STYLES } from "@/lib/booking-status-styles";
import { cn } from "@/lib/utils";
import {
  canAdvanceToStatus,
  hasCompleteProposedTime,
  hasRecordedPayment,
} from "@/lib/time-proposal-validation";
import type { BookingStatus, PaymentMethod } from "@/types/database.types";
import { updateBookingStatus } from "./actions";

const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = [
  { value: "pending", label: "Pending 待处理" },
  { value: "confirmed", label: "Confirmed 已确认" },
  { value: "picked_up", label: "Picked Up 已取件" },
  { value: "ready_for_delivery", label: "Ready for Delivery 待送件" },
  { value: "completed", label: "Completed 已完成" },
  { value: "cancelled", label: "Cancelled 已取消" },
];

export function StatusSelect({
  bookingId,
  status,
  confirmedPickupDate,
  confirmedPickupTime,
  confirmedDeliveryDate,
  confirmedDeliveryTime,
  paid,
  paymentMethod,
  showGuidance = true,
}: {
  bookingId: string;
  status: BookingStatus;
  confirmedPickupDate: string | null;
  confirmedPickupTime: string | null;
  confirmedDeliveryDate: string | null;
  confirmedDeliveryTime: string | null;
  paid: boolean;
  paymentMethod: PaymentMethod | null;
  showGuidance?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const hasConfirmedSchedule = hasCompleteProposedTime({
    confirmed_pickup_date: confirmedPickupDate,
    confirmed_pickup_time: confirmedPickupTime,
    confirmed_delivery_date: confirmedDeliveryDate,
    confirmed_delivery_time: confirmedDeliveryTime,
  });
  const hasPayment = hasRecordedPayment({ paid, payment_method: paymentMethod });
  const statusPrerequisites = {
    confirmed_pickup_date: confirmedPickupDate,
    confirmed_pickup_time: confirmedPickupTime,
    confirmed_delivery_date: confirmedDeliveryDate,
    confirmed_delivery_time: confirmedDeliveryTime,
    paid,
    payment_method: paymentMethod,
  };

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
    <div className="grid gap-1">
      <Select value={status} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger size="sm" className={cn("w-[180px]", BOOKING_STATUS_STYLES[status].trigger)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={!canAdvanceToStatus(option.value, statusPrerequisites)}
              className={BOOKING_STATUS_STYLES[option.value].item}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showGuidance && !hasConfirmedSchedule && (
        <p className="max-w-[190px] whitespace-normal break-words text-xs leading-snug text-muted-foreground">
          Confirm both times to unlock later statuses. 确认取件和送件时间后可更改后续状态。
        </p>
      )}
      {showGuidance && hasConfirmedSchedule && !hasPayment && status !== "completed" && (
        <p className="max-w-[190px] whitespace-normal break-words text-xs leading-snug text-muted-foreground">
          Record Cash or Zelle payment before completing. 完成前请记录现金或 Zelle 付款。
        </p>
      )}

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
    </div>
  );
}
