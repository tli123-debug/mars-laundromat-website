"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bookingSchema,
  bookingFormDefaults,
  fieldsToResetOnServiceChange,
  formatDateDisplay,
  type BookingInput,
  type ServiceSpeed,
} from "@/lib/validations/booking-schema";
import {
  BOOKING_ADD_ON_OPTIONS,
  BOOKING_ADD_ONS_DEFAULT,
  composeSpecialInstructions,
  type BookingAddOns,
} from "@/lib/booking-addons";
import {
  addDays,
  getBrooklynToday,
  getSameDayEligibleWindows,
  getStandardFlexibleDeliveryWindows,
  getWindowsForDate,
  isSameDayEligible,
  SAME_DAY_DELIVERY_WINDOW_START,
} from "@/lib/booking-hours";
import { getDryCleaningDeliveryDate } from "@/lib/dry-cleaning-schedule";
import { SAME_DAY_FEE_CENTS } from "@/lib/pricing/calculate-quote";
import { formatDollars } from "@/lib/format-currency";
import { booking as bookingContent } from "@/content/booking";
import { createBooking } from "@/app/(site)/book/actions";
import { ACQUISITION_SOURCE_FORM_OPTIONS, resolveAcquisitionSourceFormDefault } from "@/lib/acquisition-source";
import type { AcquisitionSource } from "@/types/database.types";
import type { ActionResult } from "@/lib/booking-submission";
import {
  buildRequestedScheduleSummary,
  clearStoredAttempt,
  getOrMintSubmissionId,
  persistConflictAttempt,
  persistErrorAttempt,
  persistPendingAttempt,
  persistSucceededAttempt,
  persistUncertainAttempt,
  readStoredAttempt,
  type RequestedScheduleSummary,
} from "@/lib/booking-submission-storage";

// Mirrors the wording createBooking() returns for its own uncertain case
// (src/app/(site)/book/actions.ts) — duplicated, not imported, because a
// "use server" file may only export async Server Actions, never a plain
// string constant. This copy is for the ONE case that never reaches that
// function at all: the browser's own call to it rejecting (dropped
// connection, timeout) before any server-side classification can happen.
const CLIENT_TRANSPORT_UNCERTAIN_MESSAGE =
  "We're not sure if that went through. It's safe to try again — we won't create a duplicate. Or call/text us at (929) 870-1166.";

type InlineMessage = { kind: "error" | "conflict" | "uncertain"; text: string };

const SERVICE_SPEED_OPTIONS: { value: ServiceSpeed; label: string }[] = [
  { value: "standard", label: "Standard Next-Day" },
  { value: "flexible", label: "Flexible 24–48 Hours" },
  { value: "same_day", label: `Same-Day Rush (+${formatDollars(SAME_DAY_FEE_CENTS)}, subject to approval)` },
];

function AddOnCheckbox({
  id,
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label htmlFor={id} className={`text-sm font-normal ${disabled ? "text-muted-foreground" : "text-foreground"}`}>
        {label}
      </Label>
    </div>
  );
}

export function BookingForm({
  trackedAcquisitionSource = null,
}: {
  // Set by the /book page from its own validated ?source= query parameter —
  // present only for a recognized tracked campaign link. When set, the
  // optional "How did you hear about us?" question is skipped entirely
  // rather than asking a customer who arrived via a known link to answer it
  // again.
  trackedAcquisitionSource?: AcquisitionSource | null;
} = {}) {
  const [isPending, startTransition] = useTransition();
  const hasTrackedAcquisitionSource = trackedAcquisitionSource !== null;
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      ...bookingFormDefaults,
      acquisitionSource: resolveAcquisitionSourceFormDefault(trackedAcquisitionSource),
    },
  });

  // Radix Select doesn't reliably clear its displayed value when react-hook-form's
  // reset() sets it back to undefined — remounting via key is the reliable fix.
  const [selectResetKey, setSelectResetKey] = useState(0);

  // "succeeded" replaces the form with the persistent panel. Every other
  // state (idle, a conflict, an uncertain outcome, a definite rejection)
  // keeps the form visible/editable — see inlineMessage below for those.
  const [phase, setPhase] = useState<"idle" | "succeeded">("idle");
  const [summary, setSummary] = useState<RequestedScheduleSummary | null>(null);
  const [inlineMessage, setInlineMessage] = useState<InlineMessage | null>(null);

  // Deliberately NOT part of useForm/bookingSchema — these never reach the
  // server as their own fields. attemptSubmit() folds whichever are checked
  // into a summary line composed onto specialInstructions right before
  // persisting/submitting, so the server only ever sees the same single
  // text field it always has. See booking-addons.ts.
  const [addOns, setAddOns] = useState<BookingAddOns>(BOOKING_ADD_ONS_DEFAULT);

  function toggleAddOn(key: keyof BookingAddOns, checked: boolean) {
    setAddOns((prev) => {
      const next = { ...prev, [key]: checked };
      // Bleaching only makes sense alongside separating — unchecking
      // "separate" while "bleach" is still checked would leave a
      // confusing state, so clear it too.
      if (key === "separateWhitesBlacks" && !checked) next.bleachWhites = false;
      return next;
    });
  }

  // Synchronous guard, checked and set before startTransition — closes the
  // gap between "user clicks" and useTransition's isPending actually
  // flipping true, which is not synchronous within the same render tick.
  const inFlightRef = useRef(false);
  const successPanelRef = useRef<HTMLDivElement>(null);

  // Restore whatever the previous page load left behind, once, on mount.
  // Never auto-resubmits — only ever sets local state and, for
  // pending/uncertain, re-persists as uncertain (a refresh mid-flight and a
  // refresh after the booking actually saved but before the response
  // arrived are indistinguishable to the client, and both are safe to
  // treat identically).
  useEffect(() => {
    const stored = readStoredAttempt();
    if (!stored) return;

    if (stored.phase === "succeeded" && stored.summary) {
      setSummary(stored.summary);
      setPhase("succeeded");
      return;
    }
    if (stored.values && (stored.phase === "pending" || stored.phase === "uncertain")) {
      reset(stored.values);
      setSelectResetKey((key) => key + 1);
      persistUncertainAttempt(stored.clientSubmissionId, stored.values);
      setInlineMessage({ kind: "uncertain", text: CLIENT_TRANSPORT_UNCERTAIN_MESSAGE });
      return;
    }
    if (stored.values && stored.phase === "conflict") {
      reset(stored.values);
      setSelectResetKey((key) => key + 1);
      setInlineMessage({
        kind: "conflict",
        text: 'We already have a request on file from this session with different details — call or text us at (929) 870-1166 to update it, or use "Submit another request" for a separate new order.',
      });
      return;
    }
    if (stored.values && stored.phase === "error" && stored.errorMessage) {
      // A definite rejection, restored under the SAME id — not "uncertain"
      // (nothing is ambiguous about it) and not silently dropped back to a
      // blank form either.
      reset(stored.values);
      setSelectResetKey((key) => key + 1);
      setInlineMessage({ kind: "error", text: stored.errorMessage });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "succeeded" && successPanelRef.current) {
      successPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      successPanelRef.current.focus();
    }
  }, [phase]);

  const today = getBrooklynToday();
  const pickupDate = watch("preferredPickupDate");
  const pickupTime = watch("preferredPickupTime");
  const deliveryDate = watch("preferredDeliveryDate");
  const serviceSpeed = watch("serviceSpeed");
  const washAndFold = watch("washAndFold");
  const dryCleaning = watch("dryCleaning");
  const washAndFoldOnly = washAndFold && !dryCleaning;

  const pickupWindowOptions = pickupDate
    ? serviceSpeed === "same_day"
      ? getSameDayEligibleWindows(pickupDate)
      : getWindowsForDate(pickupDate)
    : [];
  // Standard/Flexible delivery windows depend on the pickup TIME too (the
  // 22-hour gap), not just the delivery date — so until a pickup time is
  // chosen, there's nothing valid to offer yet, matching "leave the
  // delivery-window selector empty until pickup date/time are set."
  // Dry Cleaning/Both has no such gap on its fixed day-4 date; Same-Day
  // shows its own fixed 6:00-7:00 PM display below instead of this Select.
  const deliveryWindowOptions = !deliveryDate
    ? []
    : dryCleaning
      ? getWindowsForDate(deliveryDate)
      : pickupTime
        ? getStandardFlexibleDeliveryWindows(pickupDate, pickupTime, deliveryDate)
        : [];
  const sameDayEligible = pickupDate ? isSameDayEligible(pickupDate) : false;

  /**
   * Re-derives every field that depends on pickup date + service speed, and
   * clears anything that's no longer valid — called after either changes, so
   * a hidden/disabled field can never retain a stale value that would pass
   * client state but fail server validation.
   */
  function applySpeedDerivedFields(speed: ServiceSpeed, pickupDateValue: string) {
    if (!pickupDateValue) return;

    if (speed === "same_day") {
      if (!isSameDayEligible(pickupDateValue)) {
        setValue("serviceSpeed", "standard");
        toast.error(bookingContent.sameDay.ineligibleToday);
        applySpeedDerivedFields("standard", pickupDateValue);
        return;
      }
      const eligibleTimes = new Set(
        getSameDayEligibleWindows(pickupDateValue).map((w) => w.value)
      );
      const currentPickupTime = getValues("preferredPickupTime");
      if (currentPickupTime && !eligibleTimes.has(currentPickupTime)) {
        setValue("preferredPickupTime", "");
      }
      setValue("preferredDeliveryDate", pickupDateValue);
      setValue("preferredDeliveryTime", SAME_DAY_DELIVERY_WINDOW_START);
      setSelectResetKey((key) => key + 1);
      return;
    }

    const nextDay = addDays(pickupDateValue, 1);
    const newDeliveryDate =
      speed === "flexible"
        ? (() => {
            const twoDaysLater = addDays(pickupDateValue, 2);
            const current = getValues("preferredDeliveryDate");
            return current === nextDay || current === twoDaysLater ? current : nextDay;
          })()
        : nextDay;

    setValue("preferredDeliveryDate", newDeliveryDate);
    // A pickup time might not be chosen yet (speed can be picked before or
    // after the pickup window) — getStandardFlexibleDeliveryWindows needs a
    // real time to compute the 22-hour gap, so treat "no pickup time yet"
    // as "no valid delivery time yet" rather than calling it with one.
    const currentPickupTime = getValues("preferredPickupTime");
    const validDeliveryTimes = currentPickupTime
      ? new Set(
          getStandardFlexibleDeliveryWindows(pickupDateValue, currentPickupTime, newDeliveryDate).map(
            (w) => w.value
          )
        )
      : new Set<string>();
    const currentDeliveryTime = getValues("preferredDeliveryTime");
    if (currentDeliveryTime && !validDeliveryTimes.has(currentDeliveryTime)) {
      setValue("preferredDeliveryTime", "");
    }
    // Radix Select doesn't reliably re-render its displayed value when a
    // value it doesn't own the onChange for is set programmatically (same
    // underlying quirk as the reset() case above) — remount via key so the
    // fresh mount picks up the value that's already correct in form state.
    setSelectResetKey((key) => key + 1);
  }

  /**
   * Dry Cleaning/Both's equivalent of applySpeedDerivedFields() above — the
   * delivery date is always exactly the fixed fourth calendar day after
   * pickup now (no customer choice of date, unlike Wash & Fold's
   * speed-derived window), so it's unconditionally recomputed rather than
   * preserved across a pickup-date change.
   */
  function applyDryCleaningDerivedFields(pickupDateValue: string) {
    if (!pickupDateValue) return;

    const newDeliveryDate = getDryCleaningDeliveryDate(pickupDateValue);
    setValue("preferredDeliveryDate", newDeliveryDate);
    const validDeliveryTimes = new Set(getWindowsForDate(newDeliveryDate).map((w) => w.value));
    const currentDeliveryTime = getValues("preferredDeliveryTime");
    if (currentDeliveryTime && !validDeliveryTimes.has(currentDeliveryTime)) {
      setValue("preferredDeliveryTime", "");
    }
    setSelectResetKey((key) => key + 1);
  }

  function handlePickupDateChange(newPickupDate: string) {
    if (!newPickupDate) return;

    const validPickupTimes = new Set(
      getWindowsForDate(newPickupDate).map((w) => w.value)
    );
    const currentPickupTime = getValues("preferredPickupTime");
    if (currentPickupTime && !validPickupTimes.has(currentPickupTime)) {
      setValue("preferredPickupTime", "");
    }

    if (getValues("dryCleaning")) {
      applyDryCleaningDerivedFields(newPickupDate);
    } else {
      const speed = getValues("serviceSpeed");
      if (speed) applySpeedDerivedFields(speed, newPickupDate);
    }
  }

  /**
   * The pickup DATE isn't the only thing the 22-hour gap depends on — the
   * pickup TIME matters too (a 6:00 PM pickup needs a later delivery window
   * than a 9:00 AM one on the same date), so a delivery time that was valid
   * before the pickup time changed can become invalid without the pickup
   * date or delivery date ever changing. Same-Day and Dry Cleaning/Both
   * don't use this gap at all — same-day's own pickup-window list is
   * already pre-filtered to always-valid choices, and dry cleaning's fixed
   * day-4 date has no gap dependency on pickup time.
   */
  function revalidateDeliveryAfterPickupTimeChange(newPickupTime: string) {
    if (dryCleaning || serviceSpeed === "same_day" || !newPickupTime || !pickupDate) return;
    const deliveryDateValue = getValues("preferredDeliveryDate");
    if (!deliveryDateValue) return;

    const validDeliveryTimes = new Set(
      getStandardFlexibleDeliveryWindows(pickupDate, newPickupTime, deliveryDateValue).map((w) => w.value)
    );
    const currentDeliveryTime = getValues("preferredDeliveryTime");
    if (currentDeliveryTime && !validDeliveryTimes.has(currentDeliveryTime)) {
      setValue("preferredDeliveryTime", "");
      setSelectResetKey((key) => key + 1);
    }
  }

  /**
   * Handles either service-selection checkbox. Resets — via
   * fieldsToResetOnServiceChange() — only fire when dryCleaning's own value
   * actually changes: toggling washAndFold while dryCleaning stays constant
   * (e.g. Both -> Dry Cleaning-only) never changes the applicable scheduling
   * rule, so nothing needs to be cleared.
   */
  function handleServiceSelectionChange(field: "washAndFold" | "dryCleaning", checked: boolean) {
    const dryCleaningBefore = getValues("dryCleaning");
    setValue(field, checked);
    const dryCleaningAfter = getValues("dryCleaning");

    if (dryCleaningAfter !== dryCleaningBefore) {
      const resets = fieldsToResetOnServiceChange(dryCleaningAfter);
      setValue("serviceSpeed", resets.serviceSpeed);
      setValue("preferredDeliveryDate", resets.preferredDeliveryDate);
      setValue("preferredDeliveryTime", resets.preferredDeliveryTime);
      setValue("dryCleaningItemDescription", resets.dryCleaningItemDescription);
      setSelectResetKey((key) => key + 1);
    }

    const pickupDateValue = getValues("preferredPickupDate");
    if (!pickupDateValue) return;

    if (dryCleaningAfter) {
      applyDryCleaningDerivedFields(pickupDateValue);
    } else {
      const speed = getValues("serviceSpeed");
      if (speed) applySpeedDerivedFields(speed, pickupDateValue);
    }
  }

  const pickupDateField = register("preferredPickupDate");

  /**
   * The one place a request actually gets sent, regardless of which path
   * called it (a normal validated submit, or the uncertain-state Retry
   * button below, which deliberately bypasses that validation). The
   * submission id is minted once and reused across every retry of the same
   * attempt — getOrMintSubmissionId() never rotates an id that's already
   * stored; only onStartOver's clearStoredAttempt() makes room for a new
   * one.
   */
  function attemptSubmit(rawValues: BookingInput) {
    if (inFlightRef.current) return;
    // Composed once, here, and used consistently for storage AND the
    // actual submission from this point on — never recomposed from a
    // second read of the (unchanged) textarea later. That keeps a Retry
    // byte-identical to the original attempt, which matters: the server's
    // dedup check compares special_instructions verbatim, and a retry that
    // sent different text (e.g. because addOns had reset across a
    // refresh) would misread as a genuine conflict instead of the same
    // request. composeSpecialInstructions() is a no-op pass-through when
    // no add-ons are checked, so this stays correct even then.
    const values: BookingInput = {
      ...rawValues,
      specialInstructions: composeSpecialInstructions(addOns, rawValues.specialInstructions ?? ""),
    };
    inFlightRef.current = true;
    const submissionId = getOrMintSubmissionId();
    persistPendingAttempt(submissionId, values);
    setInlineMessage(null);
    startTransition(async () => {
      try {
        const result = await createBooking(values, submissionId);
        applyResult(result, submissionId, values);
      } catch (transportError) {
        // The browser's own call to the Server Action rejecting (dropped
        // connection, timeout, tab backgrounded mid-request) — a hop
        // createBooking's OWN internal try/catch cannot see, since it
        // never even ran.
        console.error("Booking submission: client-side transport failure", transportError);
        persistUncertainAttempt(submissionId, values);
        setInlineMessage({ kind: "uncertain", text: CLIENT_TRANSPORT_UNCERTAIN_MESSAGE });
      } finally {
        inFlightRef.current = false;
      }
    });
  }

  function applyResult(result: ActionResult, submissionId: string, values: BookingInput) {
    if (result.status === "success") {
      const requestedSummary = buildRequestedScheduleSummary(values);
      persistSucceededAttempt(submissionId, result.bookingId, requestedSummary);
      setSummary(requestedSummary);
      setPhase("succeeded");
      return;
    }
    if (result.status === "conflict") {
      persistConflictAttempt(submissionId, values);
      setInlineMessage({ kind: "conflict", text: result.message });
      return;
    }
    if (result.status === "uncertain") {
      persistUncertainAttempt(submissionId, values);
      setInlineMessage({ kind: "uncertain", text: result.message });
      return;
    }
    // A definite rejection — nothing exists, nothing will be created.
    // Still persisted under the SAME id (never rotated) so a refresh right
    // after restores this exact message instead of misreading a stale
    // "pending" record as "uncertain."
    persistErrorAttempt(submissionId, values, result.message);
    setInlineMessage({ kind: "error", text: result.message });
  }

  function onRetry() {
    // Deliberately NOT handleSubmit(...) — that would run
    // zodResolver(bookingSchema), including "pickup date can't be in the
    // past." That rule is correct for a genuinely new attempt, but it's
    // exactly what the server-side recovery check was built to skip, so
    // retrying an already-accepted booking after its date has rolled into
    // the past must never be blocked here before it even reaches the
    // server. getValues() reads current form state with no validation.
    attemptSubmit(getValues());
  }

  function onStartOver() {
    clearStoredAttempt();
    // No arguments — reapplies the ORIGINAL defaultValues closure from this
    // component's useForm() call, which already resolves acquisitionSource
    // via resolveAcquisitionSourceFormDefault(trackedAcquisitionSource):
    // blank for an organic visit, the tracked value for a ?source= campaign
    // visit. reset(bookingFormDefaults) would wrongly blank out a
    // same-session tracked source; bare reset() also correctly re-unchecks
    // smsConsent, since a new request needs fresh consent.
    reset();
    setSelectResetKey((key) => key + 1);
    setAddOns(BOOKING_ADD_ONS_DEFAULT);
    setInlineMessage(null);
    setSummary(null);
    setPhase("idle");
    // A fresh id is minted the next time attemptSubmit runs and finds
    // nothing in storage — this is the only place that can happen.
  }

  if (phase === "succeeded" && summary) {
    return (
      <Card
        ref={successPanelRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="scroll-mt-24 border-primary/40"
      >
        <CardHeader>
          <CardTitle className="text-lg">Request received</CardTitle>
          <CardDescription>We&apos;ll text you to confirm your pickup and delivery times.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p className="font-medium text-foreground">Requested — awaiting confirmation:</p>
          <dl className="grid gap-1 text-muted-foreground">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-medium text-foreground">Service</dt>
              <dd>{summary.serviceLabel}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-medium text-foreground">Pickup</dt>
              <dd>{summary.pickupLabel}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 font-medium text-foreground">Delivery</dt>
              <dd>{summary.deliveryLabel}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            This is what you requested, not yet confirmed — we&apos;ll text you shortly to lock in the exact time.
          </p>
        </CardContent>
        <CardFooter>
          <Button type="button" variant="outline" size="sm" onClick={onStartOver}>
            Submit another request
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit((values) => attemptSubmit(values))} className="space-y-6" noValidate>
      {inlineMessage && (
        <div
          role={inlineMessage.kind === "error" ? "alert" : "status"}
          aria-live={inlineMessage.kind === "error" ? "assertive" : "polite"}
          className={
            inlineMessage.kind === "error"
              ? "rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
              : "rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm text-foreground"
          }
        >
          <p>{inlineMessage.text}</p>
          {inlineMessage.kind === "uncertain" && (
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onRetry} disabled={isPending}>
              {isPending ? "Retrying..." : "Retry"}
            </Button>
          )}
          {inlineMessage.kind === "conflict" && (
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onStartOver}>
              Submit another request
            </Button>
          )}
        </div>
      )}

      <fieldset disabled={isPending} className="m-0 min-w-0 border-0 p-0 space-y-6">
        <div className="hidden" aria-hidden="true">
          <Label htmlFor="companyWebsite">Company website</Label>
          <Input
            id="companyWebsite"
            tabIndex={-1}
            autoComplete="off"
            {...register("companyWebsite")}
          />
        </div>

        <div className="grid gap-3">
          <Label>Which service(s) do you need?</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className={`flex items-start gap-3 rounded-2xl border p-4 ${
                washAndFold ? "border-primary bg-muted" : "border-border"
              }`}
            >
              <Checkbox
                id="washAndFold"
                className="mt-0.5"
                checked={washAndFold === true}
                onCheckedChange={(checked) => handleServiceSelectionChange("washAndFold", checked === true)}
              />
              <Label htmlFor="washAndFold" className="grid gap-1 font-normal">
                <span className="text-sm font-semibold text-foreground">Wash & Fold</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Everyday laundry: washed, dried, and neatly folded.
                </span>
              </Label>
            </div>
            <div
              className={`flex items-start gap-3 rounded-2xl border p-4 ${
                dryCleaning ? "border-primary bg-muted" : "border-border"
              }`}
            >
              <Checkbox
                id="dryCleaning"
                className="mt-0.5"
                checked={dryCleaning === true}
                onCheckedChange={(checked) => handleServiceSelectionChange("dryCleaning", checked === true)}
              />
              <Label htmlFor="dryCleaning" className="grid gap-1 font-normal">
                <span className="text-sm font-semibold text-foreground">Dry Cleaning & Ironing</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Suits, dresses, and other garments: counted, inspected, and priced by our team.
                </span>
              </Label>
            </div>
          </div>
          {errors.washAndFold && <p className="text-sm text-destructive">{errors.washAndFold.message}</p>}
        </div>

        {washAndFold && (
          <div className="rounded-2xl border border-border bg-muted p-6">
            <h3 className="text-sm font-semibold">{bookingContent.pricing.heading}</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {bookingContent.pricing.items.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        )}

        {dryCleaning && (
          <div className="rounded-2xl border border-border bg-muted p-6">
            <h3 className="text-sm font-semibold">Dry Cleaning & Ironing</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {(washAndFold ? bookingContent.dryCleaning.bothItems : bookingContent.dryCleaning.onlyItems).map(
                (item) => (
                  <li key={item}>• {item}</li>
                )
              )}
            </ul>
            <div className="mt-4 grid gap-2">
              <Label htmlFor="dryCleaningItemDescription">
                {bookingContent.dryCleaning.itemDescriptionLabel}
              </Label>
              <Textarea
                id="dryCleaningItemDescription"
                rows={2}
                placeholder={bookingContent.dryCleaning.itemDescriptionPlaceholder}
                {...register("dryCleaningItemDescription")}
              />
            </div>
            {washAndFold && (
              <div className="mt-4 rounded-xl border-2 border-primary/40 bg-primary/10 p-4">
                <p className="text-sm text-foreground">
                  <strong className="font-semibold">Important:</strong>{" "}
                  {bookingContent.dryCleaning.bothBagReminder}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" placeholder="Jane Rivera" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" type="tel" placeholder="(718) 555-0134" {...register("phone")} />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="address">Pickup &amp; delivery address</Label>
          <Textarea
            id="address"
            rows={2}
            placeholder="123 7th Ave, Apt 4B, Brooklyn, NY 11215"
            {...register("address")}
          />
          {errors.address && (
            <p className="text-sm text-destructive">{errors.address.message}</p>
          )}
        </div>

        {washAndFoldOnly && (
          <div className="grid gap-2">
            <Label htmlFor="serviceSpeed">Service speed</Label>
            <Controller
              control={control}
              name="serviceSpeed"
              render={({ field }) => (
                <Select
                  key={selectResetKey}
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    applySpeedDerivedFields(value as ServiceSpeed, getValues("preferredPickupDate"));
                  }}
                >
                  <SelectTrigger id="serviceSpeed" className="w-full">
                    <SelectValue placeholder="Choose a service speed" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_SPEED_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        disabled={
                          option.value === "same_day" && Boolean(pickupDate) && !sameDayEligible
                        }
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.serviceSpeed && (
              <p className="text-sm text-destructive">{errors.serviceSpeed.message}</p>
            )}
            {serviceSpeed === "same_day" && (
              <p className="text-sm text-muted-foreground">{bookingContent.sameDay.disclosure}</p>
            )}
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="preferredPickupDate">Pickup date</Label>
            <Input
              id="preferredPickupDate"
              type="date"
              min={today}
              {...pickupDateField}
              onChange={(e) => {
                pickupDateField.onChange(e);
                handlePickupDateChange(e.target.value);
              }}
            />
            {errors.preferredPickupDate && (
              <p className="text-sm text-destructive">{errors.preferredPickupDate.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="preferredPickupTime">Pickup window</Label>
            <Controller
              control={control}
              name="preferredPickupTime"
              render={({ field }) => (
                <Select
                  key={selectResetKey}
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    revalidateDeliveryAfterPickupTimeChange(value);
                  }}
                  disabled={!pickupDate}
                >
                  <SelectTrigger id="preferredPickupTime" className="w-full">
                    <SelectValue
                      placeholder={pickupDate ? "Choose a window" : "Choose a date first"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {pickupWindowOptions.map((slot) => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.preferredPickupTime && (
              <p className="text-sm text-destructive">{errors.preferredPickupTime.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="preferredDeliveryDate">Delivery date</Label>
            {dryCleaning ? (
              <p className="flex h-9 items-center text-sm text-muted-foreground">
                {deliveryDate
                  ? `${formatDateDisplay(deliveryDate)} – 4 days after pickup`
                  : "Choose a pickup date first"}
              </p>
            ) : serviceSpeed === "flexible" ? (
              <Controller
                control={control}
                name="preferredDeliveryDate"
                render={({ field }) => (
                  <Select
                    key={selectResetKey}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Gap-aware, not a raw getWindowsForDate() lookup — a
                      // time only valid because pickup+2 always clears the
                      // gap can become invalid the moment the customer picks
                      // pickup+1 back instead.
                      const currentPickupTime = getValues("preferredPickupTime");
                      const validTimes = currentPickupTime
                        ? new Set(
                            getStandardFlexibleDeliveryWindows(pickupDate, currentPickupTime, value).map(
                              (w) => w.value
                            )
                          )
                        : new Set<string>();
                      const currentTime = getValues("preferredDeliveryTime");
                      if (currentTime && !validTimes.has(currentTime)) {
                        setValue("preferredDeliveryTime", "");
                      }
                    }}
                    disabled={!pickupDate}
                  >
                    <SelectTrigger id="preferredDeliveryDate" className="w-full">
                      <SelectValue placeholder="Choose a delivery date" />
                    </SelectTrigger>
                    <SelectContent>
                      {pickupDate && (
                        <>
                          <SelectItem value={addDays(pickupDate, 1)}>
                            {formatDateDisplay(addDays(pickupDate, 1))} (next day)
                          </SelectItem>
                          <SelectItem value={addDays(pickupDate, 2)}>
                            {formatDateDisplay(addDays(pickupDate, 2))} (2 days later)
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
            ) : (
              <p className="flex h-9 items-center text-sm text-muted-foreground">
                {deliveryDate
                  ? `${formatDateDisplay(deliveryDate)} – ${
                      serviceSpeed === "same_day" ? "same day as pickup" : "next day after pickup"
                    }`
                  : "Choose a pickup date first"}
              </p>
            )}
            {errors.preferredDeliveryDate && (
              <p className="text-sm text-destructive">{errors.preferredDeliveryDate.message}</p>
            )}
            {dryCleaning && (
              <p className="text-sm text-muted-foreground">{bookingContent.dryCleaning.deliveryNotice}</p>
            )}
            {washAndFoldOnly && serviceSpeed !== "same_day" && (
              <p className="text-sm text-muted-foreground">{bookingContent.deliveryGap.notice}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="preferredDeliveryTime">Delivery window</Label>
            {serviceSpeed === "same_day" ? (
              <p className="flex h-9 items-center text-sm text-muted-foreground">6:00 – 7:00 PM</p>
            ) : (
              <Controller
                control={control}
                name="preferredDeliveryTime"
                render={({ field }) => (
                  <Select
                    key={selectResetKey}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={deliveryWindowOptions.length === 0}
                  >
                    <SelectTrigger id="preferredDeliveryTime" className="w-full">
                      <SelectValue
                        placeholder={
                          !deliveryDate
                            ? "Choose a date first"
                            : deliveryWindowOptions.length === 0
                              ? "Choose a pickup time first"
                              : "Choose a window"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryWindowOptions.map((slot) => (
                        <SelectItem key={slot.value} value={slot.value}>
                          {slot.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            {errors.preferredDeliveryTime && (
              <p className="text-sm text-destructive">{errors.preferredDeliveryTime.message}</p>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="specialInstructions">Special instructions (optional)</Label>
          <Textarea
            id="specialInstructions"
            rows={4}
            placeholder="Gate code, delicate items, anything else we should know..."
            {...register("specialInstructions")}
          />
        </div>

        <details className="group rounded-2xl border border-border p-4">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
            Optional add-ons &amp; preferences
            <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-90">
              ›
            </span>
          </summary>
          <div className="mt-4 grid gap-3">
            {BOOKING_ADD_ON_OPTIONS.map((option) => {
              const checkbox = (
                <AddOnCheckbox
                  key={option.key}
                  id={`addon-${option.key}`}
                  label={option.label}
                  checked={addOns[option.key]}
                  disabled={option.key === "bleachWhites" && !addOns.separateWhitesBlacks}
                  onCheckedChange={(checked) => toggleAddOn(option.key, checked)}
                />
              );
              // Nested and indented to show it depends on "Separate whites
              // & blacks" just above it — the catalog already lists them
              // adjacently, this only changes bleachWhites' own wrapper.
              return option.key === "bleachWhites" ? (
                <div key={option.key} className="ml-7">
                  {checkbox}
                </div>
              ) : (
                checkbox
              );
            })}
          </div>
        </details>

        {!hasTrackedAcquisitionSource && (
          <div className="grid gap-2">
            <Label htmlFor="acquisitionSource">How did you hear about us? (Optional)</Label>
            <Controller
              control={control}
              name="acquisitionSource"
              render={({ field }) => (
                <Select key={selectResetKey} value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="acquisitionSource" className="w-full">
                    <SelectValue placeholder="Select one (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACQUISITION_SOURCE_FORM_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              This helps our family understand what&apos;s working.
            </p>
          </div>
        )}

        <div className="grid gap-2">
          <div className="flex items-start gap-3">
            <Controller
              control={control}
              name="smsConsent"
              render={({ field }) => (
                <Checkbox
                  id="smsConsent"
                  className="mt-0.5"
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <Label
              htmlFor="smsConsent"
              className="text-sm font-normal leading-snug text-muted-foreground"
            >
              {bookingContent.consent.checkboxLabel}
            </Label>
          </div>
          {errors.smsConsent && (
            <p className="text-sm text-destructive">{errors.smsConsent.message}</p>
          )}
          <p className="text-xs text-muted-foreground">{bookingContent.consent.callInstead}</p>
        </div>

        <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Submitting...
            </>
          ) : (
            "Request Pickup"
          )}
        </Button>
        <span role="status" aria-live="polite" className="sr-only">
          {isPending ? "Submitting your request…" : ""}
        </span>
      </fieldset>
    </form>
  );
}
