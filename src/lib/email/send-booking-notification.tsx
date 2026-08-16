import "server-only";
import { Resend } from "resend";
import NewBookingNotification from "@/emails/new-booking-notification";
import type { BookingInput } from "@/lib/validations/booking-schema";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendBookingNotificationArgs {
  bookingId: string;
  booking: BookingInput;
}

export async function sendBookingNotification({
  bookingId,
  booking,
}: SendBookingNotificationArgs) {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: process.env.BOOKING_NOTIFICATION_TO_EMAIL!,
    subject: `New booking request — ${booking.name}`,
    react: (
      <NewBookingNotification
        bookingId={bookingId}
        name={booking.name}
        phone={booking.phone}
        address={booking.address}
        preferredPickupDate={booking.preferredPickupDate}
        preferredPickupWindow={booking.preferredPickupWindow}
        preferredDeliveryDate={booking.preferredDeliveryDate || null}
        preferredDeliveryWindow={booking.preferredDeliveryWindow || null}
        specialInstructions={booking.specialInstructions || null}
      />
    ),
  });

  if (error) {
    throw new Error(error.message);
  }
}
