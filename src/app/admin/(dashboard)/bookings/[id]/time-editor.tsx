"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getWindowsForDate } from "@/lib/booking-hours";
import { windowLabel } from "@/lib/validations/booking-schema";
import { isPreLifecycle } from "@/lib/time-proposal-validation";
import type { BookingStatus } from "@/types/database.types";
import { approveRequestedTime, clearProposedTime, markTimesConfirmed, saveProposedTime } from "./actions";

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function TimeEditor({
  bookingId,
  status,
  preferredPickupDate,
  preferredPickupTime,
  preferredDeliveryDate,
  preferredDeliveryTime,
  confirmedPickupDate,
  confirmedPickupTime,
  confirmedDeliveryDate,
  confirmedDeliveryTime,
}: {
  bookingId: string;
  status: BookingStatus;
  preferredPickupDate: string;
  preferredPickupTime: string;
  preferredDeliveryDate: string | null;
  preferredDeliveryTime: string | null;
  confirmedPickupDate: string | null;
  confirmedPickupTime: string | null;
  confirmedDeliveryDate: string | null;
  confirmedDeliveryTime: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [pickupDate, setPickupDate] = useState(confirmedPickupDate ?? preferredPickupDate);
  const [pickupTime, setPickupTime] = useState(confirmedPickupTime ?? preferredPickupTime);
  const [deliveryDate, setDeliveryDate] = useState(confirmedDeliveryDate ?? preferredDeliveryDate ?? "");
  const [deliveryTime, setDeliveryTime] = useState(confirmedDeliveryTime ?? preferredDeliveryTime ?? "");

  const hasProposed = Boolean(confirmedPickupDate && confirmedPickupTime);
  const hasCompleteProposal = Boolean(
    confirmedPickupDate && confirmedPickupTime && confirmedDeliveryDate && confirmedDeliveryTime
  );
  const timeLabel = status === "pending" ? "Proposed time 建议时间" : "Confirmed time 已确认时间";
  // Once a booking has physically progressed past pickup, the pending<->confirmed
  // negotiation is over — only a plain correction action remains available.
  const isLocked = !isPreLifecycle(status);
  const saveButtonLabel = isLocked ? "Update Confirmed Times 更新已确认时间" : "Save Proposed Time 保存建议时间";

  function run(action: () => Promise<{ error: string | null }>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else {
        toast.success(successMessage);
        setEditing(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <div className="text-muted-foreground">Pickup requested 客户请求取件</div>
          <div>
            {formatDate(preferredPickupDate)} · {windowLabel(preferredPickupTime)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Delivery requested 客户请求送件</div>
          <div>
            {preferredDeliveryDate
              ? `${formatDate(preferredDeliveryDate)} · ${windowLabel(preferredDeliveryTime)}`
              : "—"}
          </div>
        </div>
      </div>

      {hasProposed && (
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">{timeLabel} — pickup</div>
            <div>
              {formatDate(confirmedPickupDate)} · {windowLabel(confirmedPickupTime)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{timeLabel} — delivery</div>
            <div>
              {confirmedDeliveryDate
                ? `${formatDate(confirmedDeliveryDate)} · ${windowLabel(confirmedDeliveryTime)}`
                : "—"}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!isLocked && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => approveRequestedTime(bookingId), "Approved the requested time.")}
          >
            Approve Requested Time 批准请求时间
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => setEditing((v) => !v)}>
          {saveButtonLabel}
        </Button>
        {!isLocked && hasCompleteProposal && status === "pending" && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => markTimesConfirmed(bookingId), "Marked times confirmed.")}
          >
            Mark Times Confirmed 标记时间已确认
          </Button>
        )}
        {!isLocked && hasProposed && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => clearProposedTime(bookingId), "Cleared the proposed time.")}
          >
            Clear Proposed Time 清除建议时间
          </Button>
        )}
      </div>

      {editing && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="proposed-pickup-date">Pickup date 取件日期</Label>
              <Input
                id="proposed-pickup-date"
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pickup window 取件时段</Label>
              <Select value={pickupTime} onValueChange={setPickupTime}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getWindowsForDate(pickupDate, { excludePast: false }).map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proposed-delivery-date">Delivery date 送件日期</Label>
              <Input
                id="proposed-delivery-date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Delivery window 送件时段</Label>
              <Select value={deliveryTime} onValueChange={setDeliveryTime}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getWindowsForDate(deliveryDate, { excludePast: false }).map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={isPending}
              onClick={() =>
                run(
                  () =>
                    saveProposedTime(bookingId, {
                      confirmedPickupDate: pickupDate,
                      confirmedPickupTime: pickupTime,
                      confirmedDeliveryDate: deliveryDate,
                      confirmedDeliveryTime: deliveryTime,
                    }),
                  isLocked ? "Updated the confirmed times." : "Saved the proposed time."
                )
              }
            >
              Save 保存
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setEditing(false)}>
              Cancel 取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
