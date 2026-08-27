"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { calculateQuote } from "@/lib/pricing/calculate-quote";
import { calculateDryCleaningEffectiveCharge, DRY_CLEANING_MINIMUM_CENTS } from "@/lib/pricing/dry-cleaning-charge";
import { canApplySameDayFee, canMarkQuoteSentForServiceType, dollarsToCents } from "@/lib/quote-validation";
import { serviceTypeIncludesDryCleaning, serviceTypeIncludesWashAndFold } from "@/lib/service-type";
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

  const includesWashAndFold = serviceTypeIncludesWashAndFold(booking.service_type);
  const includesDryCleaning = serviceTypeIncludesDryCleaning(booking.service_type);
  // Same-Day Rush only ever applies to a wash_and_fold-only booking — 'both'
  // never offers it, even though it also bills a wash-and-fold portion.
  const showSameDayOption = booking.service_type === "wash_and_fold";
  const isSameDay = booking.service_speed === "same_day";

  const [weight, setWeight] = useState(booking.actual_weight_lb?.toString() ?? "");
  const [sameDayApproved, setSameDayApproved] = useState((booking.same_day_fee_cents ?? 0) > 0);
  const [dryCleaningSubtotal, setDryCleaningSubtotal] = useState(
    booking.dry_cleaning_item_subtotal_cents ? (booking.dry_cleaning_item_subtotal_cents / 100).toFixed(2) : ""
  );
  const [dryCleaningNotes, setDryCleaningNotes] = useState(booking.dry_cleaning_notes ?? "");
  const [surchargeAmount, setSurchargeAmount] = useState(
    booking.surcharge_total_cents ? (booking.surcharge_total_cents / 100).toFixed(2) : ""
  );
  const [surchargeNotes, setSurchargeNotes] = useState(booking.surcharge_notes ?? "");

  const weightNum = Number(weight);
  const weightValid =
    !includesWashAndFold || (weight.trim() !== "" && Number.isFinite(weightNum) && weightNum > 0);

  const dryCleaningSubtotalNum = Number(dryCleaningSubtotal);
  const dryCleaningSubtotalValid =
    !includesDryCleaning ||
    (dryCleaningSubtotal.trim() !== "" && Number.isFinite(dryCleaningSubtotalNum) && dryCleaningSubtotalNum > 0);

  const surchargeNum = surchargeAmount.trim() === "" ? null : Number(surchargeAmount);
  const surchargeValid = surchargeNum === null || (Number.isFinite(surchargeNum) && surchargeNum >= 0);

  const previewValid = weightValid && dryCleaningSubtotalValid && surchargeValid;
  // Re-derives eligibility from the actual booking speed rather than trusting
  // the checkbox alone — the same guard the server applies, so the preview
  // can't show a fee the server would reject.
  const sameDayFeeApplies = canApplySameDayFee(booking.service_speed, sameDayApproved);

  const laundryPreview =
    previewValid && includesWashAndFold
      ? calculateQuote({ actualWeightLb: weightNum, sameDayApproved: sameDayFeeApplies })
      : null;

  const dryCleaningSubtotalCentsPreview =
    previewValid && includesDryCleaning ? dollarsToCents(dryCleaningSubtotalNum) : null;
  const dryCleaningEffectiveChargeCentsPreview =
    dryCleaningSubtotalCentsPreview !== null
      ? calculateDryCleaningEffectiveCharge(booking.service_type, dryCleaningSubtotalCentsPreview)
      : null;

  const surchargeCentsPreview = previewValid && surchargeNum ? dollarsToCents(surchargeNum) : 0;

  const totalCentsPreview = previewValid
    ? (laundryPreview?.laundryChargeCents ?? 0) +
      (laundryPreview?.sameDayFeeCents ?? 0) +
      (dryCleaningEffectiveChargeCentsPreview ?? 0) +
      surchargeCentsPreview
    : null;

  function handleSave() {
    if (!weightValid) {
      toast.error("Enter a valid weight first.");
      return;
    }
    if (!dryCleaningSubtotalValid) {
      toast.error("Enter a valid dry-cleaning item subtotal first.");
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
        actualWeightLb: includesWashAndFold ? weightNum : undefined,
        dryCleaningItemSubtotalCents: includesDryCleaning ? dollarsToCents(dryCleaningSubtotalNum) : undefined,
        dryCleaningNotes: includesDryCleaning ? dryCleaningNotes.trim() || undefined : undefined,
        sameDayApproved: sameDayFeeApplies,
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

  const canSend = canMarkQuoteSentForServiceType({
    quote_status: booking.quote_status,
    service_type: booking.service_type,
    actual_weight_lb: booking.actual_weight_lb,
    dry_cleaning_item_subtotal_cents: booking.dry_cleaning_item_subtotal_cents,
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {includesWashAndFold && (
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
        )}
        {showSameDayOption && (
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
        )}
        {includesDryCleaning && (
          <div className="space-y-1.5">
            <Label htmlFor="dry-cleaning-subtotal">Dry-cleaning item subtotal 干洗项目小计</Label>
            <Input
              id="dry-cleaning-subtotal"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={dryCleaningSubtotal}
              onChange={(e) => setDryCleaningSubtotal(e.target.value)}
            />
          </div>
        )}
        {includesDryCleaning && (
          <div className="space-y-1.5">
            <Label htmlFor="dry-cleaning-notes">Dry-cleaning notes 干洗备注</Label>
            <Textarea
              id="dry-cleaning-notes"
              value={dryCleaningNotes}
              onChange={(e) => setDryCleaningNotes(e.target.value)}
            />
          </div>
        )}
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

      {totalCentsPreview !== null && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          {laundryPreview && (
            <div>
              Laundry 洗衣费: {formatCents(laundryPreview.laundryChargeCents)} ({laundryPreview.billableWeightLb} lb
              billable)
            </div>
          )}
          {laundryPreview && laundryPreview.sameDayFeeCents > 0 && (
            <div>Same-Day 加急费: {formatCents(laundryPreview.sameDayFeeCents)}</div>
          )}
          {includesDryCleaning && dryCleaningSubtotalCentsPreview !== null && (
            <>
              <div>Dry-cleaning item subtotal 干洗项目小计: {formatCents(dryCleaningSubtotalCentsPreview)}</div>
              {booking.service_type === "dry_cleaning" && dryCleaningSubtotalCentsPreview < DRY_CLEANING_MINIMUM_CENTS && (
                <div>
                  Minimum adjustment 最低消费差额: +
                  {formatCents(DRY_CLEANING_MINIMUM_CENTS - dryCleaningSubtotalCentsPreview)} (to reach the{" "}
                  {formatCents(DRY_CLEANING_MINIMUM_CENTS)} minimum)
                </div>
              )}
              <div>Dry-cleaning charge 干洗费: {formatCents(dryCleaningEffectiveChargeCentsPreview ?? 0)}</div>
            </>
          )}
          {surchargeCentsPreview > 0 && <div>Surcharge 附加费: {formatCents(surchargeCentsPreview)}</div>}
          <div className="font-medium">Total 总计: {formatCents(totalCentsPreview)}</div>
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
