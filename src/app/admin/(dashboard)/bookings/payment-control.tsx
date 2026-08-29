"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PaymentMethod } from "@/types/database.types";
import { markBookingPaid, markBookingUnpaid } from "./actions";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash 现金",
  zelle: "Zelle",
};

// The one mechanism for marking payment everywhere it appears — the
// bookings table, the Today board, and the detail page all render this same
// component rather than each having their own paid/unpaid control.
export function PaymentControl({
  bookingId,
  paid,
  paymentMethod,
}: {
  bookingId: string;
  paid: boolean;
  paymentMethod: PaymentMethod | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleMarkPaid(method: PaymentMethod) {
    startTransition(async () => {
      const result = await markBookingPaid(bookingId, method);
      if (result.error) toast.error(result.error);
      else toast.success("Marked as paid.");
    });
  }

  function handleMarkUnpaid() {
    startTransition(async () => {
      const result = await markBookingUnpaid(bookingId);
      if (result.error) toast.error(result.error);
      else toast.success("Marked as unpaid.");
    });
  }

  if (paid) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="border-green-200 bg-green-50 text-green-900">
          Paid 已付款{paymentMethod && ` · ${METHOD_LABEL[paymentMethod]}`}
        </Badge>
        <Button variant="outline" size="sm" disabled={isPending} onClick={handleMarkUnpaid}>
          Mark Unpaid 标记未付款
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Unpaid 未付款</span>
      <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleMarkPaid("cash")}>
        Cash 现金
      </Button>
      <Button variant="outline" size="sm" disabled={isPending} onClick={() => handleMarkPaid("zelle")}>
        Zelle
      </Button>
    </div>
  );
}
