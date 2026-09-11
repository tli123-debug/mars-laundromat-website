import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { windowLabel } from "@/lib/validations/booking-schema";
import { StatusSelect } from "./status-select";
import { PaymentControl } from "./payment-control";
import { ServiceTypeBadge } from "./service-type-badge";
import { RecurringBadge } from "./recurring-badge";
import { AcquisitionSourceBadge } from "./acquisition-source-badge";
import { BookingsFilters } from "./bookings-filters";
import { isDateRangeOption, getDateRange, type DateRangeOption } from "./date-range";
import { isBookingView, statusesForView, type BookingView } from "./view-filter";
import {
  acquisitionSourceQueryFilterFor,
  isAcquisitionSourceFilter,
  type AcquisitionSourceFilter,
} from "./acquisition-source-filter";
import type { Database } from "@/types/database.types";

// Includes the embedded recurring_schedules relation — see the same
// .returns<>() comment in today/page.tsx.
type BookingRow = Database["public"]["Tables"]["bookings"]["Row"] & {
  recurring_schedules: Pick<
    Database["public"]["Tables"]["recurring_schedules"]["Row"],
    "status" | "frequency"
  > | null;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function BookingWindowCell({
  requestedDate,
  requestedTime,
  confirmedDate,
  confirmedTime,
  status,
}: {
  requestedDate: string | null;
  requestedTime: string | null;
  confirmedDate: string | null;
  confirmedTime: string | null;
  status: BookingRow["status"];
}) {
  const hasUpdatedWindow = Boolean(confirmedDate && confirmedTime);
  const date = hasUpdatedWindow ? confirmedDate : requestedDate;
  const time = hasUpdatedWindow ? confirmedTime : requestedTime;

  if (!date || !time) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const label = hasUpdatedWindow
    ? status === "pending"
      ? "Proposed 建议"
      : "Confirmed 已确认"
    : "Requested 客户请求";

  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div>{formatDate(date)}</div>
      <div className="text-sm text-muted-foreground">{windowLabel(time)}</div>
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminBookingsPage(props: PageProps<"/admin/bookings">) {
  await requireAdmin();

  const searchParams = await props.searchParams;
  const rawRange = first(searchParams.range);
  const range: DateRangeOption = isDateRangeOption(rawRange) ? rawRange : "all-time";
  const rawView = first(searchParams.view);
  const view: BookingView = isBookingView(rawView) ? rawView : "active";
  const search = (first(searchParams.q) ?? "").trim();
  const rawSource = first(searchParams.source);
  const sourceFilter: AcquisitionSourceFilter = isAcquisitionSourceFilter(rawSource) ? rawSource : "all";

  const supabase = await createClient();

  // recurring_schedules!bookings_recurring_schedule_id_fkey disambiguates
  // the embed direction (see the same comment in bookings/[id]/page.tsx) —
  // one query for the whole list, not one per row.
  let bookingsQuery = supabase
    .from("bookings")
    .select("*, recurring_schedules!bookings_recurring_schedule_id_fkey(status, frequency)")
    .order("created_at", { ascending: false });

  const statuses = statusesForView(view);
  if (statuses) bookingsQuery = bookingsQuery.in("status", statuses);

  const { start, end } = getDateRange(range);
  if (start) bookingsQuery = bookingsQuery.gte("created_at", start.toISOString());
  if (end) bookingsQuery = bookingsQuery.lt("created_at", end.toISOString());

  // Filtering happens in the query itself, not by hiding already-rendered
  // rows — acquisitionSourceQueryFilterFor() decides which Supabase method
  // applies (or none, for "all").
  const sourceQueryFilter = acquisitionSourceQueryFilterFor(sourceFilter);
  if (sourceQueryFilter.kind === "is_null") {
    bookingsQuery = bookingsQuery.is("acquisition_source", null);
  } else if (sourceQueryFilter.kind === "equals") {
    bookingsQuery = bookingsQuery.eq("acquisition_source", sourceQueryFilter.value);
  }

  const [{ data: rows, error }, { data: allForCounts }] = await Promise.all([
    bookingsQuery.returns<BookingRow[]>(),
    supabase.from("bookings").select("status, created_at"),
  ]);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Couldn&apos;t load bookings: {error.message}
      </p>
    );
  }

  const term = search.toLowerCase();
  const bookings = term
    ? rows.filter(
        (b) =>
          b.name.toLowerCase().includes(term) ||
          b.phone.toLowerCase().includes(term) ||
          b.address.toLowerCase().includes(term)
      )
    : rows;

  const thisWeekStart = getDateRange("this-week").start!;
  const pendingCount = (allForCounts ?? []).filter((b) => b.status === "pending").length;
  const confirmedThisWeekCount = (allForCounts ?? []).filter(
    (b) => b.status === "confirmed" && new Date(b.created_at) >= thisWeekStart
  ).length;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Bookings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {pendingCount} pending · {confirmedThisWeekCount} confirmed this week
      </p>

      <div className="mt-6">
        <BookingsFilters
          currentRange={range}
          currentSearch={search}
          currentView={view}
          currentSource={sourceFilter}
        />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {bookings.length} result{bookings.length === 1 ? "" : "s"}
      </p>

      <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[210px]">Status</TableHead>
              <TableHead className="min-w-[210px]">Paid</TableHead>
              <TableHead className="min-w-[200px]">Customer</TableHead>
              <TableHead className="min-w-[140px]">Pickup 取件</TableHead>
              <TableHead className="min-w-[140px]">Delivery 送件</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Requested</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {view === "active"
                    ? "No active bookings."
                    : view === "archived"
                      ? "No archived bookings."
                      : "No bookings yet."}
                </TableCell>
              </TableRow>
            )}
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="align-top">
                  <StatusSelect
                    bookingId={booking.id}
                    status={booking.status}
                    confirmedPickupDate={booking.confirmed_pickup_date}
                    confirmedPickupTime={booking.confirmed_pickup_time}
                    confirmedDeliveryDate={booking.confirmed_delivery_date}
                    confirmedDeliveryTime={booking.confirmed_delivery_time}
                    paid={booking.paid}
                    paymentMethod={booking.payment_method}
                    showGuidance={false}
                  />
                </TableCell>
                <TableCell className="align-top">
                  <PaymentControl
                    bookingId={booking.id}
                    paid={booking.paid}
                    paymentMethod={booking.payment_method}
                    status={booking.status}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/bookings/${booking.id}`} className="font-medium hover:underline">
                      {booking.name}
                    </Link>
                    <ServiceTypeBadge serviceType={booking.service_type} />
                    {booking.recurring_schedules && (
                      <RecurringBadge
                        status={booking.recurring_schedules.status}
                        frequency={booking.recurring_schedules.frequency}
                      />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{booking.phone}</div>
                  <div className="text-sm text-muted-foreground">{booking.address}</div>
                  <div className="mt-1">
                    <AcquisitionSourceBadge acquisitionSource={booking.acquisition_source} />
                  </div>
                </TableCell>
                <TableCell>
                  <BookingWindowCell
                    requestedDate={booking.preferred_pickup_date}
                    requestedTime={booking.preferred_pickup_time}
                    confirmedDate={booking.confirmed_pickup_date}
                    confirmedTime={booking.confirmed_pickup_time}
                    status={booking.status}
                  />
                </TableCell>
                <TableCell>
                  <BookingWindowCell
                    requestedDate={booking.preferred_delivery_date}
                    requestedTime={booking.preferred_delivery_time}
                    confirmedDate={booking.confirmed_delivery_date}
                    confirmedTime={booking.confirmed_delivery_time}
                    status={booking.status}
                  />
                </TableCell>
                <TableCell className="max-w-[320px] whitespace-normal break-words">
                  <span className="block text-sm text-muted-foreground">
                    {booking.special_instructions || "—"}
                  </span>
                  {booking.special_instructions_zh && (
                    <span className="mt-1 block text-sm text-muted-foreground/80">
                      {booking.special_instructions_zh}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(booking.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
