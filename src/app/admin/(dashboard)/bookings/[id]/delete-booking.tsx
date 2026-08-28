"use client";

import { useTransition, useState } from "react";
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
import { deleteBooking } from "./actions";

export function DeleteBooking({
  bookingId,
  customerName,
}: {
  bookingId: string;
  customerName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBooking(bookingId);
      // A successful delete redirects server-side and never returns here —
      // reaching this line means it failed.
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <h2 className="font-display text-base font-semibold text-destructive">
        Danger Zone 危险操作区
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Permanently deletes this booking and everything on it — not the normal way to clean up a
        finished order. For routine cleanup, mark it Completed or Cancelled instead; it will stay
        visible under Archived. 永久删除此预约及其全部信息，此操作无法撤销。日常清理请改用&ldquo;已完成&rdquo;或&ldquo;已取消&rdquo;状态，这类预约仍可在&ldquo;已归档&rdquo;中查看。
      </p>
      <Button
        type="button"
        variant="destructive"
        className="mt-3"
        disabled={isPending}
        onClick={() => setConfirming(true)}
      >
        Delete This Booking Permanently 永久删除此预约
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Permanently delete {customerName}&apos;s booking? 永久删除{customerName}的预约？
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The booking, its quote, and its notes will be gone completely —
              not archived, not recoverable. 此操作无法撤销，该预约的报价和备注将被彻底删除，无法恢复，也不会归档保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Never mind 不要</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleDelete}>
              Yes, delete permanently 是，永久删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
