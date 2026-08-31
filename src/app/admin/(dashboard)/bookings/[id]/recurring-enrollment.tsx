"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getBrooklynToday,
  getStandardFlexibleDeliveryWindows,
  getWindowsForDate,
} from "@/lib/booking-hours";
import { bookingRecurringOfferTextHref } from "@/lib/booking-links";
import { advanceToDueDate, cadenceDays, nextDayDeliveryDate } from "@/lib/recurring-schedule";
import { RecurringBadge } from "../recurring-badge";
import type { RecurringFrequency, RecurringScheduleStatus } from "@/types/database.types";
import { setUpRecurringSchedule } from "./actions";

function formatDateDisplay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly 每周" },
  { value: "every_two_weeks", label: "Every 2 Weeks 每两周" },
];

export function RecurringEnrollment({
  bookingId,
  customerName,
  customerPhone,
  eligible,
  existingSchedule,
  defaultPickupDate,
  defaultPickupTime,
  defaultDeliveryTime,
}: {
  bookingId: string;
  customerName: string;
  customerPhone: string;
  eligible: boolean;
  existingSchedule: { status: RecurringScheduleStatus; frequency: RecurringFrequency } | null;
  defaultPickupDate: string | null;
  defaultPickupTime: string | null;
  defaultDeliveryTime: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [enrolling, setEnrolling] = useState(false);
  const [frequency, setFrequency] = useState<RecurringFrequency>("weekly");
  // Suggests the same day-of-week/time the customer is already used to,
  // advanced forward to the next real occurrence — a sensible starting
  // point staff can freely change, not a requirement. Computed once (not
  // recomputed if `frequency` changes afterward) so switching the
  // dropdown never silently rewrites a date staff already reviewed.
  const [pickupDate, setPickupDate] = useState(() => {
    if (!defaultPickupDate) return "";
    return advanceToDueDate(defaultPickupDate, "weekly", getBrooklynToday());
  });
  const [pickupTime, setPickupTime] = useState(defaultPickupTime ?? "");
  const [deliveryTime, setDeliveryTime] = useState(defaultDeliveryTime ?? "");
  const [instructions, setInstructions] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const deliveryDate = pickupDate ? nextDayDeliveryDate(pickupDate) : "";
  const pickupWindowOptions = pickupDate ? getWindowsForDate(pickupDate) : [];
  const deliveryWindowOptions =
    pickupDate && pickupTime ? getStandardFlexibleDeliveryWindows(pickupDate, pickupTime, deliveryDate) : [];

  function handleSubmit() {
    startTransition(async () => {
      const result = await setUpRecurringSchedule(bookingId, {
        frequency,
        firstPickupDate: pickupDate,
        pickupTime,
        deliveryTime,
        recurringInstructions: instructions,
        consentConfirmed,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Recurring pickup set up.");
        setEnrolling(false);
      }
    });
  }

  if (existingSchedule) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <RecurringBadge status={existingSchedule.status} frequency={existingSchedule.frequency} />
        <Link href="/admin/recurring" className="text-sm text-primary hover:underline">
          Manage recurring schedule 管理定期服务
        </Link>
      </div>
    );
  }

  if (!eligible) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <a href={bookingRecurringOfferTextHref(customerPhone, customerName)}>
            Text Thank You &amp; Recurring Offer 感谢及定期服务短信
          </a>
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => setEnrolling((v) => !v)}>
          Set Up Recurring Pickup 设置定期取件
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Text Thank You &amp; Recurring Offer opens a prefilled message in your phone&apos;s texting app —
        nothing is sent automatically. Only set up the schedule below after the customer has actually
        agreed by text or phone.
        点击&ldquo;感谢及定期服务短信&rdquo;会在手机短信应用中打开预填信息——不会自动发送。只有在客户通过短信或电话明确同意后，才可在下方设置定期服务。
      </p>

      {enrolling && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Frequency 频率</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Every {cadenceDays(frequency)} days starting from the first pickup date below.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recurring-first-pickup-date">First pickup date 首次取件日期</Label>
              <Input
                id="recurring-first-pickup-date"
                type="date"
                min={getBrooklynToday()}
                value={pickupDate}
                onChange={(e) => {
                  setPickupDate(e.target.value);
                  setPickupTime("");
                  setDeliveryTime("");
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pickup window 取件时段</Label>
              <Select
                value={pickupTime}
                onValueChange={(v) => {
                  setPickupTime(v);
                  setDeliveryTime("");
                }}
                disabled={!pickupDate}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder={pickupDate ? "Choose a window" : "Choose a date first"} />
                </SelectTrigger>
                <SelectContent>
                  {pickupWindowOptions.map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Delivery window 送件时段</Label>
              <p className="text-xs text-muted-foreground">
                {deliveryDate ? `${formatDateDisplay(deliveryDate)} — next day after pickup` : "—"}
              </p>
              <Select value={deliveryTime} onValueChange={setDeliveryTime} disabled={deliveryWindowOptions.length === 0}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder={pickupTime ? "Choose a window" : "Choose a pickup window first"} />
                </SelectTrigger>
                <SelectContent>
                  {deliveryWindowOptions.map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recurring-instructions">Recurring instructions (optional) 定期服务备注</Label>
            <Textarea
              id="recurring-instructions"
              rows={2}
              placeholder="Gate code, drop-off preference, anything staff should remember every time"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="recurring-consent-confirmed"
              className="mt-0.5"
              checked={consentConfirmed}
              onCheckedChange={(checked) => setConsentConfirmed(checked === true)}
            />
            <Label htmlFor="recurring-consent-confirmed" className="text-sm font-normal leading-snug">
              Customer agreed to recurring service by text or phone.
              <br />
              客户已通过短信或电话同意定期服务。
            </Label>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={isPending || !pickupDate || !pickupTime || !deliveryTime || !consentConfirmed}
              onClick={handleSubmit}
            >
              Save Recurring Schedule 保存定期服务
            </Button>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setEnrolling(false)}>
              Cancel 取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
