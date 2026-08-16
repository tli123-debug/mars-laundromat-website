"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  TIME_SLOTS,
  type BookingInput,
} from "@/lib/validations/booking-schema";
import { createBooking } from "@/app/(site)/book/actions";

export function BookingForm() {
  const [isPending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: bookingFormDefaults,
  });

  // Radix Select doesn't reliably clear its displayed value when react-hook-form's
  // reset() sets it back to undefined — remounting via key is the reliable fix.
  const [selectResetKey, setSelectResetKey] = useState(0);

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

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="preferredPickupDate">Preferred pickup date</Label>
          <Input id="preferredPickupDate" type="date" {...register("preferredPickupDate")} />
          {errors.preferredPickupDate && (
            <p className="text-sm text-destructive">{errors.preferredPickupDate.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="preferredPickupTime">Preferred pickup time</Label>
          <Controller
            control={control}
            name="preferredPickupTime"
            render={({ field }) => (
              <Select
                key={selectResetKey}
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="preferredPickupTime" className="w-full">
                  <SelectValue placeholder="Choose a time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
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
          <Label htmlFor="preferredDeliveryDate">Preferred delivery date (optional)</Label>
          <Input id="preferredDeliveryDate" type="date" {...register("preferredDeliveryDate")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="preferredDeliveryTime">Preferred delivery time (optional)</Label>
          <Controller
            control={control}
            name="preferredDeliveryTime"
            render={({ field }) => (
              <Select
                key={selectResetKey}
                value={field.value || undefined}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="preferredDeliveryTime" className="w-full">
                  <SelectValue placeholder="Choose a time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
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

      <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? "Submitting..." : "Request Pickup"}
      </Button>
    </form>
  );
}
