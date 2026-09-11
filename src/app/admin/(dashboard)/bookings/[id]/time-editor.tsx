"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getWindowsForDate } from "@/lib/booking-hours";
import { windowLabel } from "@/lib/validations/booking-schema";
import {
  hasCompleteProposedTime,
  isPreLifecycle,
  proposedScheduleMatchesPreferred,
} from "@/lib/time-proposal-validation";
import {
  bookingPickupConfirmationTextHref,
  bookingProposedDeliveryTextHref,
  bookingProposedScheduleTextHref,
} from "@/lib/booking-links";
import type { BookingStatus, ServiceType } from "@/types/database.types";
import {
  approveRequestedTime,
  clearProposedTime,
  markTimesConfirmed,
  saveProposedDeliveryTime,
  saveProposedTime,
} from "./actions";

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
  customerName,
  customerPhone,
  serviceType,
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
  customerName: string;
  customerPhone: string;
  serviceType: ServiceType;
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
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState(false);

  // Pre-pickup full-schedule proposal (pickup + delivery together).
  const [pickupDate, setPickupDate] = useState(confirmedPickupDate ?? preferredPickupDate);
  const [pickupTime, setPickupTime] = useState(confirmedPickupTime ?? preferredPickupTime);
  const [deliveryDate, setDeliveryDate] = useState(confirmedDeliveryDate ?? preferredDeliveryDate ?? "");
  const [deliveryTime, setDeliveryTime] = useState(confirmedDeliveryTime ?? preferredDeliveryTime ?? "");

  // Post-pickup, delivery-only proposal. Lives only in this component's own
  // state until "Confirm New Delivery Time" is clicked — see
  // saveProposedDeliveryTime() in ./actions.ts for why it must not be saved
  // any earlier than that (the current confirmed delivery stays the live,
  // active one until the customer has actually agreed to the replacement).
  const [proposedDeliveryDate, setProposedDeliveryDate] = useState(confirmedDeliveryDate ?? "");
  const [proposedDeliveryTime, setProposedDeliveryTime] = useState(confirmedDeliveryTime ?? "");

  const hasProposed = Boolean(confirmedPickupDate && confirmedPickupTime);
  const hasCompleteSchedule = hasCompleteProposedTime({
    confirmed_pickup_date: confirmedPickupDate,
    confirmed_pickup_time: confirmedPickupTime,
    confirmed_delivery_date: confirmedDeliveryDate,
    confirmed_delivery_time: confirmedDeliveryTime,
  });
  const timeLabel = status === "pending" ? "Proposed time 建议时间" : "Confirmed time 已确认时间";

  const isPreLifecycleStatus = isPreLifecycle(status); // pending, confirmed
  const isPostPickup = status === "picked_up" || status === "ready_for_delivery";
  const isReadOnly = status === "completed" || status === "cancelled";

  // Whether the currently-saved confirmed schedule actually differs from
  // what the customer requested — if it doesn't, "Text Proposed Schedule"
  // would misleadingly claim an adjustment that never happened; Approve
  // Requested Time (and its own confirmation text) is the right action
  // for an unchanged schedule instead.
  const scheduleDiffersFromRequest =
    hasCompleteSchedule &&
    !proposedScheduleMatchesPreferred(
      {
        pickupDate: preferredPickupDate,
        pickupTime: preferredPickupTime,
        deliveryDate: preferredDeliveryDate,
        deliveryTime: preferredDeliveryTime,
      },
      {
        pickupDate: confirmedPickupDate!,
        pickupTime: confirmedPickupTime!,
        deliveryDate: confirmedDeliveryDate!,
        deliveryTime: confirmedDeliveryTime!,
      }
    );

  // Contextual visibility — see the "Keep the interface simple" table:
  // staff should see only the buttons relevant to this booking's current
  // stage, never every possible action at once.
  const showApproveRequestedTime = status === "pending";
  const showTextProposedSchedule = status === "pending" && hasCompleteSchedule && scheduleDiffersFromRequest;
  const showMarkTimesConfirmed = status === "pending" && hasCompleteSchedule;
  const showClearProposedTime = isPreLifecycleStatus && hasProposed;
  const showTextPickupConfirmation = status === "confirmed" && hasCompleteSchedule;

  const proposedDeliveryReady = Boolean(proposedDeliveryDate && proposedDeliveryTime);

  function run(action: () => Promise<{ error: string | null }>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else {
        toast.success(successMessage);
        setEditingSchedule(false);
        setEditingDelivery(false);
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
            <div className="text-muted-foreground">
              {timeLabel} — pickup{!isPreLifecycleStatus ? " (locked) 已锁定" : ""}
            </div>
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
        {showApproveRequestedTime && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => approveRequestedTime(bookingId), "Approved the requested time.")}
          >
            Approve Requested Time 批准请求时间
          </Button>
        )}

        {showTextProposedSchedule && (
          <Button asChild size="sm" variant="outline">
            <a
              href={bookingProposedScheduleTextHref(
                customerPhone,
                customerName,
                { date: confirmedPickupDate!, time: confirmedPickupTime! },
                { date: confirmedDeliveryDate!, time: confirmedDeliveryTime! }
              )}
            >
              Text Proposed Schedule 建议时间短信
            </a>
          </Button>
        )}

        {showMarkTimesConfirmed && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => markTimesConfirmed(bookingId), "Marked times confirmed.")}
          >
            Mark Times Confirmed 标记时间已确认
          </Button>
        )}

        {showTextPickupConfirmation && (
          <Button asChild size="sm" variant="outline">
            <a
              href={bookingPickupConfirmationTextHref(
                customerPhone,
                customerName,
                serviceType,
                { date: confirmedPickupDate!, time: confirmedPickupTime! },
                { date: confirmedDeliveryDate!, time: confirmedDeliveryTime! }
              )}
            >
              Text Pickup Confirmation 确认取件短信
            </a>
          </Button>
        )}

        {showClearProposedTime && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => clearProposedTime(bookingId), "Cleared the proposed time.")}
          >
            Clear Proposed Time 清除建议时间
          </Button>
        )}

        {isPreLifecycleStatus && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => setEditingSchedule((v) => !v)}
          >
            {editingSchedule ? "Cancel 取消" : "Propose Different Time 建议其他时间"}
          </Button>
        )}

        {isPostPickup && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => setEditingDelivery((v) => !v)}
          >
            {editingDelivery ? "Cancel 取消" : "Propose New Delivery Time 建议新送件时间"}
          </Button>
        )}
      </div>

      {showTextPickupConfirmation && (
        <p className="text-xs text-muted-foreground">
          Text Pickup Confirmation opens a prefilled message in your phone&apos;s texting app — nothing
          is sent automatically. Review it and send it there.
          点击"确认取件短信"会在手机短信应用中打开预填信息——不会自动发送，请核对后自行发送。
        </p>
      )}

      {isReadOnly && (
        <p className="text-xs text-muted-foreground">
          This booking&apos;s schedule is final and can no longer be changed.
          此预约的时间安排已最终确定，无法再更改。
        </p>
      )}

      {editingSchedule && isPreLifecycleStatus && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            1. Save Proposed Schedule 保存建议时间 · 2. Text Customer 发送短信 · 3. Mark Times
            Confirmed After Customer Agrees 客户同意后标记已确认
          </p>
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
                  "Saved the proposed schedule."
                )
              }
            >
              Save Proposed Schedule 保存建议时间
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setEditingSchedule(false)}>
              Cancel 取消
            </Button>
          </div>
        </div>
      )}

      {editingDelivery && isPostPickup && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            1. Save Proposed Delivery 保存建议送件时间 · 2. Text Customer 发送短信 · 3. Confirm New
            Delivery Time After Customer Agrees 客户同意后确认新送件时间
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Pickup (locked) 取件（已锁定）</Label>
              <p className="flex h-9 items-center text-sm text-muted-foreground">
                {confirmedPickupDate
                  ? `${formatDate(confirmedPickupDate)} · ${windowLabel(confirmedPickupTime)}`
                  : "—"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proposed-delivery-only-date">Delivery date 送件日期</Label>
              <Input
                id="proposed-delivery-only-date"
                type="date"
                value={proposedDeliveryDate}
                onChange={(e) => setProposedDeliveryDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Delivery window 送件时段</Label>
              <Select value={proposedDeliveryTime} onValueChange={setProposedDeliveryTime}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getWindowsForDate(proposedDeliveryDate, { excludePast: false }).map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {proposedDeliveryReady && (
            <Button asChild size="sm" variant="outline">
              <a
                href={bookingProposedDeliveryTextHref(customerPhone, customerName, {
                  date: proposedDeliveryDate,
                  time: proposedDeliveryTime,
                })}
              >
                Text Proposed Delivery 建议送件时间短信
              </a>
            </Button>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={isPending || !proposedDeliveryReady}
              onClick={() =>
                run(
                  () =>
                    saveProposedDeliveryTime(bookingId, {
                      confirmedDeliveryDate: proposedDeliveryDate,
                      confirmedDeliveryTime: proposedDeliveryTime,
                    }),
                  "Confirmed the new delivery time."
                )
              }
            >
              Confirm New Delivery Time 确认新送件时间
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setEditingDelivery(false)}>
              Cancel 取消
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The current confirmed delivery time stays active until you click Confirm New Delivery
            Time — texting the customer does not change it.
            在点击"确认新送件时间"之前，当前已确认的送件时间保持不变——发送短信不会更改它。
          </p>
        </div>
      )}
    </div>
  );
}
