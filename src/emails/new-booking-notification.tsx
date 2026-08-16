import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Text,
} from "@react-email/components";
import { TIME_WINDOW_LABELS } from "@/lib/validations/booking-schema";
import type { TimeWindow } from "@/types/database.types";

interface NewBookingNotificationProps {
  bookingId: string;
  name: string;
  phone: string;
  address: string;
  preferredPickupDate: string;
  preferredPickupWindow: TimeWindow;
  preferredDeliveryDate?: string | null;
  preferredDeliveryWindow?: TimeWindow | null;
  specialInstructions?: string | null;
}

export default function NewBookingNotification({
  bookingId,
  name,
  phone,
  address,
  preferredPickupDate,
  preferredPickupWindow,
  preferredDeliveryDate,
  preferredDeliveryWindow,
  specialInstructions,
}: NewBookingNotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>New pickup request from {name}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#faf7f2" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: 32,
            borderRadius: 12,
            maxWidth: 480,
          }}
        >
          <Heading as="h2" style={{ color: "#2b2622" }}>
            New Booking Request
          </Heading>
          <Hr />
          <Row>
            <Column>
              <Text style={{ margin: "4px 0" }}>
                <strong>Name:</strong> {name}
              </Text>
              <Text style={{ margin: "4px 0" }}>
                <strong>Phone:</strong> {phone}
              </Text>
              <Text style={{ margin: "4px 0" }}>
                <strong>Address:</strong> {address}
              </Text>
              <Text style={{ margin: "4px 0" }}>
                <strong>Preferred pickup:</strong> {preferredPickupDate} (
                {TIME_WINDOW_LABELS[preferredPickupWindow]})
              </Text>
              {preferredDeliveryDate && preferredDeliveryWindow && (
                <Text style={{ margin: "4px 0" }}>
                  <strong>Preferred delivery:</strong> {preferredDeliveryDate} (
                  {TIME_WINDOW_LABELS[preferredDeliveryWindow]})
                </Text>
              )}
              {specialInstructions && (
                <Text style={{ margin: "4px 0" }}>
                  <strong>Notes:</strong> {specialInstructions}
                </Text>
              )}
            </Column>
          </Row>
          <Hr />
          <Text style={{ color: "#6b6255", fontSize: 12 }}>
            Booking ID: {bookingId} — confirm this in the admin dashboard.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
