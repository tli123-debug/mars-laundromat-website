"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { RecurringBadge } from "@/app/admin/(dashboard)/bookings/recurring-badge";
import { windowLabel } from "@/lib/validations/booking-schema";
import { nextDayDeliveryDate } from "@/lib/recurring-schedule";
import type { Database } from "@/types/database.types";
import { cancelSchedule, pauseSchedule, resumeSchedule, skipNextOccurrence } from "./actions";

type ScheduleRow = Database["public"]["Tables"]["recurring_schedules"]["Row"];

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type ConfirmKind = "pause" | "skip" | "cancel" | null;

export function ScheduleCard({ schedule }: { schedule: ScheduleRow }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<ConfirmKind>(null);

  function run(action: () => Promise<{ error: string | null }>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else toast.success(successMessage);
    });
  }

  function handleConfirm() {
    const kind = confirming;
    setConfirming(null);
    if (kind === "pause") run(() => pauseSchedule(schedule.id), "Schedule paused.");
    else if (kind === "skip") run(() => skipNextOccurrence(schedule.id), "Skipped the next occurrence.");
    else if (kind === "cancel") run(() => cancelSchedule(schedule.id), "Schedule cancelled.");
  }

  const deliveryDate = nextDayDeliveryDate(schedule.next_pickup_date);

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{schedule.customer_name}</span>
            <RecurringBadge status={schedule.status} frequency={schedule.frequency} />
          </div>
          <div className="text-sm text-muted-foreground">{schedule.customer_phone}</div>
          <div className="text-sm text-muted-foreground">{schedule.address}</div>
        </div>
        <Link
          href={`/admin/bookings/${schedule.source_booking_id}`}
          className="text-sm text-primary hover:underline"
        >
          Source booking 来源预约 →
        </Link>
      </div>

      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <div className="text-muted-foreground">Next pickup 下次取件</div>
          <div>
            {formatDate(schedule.next_pickup_date)} · {windowLabel(schedule.pickup_time)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Next delivery 下次送件</div>
          <div>
            {formatDate(deliveryDate)} · {windowLabel(schedule.delivery_time)}
          </div>
        </div>
      </div>

      {schedule.recurring_instructions && (
        <div className="mt-3 text-sm">
          <span className="text-muted-foreground">Instructions 备注: </span>
          {schedule.recurring_instructions}
          {schedule.recurring_instructions_zh && (
            <div className="mt-0.5 text-muted-foreground/80">{schedule.recurring_instructions_zh}</div>
          )}
        </div>
      )}

      <div className="mt-3 text-xs text-muted-foreground">
        Created {formatDateTime(schedule.created_at)} · Updated {formatDateTime(schedule.updated_at)}
      </div>

      {schedule.status !== "cancelled" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {schedule.status === "active" && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => setConfirming("pause")}
              >
                Pause 暂停
              </Button>
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => setConfirming("skip")}>
                Skip Next 跳过下次
              </Button>
            </>
          )}
          {schedule.status === "paused" && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => resumeSchedule(schedule.id), "Schedule resumed.")}
            >
              Resume 恢复
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => setConfirming("cancel")}>
            Cancel Schedule 取消定期服务
          </Button>
        </div>
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          {confirming === "pause" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Pause this recurring schedule? 暂停此定期服务？</AlertDialogTitle>
                <AlertDialogDescription>
                  No new occurrences will be generated while paused. If the next pickup has already been
                  generated as a booking, that booking is not affected — it stays in the normal booking
                  workflow and still needs to be handled like any other order.
                  暂停后不会生成新的取件安排。如果下次取件已经生成为预约，该预约不受影响，仍会按正常流程处理。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-3">
                <AlertDialogCancel className="!whitespace-normal">Never mind 不要</AlertDialogCancel>
                <AlertDialogAction className="!whitespace-normal" onClick={handleConfirm}>
                  Yes, pause it 是，暂停
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {confirming === "skip" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Skip the next occurrence? 跳过下次取件？</AlertDialogTitle>
                <AlertDialogDescription>
                  If the next pickup hasn&apos;t been generated yet, this moves the schedule forward to the
                  following occurrence. If it has already been generated and is still pending, that booking
                  will be cancelled (not deleted) — the schedule&apos;s date was already advanced past it
                  when that booking was created, so it doesn&apos;t move again. If it has already progressed
                  further (confirmed, picked up, etc.), this will be rejected — handle that booking directly
                  instead.
                  如果下次取件尚未生成，此操作会将安排推进到下一次。如果已生成且仍为待处理状态，该预约将被取消（不会删除）——安排日期在生成该预约时已经推进过，因此不会再次推进。如果已进一步处理（已确认、已取件等），此操作将被拒绝，请直接处理该预约。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-3">
                <AlertDialogCancel className="!whitespace-normal">Never mind 不要</AlertDialogCancel>
                <AlertDialogAction className="!whitespace-normal" onClick={handleConfirm}>
                  Yes, skip it 是，跳过
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {confirming === "cancel" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this recurring schedule? 取消此定期服务？</AlertDialogTitle>
                <AlertDialogDescription>
                  This ends the standing arrangement — no more occurrences will ever be generated from it.
                  It does not alter any booking already generated from this schedule; those stay exactly as
                  they are. This can&apos;t be undone, but a new schedule can always be set up again later if
                  the customer wants to restart.
                  这将结束该定期安排，之后不会再生成新的取件预约。此操作不会影响此安排已生成的任何预约，这些预约将保持不变。此操作无法撤销，但日后如客户希望恢复，仍可重新设置新的定期服务。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-3">
                <AlertDialogCancel className="!whitespace-normal">Never mind 不要</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  className="!whitespace-normal"
                  onClick={handleConfirm}
                >
                  Yes, cancel it 是，取消
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
