import Link from "next/link";
import { StatusSelect } from "@/app/admin/(dashboard)/bookings/status-select";
import { PaymentControl } from "@/app/admin/(dashboard)/bookings/payment-control";
import { ServiceTypeBadge } from "@/app/admin/(dashboard)/bookings/service-type-badge";
import { windowLabel } from "@/lib/validations/booking-schema";
import { bookingMapsHref, bookingPhoneHref, bookingSmsHref } from "@/lib/booking-links";
import type { Database } from "@/types/database.types";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function QuickActionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted"
    >
      {label}
    </a>
  );
}

/**
 * Whether "confirmed" is a real, complete value vs. still-proposed depends on
 * the booking's status, never on the field merely being non-null — a pending
 * booking can have confirmed_* set (that's exactly what "Awaiting Customer"
 * is: a proposed time nobody has accepted yet). Only once status has moved
 * past "pending" does a set confirmed_* value mean genuinely confirmed.
 */
function ProposedOrConfirmedLabel({ status }: { status: BookingRow["status"] }) {
  return status === "pending" ? <>Proposed 建议</> : <>Confirmed 已确认</>;
}

function WindowSection({
  heading,
  requestedDate,
  requestedTime,
  confirmedDate,
  confirmedTime,
  status,
}: {
  heading: string;
  requestedDate: string | null;
  requestedTime: string | null;
  confirmedDate: string | null;
  confirmedTime: string | null;
  status: BookingRow["status"];
}) {
  // "Complete" — both fields set, not just one. Guards against inferring
  // anything from a single non-null field in a partial/unexpected state.
  const hasConfirmed = Boolean(confirmedDate && confirmedTime);

  return (
    <div>
      <div className="text-muted-foreground">{heading}</div>
      <div>
        Requested 客户请求: {formatDate(requestedDate)} · {windowLabel(requestedTime)}
      </div>
      {hasConfirmed && (
        <div>
          <ProposedOrConfirmedLabel status={status} />: {formatDate(confirmedDate)} ·{" "}
          {windowLabel(confirmedTime)}
        </div>
      )}
    </div>
  );
}

export function BookingCard({ booking }: { booking: BookingRow }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/bookings/${booking.id}`} className="font-medium hover:underline">
              {booking.name}
            </Link>
            <ServiceTypeBadge serviceType={booking.service_type} />
          </div>
          <div className="text-sm text-muted-foreground">{booking.phone}</div>
          <div className="text-sm text-muted-foreground">{booking.address}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusSelect bookingId={booking.id} status={booking.status} />
          <PaymentControl bookingId={booking.id} paid={booking.paid} paymentMethod={booking.payment_method} />
        </div>
      </div>

      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <WindowSection
          heading="Pickup 取件"
          requestedDate={booking.preferred_pickup_date}
          requestedTime={booking.preferred_pickup_time}
          confirmedDate={booking.confirmed_pickup_date}
          confirmedTime={booking.confirmed_pickup_time}
          status={booking.status}
        />
        {booking.preferred_delivery_date && (
          <WindowSection
            heading="Delivery 送件"
            requestedDate={booking.preferred_delivery_date}
            requestedTime={booking.preferred_delivery_time}
            confirmedDate={booking.confirmed_delivery_date}
            confirmedTime={booking.confirmed_delivery_time}
            status={booking.status}
          />
        )}
      </div>

      {booking.special_instructions && (
        <div className="mt-3 text-sm">
          <span className="text-muted-foreground">Notes 备注: </span>
          {booking.special_instructions}
          {booking.special_instructions_zh && (
            <div className="mt-0.5 text-muted-foreground/80">
              {booking.special_instructions_zh}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <QuickActionLink href={bookingPhoneHref(booking.phone)} label="Call 打电话" />
        <QuickActionLink href={bookingSmsHref(booking.phone)} label="Text 发短信" />
        <QuickActionLink href={bookingMapsHref(booking.address)} label="Map 地图" />
      </div>
    </div>
  );
}
