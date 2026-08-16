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
import { timeSlotLabel } from "@/lib/validations/booking-schema";

interface NewBookingNotificationProps {
  bookingId: string;
  name: string;
  phone: string;
  address: string;
  preferredPickupDate: string;
  preferredPickupTime: string;
  preferredDeliveryDate?: string | null;
  preferredDeliveryTime?: string | null;
  specialInstructions?: string | null;
}

export default function NewBookingNotification({
  bookingId,
  name,
  phone,
  address,
  preferredPickupDate,
  preferredPickupTime,
  preferredDeliveryDate,
  preferredDeliveryTime,
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
                <strong>Preferred pickup:</strong> {preferredPickupDate} at{" "}
                {timeSlotLabel(preferredPickupTime)}
              </Text>
              {preferredDeliveryDate && preferredDeliveryTime && (
                <Text style={{ margin: "4px 0" }}>
                  <strong>Preferred delivery:</strong> {preferredDeliveryDate} at{" "}
                  {timeSlotLabel(preferredDeliveryTime)}
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
