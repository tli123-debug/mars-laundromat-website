"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { calculateQuote } from "@/lib/pricing/calculate-quote";
import { dollarsToCents } from "@/lib/quote-validation";
import type { Database } from "@/types/database.types";
import { markQuoteSent, saveQuote } from "./actions";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const QUOTE_STATUS_LABEL: Record<BookingRow["quote_status"], string> = {
  not_started: "Not started 未开始",
  draft: "Draft — not yet sent 草稿，尚未发送",
  sent: "Sent 已发送",
};

export function QuoteEditor({ booking }: { booking: BookingRow }) {
  const [isPending, startTransition] = useTransition();
  const [weight, setWeight] = useState(booking.actual_weight_lb?.toString() ?? "");
  const [sameDayApproved, setSameDayApproved] = useState((booking.same_day_fee_cents ?? 0) > 0);
  const [surchargeAmount, setSurchargeAmount] = useState(
    booking.surcharge_total_cents ? (booking.surcharge_total_cents / 100).toFixed(2) : ""
  );
  const [surchargeNotes, setSurchargeNotes] = useState(booking.surcharge_notes ?? "");

  const isSameDay = booking.service_speed === "same_day";
  const weightNum = Number(weight);
  const weightValid = weight.trim() !== "" && Number.isFinite(weightNum) && weightNum >= 0;
  const surchargeNum = surchargeAmount.trim() === "" ? null : Number(surchargeAmount);
  const surchargeValid = surchargeNum === null || (Number.isFinite(surchargeNum) && surchargeNum >= 0);

  const preview =
    weightValid && surchargeValid
      ? calculateQuote({
          actualWeightLb: weightNum,
          sameDayApproved: sameDayApproved && isSameDay,
          surcharges: surchargeNum ? [{ description: "Surcharge", amountCents: Math.round(surchargeNum * 100) }] : [],
        })
      : null;

  function handleSave() {
    if (!weightValid) {
      toast.error("Enter a valid weight first.");
      return;
    }
    if (!surchargeValid) {
      toast.error("Enter a valid surcharge amount.");
      return;
    }

    let surchargeAmountCents: number | undefined;
    if (surchargeNum !== null) {
      try {
        surchargeAmountCents = dollarsToCents(surchargeNum);
      } catch {
        toast.error("Enter a valid surcharge amount.");
        return;
      }
    }

    startTransition(async () => {
      const result = await saveQuote(booking.id, {
        actualWeightLb: weightNum,
        sameDayApproved: sameDayApproved && isSameDay,
        surchargeAmountCents,
        surchargeNotes: surchargeNotes.trim() || undefined,
      });
      if (result.error) toast.error(result.error);
      else toast.success("Quote saved as draft.");
    });
  }

  function handleMarkSent() {
    startTransition(async () => {
      const result = await markQuoteSent(booking.id);
      if (result.error) toast.error(result.error);
      else toast.success("Quote marked as sent.");
    });
  }

  const canSend = booking.quote_status === "draft" && (booking.actual_weight_lb ?? 0) > 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="actual-weight">Weight (lb) 重量</Label>
          <Input
            id="actual-weight"
            type="number"
            min="0"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Checkbox
            id="same-day-approved"
            checked={sameDayApproved}
            onCheckedChange={(checked) => setSameDayApproved(checked === true)}
            disabled={!isSameDay}
          />
          <Label htmlFor="same-day-approved">
            Same-Day fee ($10) 加急费
            {!isSameDay && <span className="text-muted-foreground">(not a Same-Day Rush booking)</span>}
          </Label>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="surcharge-amount">Surcharge amount 附加费金额</Label>
          <Input
            id="surcharge-amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={surchargeAmount}
            onChange={(e) => setSurchargeAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="surcharge-notes">Surcharge notes 附加费备注</Label>
          <Textarea
            id="surcharge-notes"
            value={surchargeNotes}
            onChange={(e) => setSurchargeNotes(e.target.value)}
          />
        </div>
      </div>

      {preview && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <div>
            Laundry 洗衣费: {formatCents(preview.laundryChargeCents)} ({preview.billableWeightLb} lb billable)
          </div>
          {preview.sameDayFeeCents > 0 && <div>Same-Day 加急费: {formatCents(preview.sameDayFeeCents)}</div>}
          {preview.surchargeTotalCents > 0 && (
            <div>Surcharge 附加费: {formatCents(preview.surchargeTotalCents)}</div>
          )}
          <div className="font-medium">Total 总计: {formatCents(preview.totalCents)}</div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={isPending} onClick={handleSave}>
          Save Quote 保存报价
        </Button>
        <Button size="sm" variant="outline" disabled={isPending || !canSend} onClick={handleMarkSent}>
          Mark Quote as Sent 标记报价已发送
        </Button>
        <span className="text-sm text-muted-foreground">{QUOTE_STATUS_LABEL[booking.quote_status]}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        This doesn&apos;t send anything automatically — text or call the customer with the total first, then
        mark it sent here.
      </p>
    </div>
  );
}
