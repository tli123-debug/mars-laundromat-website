import { StatusSelect } from "@/app/admin/(dashboard)/bookings/status-select";
import { PaidCheckbox } from "@/app/admin/(dashboard)/bookings/paid-checkbox";
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

export function BookingCard({ booking }: { booking: BookingRow }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">{booking.name}</div>
          <div className="text-sm text-muted-foreground">{booking.phone}</div>
          <div className="text-sm text-muted-foreground">{booking.address}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusSelect bookingId={booking.id} status={booking.status} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Paid 已付款</span>
            <PaidCheckbox bookingId={booking.id} paid={booking.paid} />
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <div className="text-muted-foreground">
            Pickup 取件 — {booking.confirmed_pickup_date ? "Confirmed 已确认" : "Proposed 建议"}
          </div>
          <div>
            {formatDate(booking.confirmed_pickup_date ?? booking.preferred_pickup_date)} ·{" "}
            {windowLabel(booking.confirmed_pickup_time ?? booking.preferred_pickup_time)}
          </div>
        </div>
        {booking.preferred_delivery_date && (
          <div>
            <div className="text-muted-foreground">
              Delivery 送件 —{" "}
              {booking.confirmed_delivery_date ? "Confirmed 已确认" : "Proposed 建议"}
            </div>
            <div>
              {formatDate(booking.confirmed_delivery_date ?? booking.preferred_delivery_date)} ·{" "}
              {windowLabel(booking.confirmed_delivery_time ?? booking.preferred_delivery_time)}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <QuickActionLink href={bookingPhoneHref(booking.phone)} label="Call 打电话" />
        <QuickActionLink href={bookingSmsHref(booking.phone)} label="Text 发短信" />
        <QuickActionLink href={bookingMapsHref(booking.address)} label="Map 地图" />
      </div>
    </div>
  );
}
