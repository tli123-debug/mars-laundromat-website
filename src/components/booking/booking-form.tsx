"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  type BookingInput,
  type ServiceSpeed,
} from "@/lib/validations/booking-schema";
import {
  addDays,
  getBrooklynToday,
  getSameDayEligibleWindows,
  getWindowsForDate,
  isSameDayEligible,
  SAME_DAY_DELIVERY_WINDOW_START,
} from "@/lib/booking-hours";
import { getDryCleaningDeliveryDateOptions } from "@/lib/dry-cleaning-schedule";
import { booking as bookingContent } from "@/content/booking";
import { createBooking } from "@/app/(site)/book/actions";

const SERVICE_SPEED_OPTIONS: { value: ServiceSpeed; label: string }[] = [
  { value: "standard", label: "Standard Next-Day" },
  { value: "flexible", label: "Flexible 24–48 Hours" },
  { value: "same_day", label: "Same-Day Rush (+$10, subject to approval)" },
];

function formatDateDisplay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function BookingForm() {
  const [isPending, startTransition] = useTransition();
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
    defaultValues: bookingFormDefaults,
  });

  // Radix Select doesn't reliably clear its displayed value when react-hook-form's
  // reset() sets it back to undefined — remounting via key is the reliable fix.
  const [selectResetKey, setSelectResetKey] = useState(0);

  const today = getBrooklynToday();
  const pickupDate = watch("preferredPickupDate");
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
  const deliveryWindowOptions = deliveryDate ? getWindowsForDate(deliveryDate) : [];
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
    const validDeliveryTimes = new Set(
      getWindowsForDate(newDeliveryDate).map((w) => w.value)
    );
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
   * delivery date is a fixed pickup+3/+4 pair instead of a speed-derived
   * window. Mirrors that function's shape exactly: the delivery date is
   * always recomputed (preserved across the change only if it's still one
   * of the two valid options), and the delivery time is cleared only if it's
   * no longer valid for the resulting date.
   */
  function applyDryCleaningDerivedFields(pickupDateValue: string) {
    if (!pickupDateValue) return;

    const [plusThree, plusFour] = getDryCleaningDeliveryDateOptions(pickupDateValue);
    const currentDeliveryDate = getValues("preferredDeliveryDate");
    const newDeliveryDate =
      currentDeliveryDate === plusThree || currentDeliveryDate === plusFour
        ? currentDeliveryDate
        : plusThree;

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
      setValue("dryCleaningBagAcknowledgement", resets.dryCleaningBagAcknowledgement);
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

  function onSubmit(values: BookingInput) {
    startTransition(async () => {
      const result = await createBooking(values);
      if (result.status === "success") {
        toast.success(result.message);
        reset();
        setSelectResetKey((key) => key + 1);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
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
                Everyday laundry — washed, dried, and neatly folded.
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
                Suits, dresses, and other garments — counted, inspected, and priced by our team.
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
          <div className="mt-4 grid gap-2">
            <div className="flex items-start gap-3">
              <Controller
                control={control}
                name="dryCleaningBagAcknowledgement"
                render={({ field }) => (
                  <Checkbox
                    id="dryCleaningBagAcknowledgement"
                    className="mt-0.5"
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <Label
                htmlFor="dryCleaningBagAcknowledgement"
                className="text-sm font-normal leading-snug text-muted-foreground"
              >
                {bookingContent.dryCleaning.bagAcknowledgementLabel}
              </Label>
            </div>
            {errors.dryCleaningBagAcknowledgement && (
              <p className="text-sm text-destructive">{errors.dryCleaningBagAcknowledgement.message}</p>
            )}
          </div>
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
                onValueChange={field.onChange}
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
            <Controller
              control={control}
              name="preferredDeliveryDate"
              render={({ field }) => (
                <Select
                  key={selectResetKey}
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    const validTimes = new Set(getWindowsForDate(value).map((w) => w.value));
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
                    {pickupDate &&
                      getDryCleaningDeliveryDateOptions(pickupDate).map((date, index) => (
                        <SelectItem key={date} value={date}>
                          {formatDateDisplay(date)} ({index === 0 ? "3 days later" : "4 days later"})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
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
                    const validTimes = new Set(
                      getWindowsForDate(value).map((w) => w.value)
                    );
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
                ? `${formatDateDisplay(deliveryDate)} — ${
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
                  disabled={!deliveryDate}
                >
                  <SelectTrigger id="preferredDeliveryTime" className="w-full">
                    <SelectValue
                      placeholder={deliveryDate ? "Choose a window" : "Choose a date first"}
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
        {isPending ? "Submitting..." : "Request Pickup"}
      </Button>
    </form>
  );
}
