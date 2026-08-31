import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import { StatusSelect } from "@/app/admin/(dashboard)/bookings/status-select";
import { PaymentControl } from "@/app/admin/(dashboard)/bookings/payment-control";
import { ServiceTypeBadge } from "@/app/admin/(dashboard)/bookings/service-type-badge";
import { RecurringBadge } from "@/app/admin/(dashboard)/bookings/recurring-badge";
import { bookingMapsHref, bookingPhoneHref, bookingSmsHref } from "@/lib/booking-links";
import { isEligibleForRecurringOffer, normalizeAddress, normalizePhoneNumber } from "@/lib/recurring-schedule";
import type { Database } from "@/types/database.types";
import { TimeEditor } from "./time-editor";
import { QuoteEditor } from "./quote-editor";
import { ServiceTypeSelect } from "./service-type-select";
import { DeleteBooking } from "./delete-booking";
import { RecurringEnrollment } from "./recurring-enrollment";

// Includes the embedded recurring_schedules relation — see the same
// .returns<>() comment in today/page.tsx.
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"] & {
  recurring_schedules: Pick<
    Database["public"]["Tables"]["recurring_schedules"]["Row"],
    "status" | "frequency"
  > | null;
};

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

export default async function AdminBookingDetailPage(props: PageProps<"/admin/bookings/[id]">) {
  await requireAdmin();
  const { id } = await props.params;

  const supabase = await createClient();
  // recurring_schedules!bookings_recurring_schedule_id_fkey disambiguates
  // which of the two FK paths between these tables to embed (the other is
  // recurring_schedules.source_booking_id, in the opposite direction) —
  // returns this booking's OWN schedule (if it's a generated recurring
  // occurrence), not the schedule it may have originated as a source.
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("*, recurring_schedules!bookings_recurring_schedule_id_fkey(status, frequency)")
    .eq("id", id)
    .single()
    .returns<BookingRow>();

  if (error || !booking) {
    notFound();
  }

  // A second, separate lookup — can't be embedded in the query above since
  // it depends on the just-fetched booking's own phone/address, and it's a
  // genuinely different relationship (by customer, not by this exact row).
  // Small and indexed (by phone), never N+1: this page renders exactly one
  // booking, so this is one extra query total, not one per row.
  const normalizedPhone = normalizePhoneNumber(booking.phone);
  const normalizedAddress = normalizeAddress(booking.address);
  const { data: customerSchedules } = await supabase
    .from("recurring_schedules")
    .select("status, frequency, address")
    .eq("customer_phone_normalized", normalizedPhone)
    .in("status", ["active", "paused"]);
  // Customer-scoped, not booking-scoped: the spec's "a customer already has
  // an active or paused schedule" duplicate check (and the badge+link that
  // replaces the offer/setup UI for it) applies the same way whether THIS
  // booking happens to be the schedule's source_booking_id or a different
  // completed booking from the same customer — the unique index guarantees
  // at most one active-or-paused row here regardless.
  const matchingCustomerSchedules = (customerSchedules ?? []).filter(
    (s) => normalizeAddress(s.address) === normalizedAddress
  );
  const hasActiveOrPausedSchedule = matchingCustomerSchedules.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/bookings" className="text-sm text-muted-foreground hover:text-foreground">
          ← All Bookings 所有预约
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold">{booking.name}</h1>
          <ServiceTypeBadge serviceType={booking.service_type} />
          {booking.recurring_schedules && (
            <RecurringBadge
              status={booking.recurring_schedules.status}
              frequency={booking.recurring_schedules.frequency}
            />
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {booking.phone} · {booking.address}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <QuickActionLink href={bookingPhoneHref(booking.phone)} label="Call 打电话" />
        <QuickActionLink href={bookingSmsHref(booking.phone)} label="Text 发短信" />
        <QuickActionLink href={bookingMapsHref(booking.address)} label="Map 地图" />
      </div>

      <section className="rounded-xl border border-border bg-background p-4">
        <h2 className="font-display text-base font-semibold">Status & Payment 状态与付款</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <StatusSelect bookingId={booking.id} status={booking.status} />
          <PaymentControl bookingId={booking.id} paid={booking.paid} paymentMethod={booking.payment_method} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background p-4">
        <h2 className="font-display text-base font-semibold">Pickup & Delivery Times 取件与送件时间</h2>
        <div className="mt-3">
          <TimeEditor
            bookingId={booking.id}
            status={booking.status}
            customerName={booking.name}
            customerPhone={booking.phone}
            serviceType={booking.service_type}
            preferredPickupDate={booking.preferred_pickup_date}
            preferredPickupTime={booking.preferred_pickup_time}
            preferredDeliveryDate={booking.preferred_delivery_date}
            preferredDeliveryTime={booking.preferred_delivery_time}
            confirmedPickupDate={booking.confirmed_pickup_date}
            confirmedPickupTime={booking.confirmed_pickup_time}
            confirmedDeliveryDate={booking.confirmed_delivery_date}
            confirmedDeliveryTime={booking.confirmed_delivery_time}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background p-4">
        <h2 className="font-display text-base font-semibold">Quote 报价</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Service 服务</span>
          <ServiceTypeSelect
            bookingId={booking.id}
            serviceType={booking.service_type}
            quoteStatus={booking.quote_status}
          />
        </div>
        <div className="mt-4">
          {/*
            QuoteEditor seeds its local input state from `booking` only on
            mount (useState initializers don't re-run on prop changes).
            Without a key tied to service_type, a changeServiceType save
            would revalidate this page with a cleared booking row but React
            would reuse the same component instance — leaving stale
            weight/subtotal/surcharge/notes in the inputs, save-able back
            onto the now-different-service-type booking. Keying on
            id+service_type forces a remount (fresh useState initializers)
            exactly when that staleness could occur.
          */}
          <QuoteEditor key={`${booking.id}:${booking.service_type}`} booking={booking} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background p-4">
        <h2 className="font-display text-base font-semibold">Recurring Pickup 定期取件</h2>
        <div className="mt-3">
          <RecurringEnrollment
            bookingId={booking.id}
            customerName={booking.name}
            customerPhone={booking.phone}
            eligible={isEligibleForRecurringOffer(booking, hasActiveOrPausedSchedule)}
            existingSchedule={
              matchingCustomerSchedules.length > 0
                ? { status: matchingCustomerSchedules[0].status, frequency: matchingCustomerSchedules[0].frequency }
                : null
            }
            defaultPickupDate={booking.confirmed_pickup_date ?? booking.preferred_pickup_date}
            defaultPickupTime={booking.confirmed_pickup_time ?? booking.preferred_pickup_time}
            defaultDeliveryTime={booking.confirmed_delivery_time ?? booking.preferred_delivery_time}
          />
        </div>
      </section>

      {(booking.special_instructions ||
        booking.special_instructions_zh ||
        booking.dry_cleaning_item_description ||
        booking.dry_cleaning_notes ||
        booking.admin_notes) && (
        <section className="rounded-xl border border-border bg-background p-4">
          <h2 className="font-display text-base font-semibold">Notes 备注</h2>
          <div className="mt-3 space-y-3 text-sm">
            {booking.special_instructions && (
              <div>
                <div className="text-muted-foreground">Customer notes 客户备注</div>
                <div>{booking.special_instructions}</div>
                {booking.special_instructions_zh && (
                  <div className="text-muted-foreground/80">{booking.special_instructions_zh}</div>
                )}
              </div>
            )}
            {booking.dry_cleaning_item_description && (
              <div>
                <div className="text-muted-foreground">Dry-cleaning items 干洗物品</div>
                <div>{booking.dry_cleaning_item_description}</div>
                {booking.dry_cleaning_item_description_zh && (
                  <div className="text-muted-foreground/80">{booking.dry_cleaning_item_description_zh}</div>
                )}
              </div>
            )}
            {booking.dry_cleaning_notes && (
              <div>
                <div className="text-muted-foreground">Dry-cleaning notes 干洗备注</div>
                <div>{booking.dry_cleaning_notes}</div>
              </div>
            )}
            {booking.admin_notes && (
              <div>
                <div className="text-muted-foreground">Staff notes 内部备注</div>
                <div>{booking.admin_notes}</div>
              </div>
            )}
          </div>
        </section>
      )}

      <DeleteBooking bookingId={booking.id} customerName={booking.name} />
    </div>
  );
}
