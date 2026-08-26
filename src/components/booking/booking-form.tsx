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

  function handlePickupDateChange(newPickupDate: string) {
    if (!newPickupDate) return;

    const validPickupTimes = new Set(
      getWindowsForDate(newPickupDate).map((w) => w.value)
    );
    const currentPickupTime = getValues("preferredPickupTime");
    if (currentPickupTime && !validPickupTimes.has(currentPickupTime)) {
      setValue("preferredPickupTime", "");
    }

    applySpeedDerivedFields(getValues("serviceSpeed"), newPickupDate);
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

      <div className="rounded-2xl border border-border bg-muted p-6">
        <h3 className="text-sm font-semibold">{bookingContent.pricing.heading}</h3>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {bookingContent.pricing.items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </div>

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
          {serviceSpeed === "flexible" ? (
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
