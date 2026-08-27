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
import { windowLabel } from "@/lib/validations/booking-schema";
import type { ServiceSpeed, ServiceType } from "@/types/database.types";

const SERVICE_SPEED_LABELS: Record<ServiceSpeed, string> = {
  standard: "Standard Next-Day",
  flexible: "Flexible 24–48 Hours",
  same_day: "Same-Day Rush",
  dry_cleaning_timeline: "3–4 Day Turnaround",
};

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  wash_and_fold: "Wash & Fold",
  dry_cleaning: "Dry Cleaning & Ironing",
  both: "Wash & Fold + Dry Cleaning & Ironing",
};

interface NewBookingNotificationProps {
  bookingId: string;
  name: string;
  phone: string;
  address: string;
  preferredPickupDate: string;
  preferredPickupTime: string;
  preferredDeliveryDate?: string | null;
  preferredDeliveryTime?: string | null;
  serviceType: ServiceType;
  serviceSpeed: ServiceSpeed;
  dryCleaningItemDescription?: string | null;
  dryCleaningItemDescriptionZh?: string | null;
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
  serviceType,
  serviceSpeed,
  dryCleaningItemDescription,
  dryCleaningItemDescriptionZh,
  specialInstructions,
}: NewBookingNotificationProps) {
  const isSameDay = serviceSpeed === "same_day";

  return (
    <Html>
      <Head />
      <Preview>
        {isSameDay ? "SAME-DAY: " : ""}New pickup request from {name}
      </Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#faf7f2" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: 32,
            borderRadius: 12,
            maxWidth: 480,
          }}
        >
          {isSameDay && (
            <Text
              style={{
                margin: "0 0 16px",
                padding: "10px 14px",
                backgroundColor: "#b91c1c",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: 0.5,
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              SAME-DAY REQUEST
            </Text>
          )}
          <Heading as="h2" style={{ color: "#2b2622" }}>
            New Booking Request
          </Heading>
          <Hr />
          <Row>
            <Column>
              <Text style={{ margin: "4px 0" }}>
                <strong>Service:</strong> {SERVICE_TYPE_LABELS[serviceType]}
              </Text>
              <Text style={{ margin: "4px 0" }}>
                <strong>Speed/turnaround:</strong> {SERVICE_SPEED_LABELS[serviceSpeed]}
              </Text>
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
                <strong>Requested pickup:</strong> {preferredPickupDate} at{" "}
                {windowLabel(preferredPickupTime)}
              </Text>
              {preferredDeliveryDate && preferredDeliveryTime && (
                <Text style={{ margin: "4px 0" }}>
                  <strong>Requested delivery:</strong> {preferredDeliveryDate} at{" "}
                  {windowLabel(preferredDeliveryTime)}
                </Text>
              )}
              {dryCleaningItemDescription && (
                <Text style={{ margin: "4px 0" }}>
                  <strong>Dry-cleaning items:</strong> {dryCleaningItemDescription}
                </Text>
              )}
              {dryCleaningItemDescriptionZh && (
                <Text style={{ margin: "4px 0", color: "#6b6255" }}>{dryCleaningItemDescriptionZh}</Text>
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
