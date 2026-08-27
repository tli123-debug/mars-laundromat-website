import "server-only";
import { Resend } from "resend";
import NewBookingNotification from "@/emails/new-booking-notification";
import type { BookingInput } from "@/lib/validations/booking-schema";
import type { ServiceSpeed, ServiceType } from "@/types/database.types";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendBookingNotificationArgs {
  bookingId: string;
  booking: BookingInput;
  // Authoritative, server-derived values (see createBooking in
  // src/app/(site)/book/actions.ts) — never re-derived here from
  // booking.washAndFold/dryCleaning/serviceSpeed, so the email can't drift
  // from what was actually written to the database.
  serviceType: ServiceType;
  serviceSpeed: ServiceSpeed;
  dryCleaningItemDescription: string | null;
  dryCleaningItemDescriptionZh: string | null;
}

export async function sendBookingNotification({
  bookingId,
  booking,
  serviceType,
  serviceSpeed,
  dryCleaningItemDescription,
  dryCleaningItemDescriptionZh,
}: SendBookingNotificationArgs) {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: process.env.BOOKING_NOTIFICATION_TO_EMAIL!,
    subject: `${serviceSpeed === "same_day" ? "SAME-DAY: " : ""}New booking request — ${booking.name}`,
    react: (
      <NewBookingNotification
        bookingId={bookingId}
        name={booking.name}
        phone={booking.phone}
        address={booking.address}
        preferredPickupDate={booking.preferredPickupDate}
        preferredPickupTime={booking.preferredPickupTime}
        preferredDeliveryDate={booking.preferredDeliveryDate || null}
        preferredDeliveryTime={booking.preferredDeliveryTime || null}
        serviceType={serviceType}
        serviceSpeed={serviceSpeed}
        dryCleaningItemDescription={dryCleaningItemDescription}
        dryCleaningItemDescriptionZh={dryCleaningItemDescriptionZh}
        specialInstructions={booking.specialInstructions || null}
      />
    ),
  });

  if (error) {
    throw new Error(error.message);
  }
}
