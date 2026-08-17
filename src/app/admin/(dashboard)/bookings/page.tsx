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
import { timeSlotLabel } from "@/lib/validations/booking-schema";
import { StatusSelect } from "./status-select";
import { PaidCheckbox } from "./paid-checkbox";
import { BookingsFilters } from "./bookings-filters";
import { isDateRangeOption, getDateRange, type DateRangeOption } from "./date-range";

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminBookingsPage(props: PageProps<"/admin/bookings">) {
  await requireAdmin();

  const searchParams = await props.searchParams;
  const rawRange = first(searchParams.range);
  const range: DateRangeOption = isDateRangeOption(rawRange) ? rawRange : "all-time";
  const search = (first(searchParams.q) ?? "").trim();

  const supabase = await createClient();

  let bookingsQuery = supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  const { start, end } = getDateRange(range);
  if (start) bookingsQuery = bookingsQuery.gte("created_at", start.toISOString());
  if (end) bookingsQuery = bookingsQuery.lt("created_at", end.toISOString());

  const [{ data: rows, error }, { data: allForCounts }] = await Promise.all([
    bookingsQuery,
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
        <BookingsFilters currentRange={range} currentSearch={search} />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {bookings.length} result{bookings.length === 1 ? "" : "s"}
      </p>

      <div className="mt-2 overflow-hidden rounded-xl border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Pickup 取件</TableHead>
              <TableHead>Delivery 送件</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Requested</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No bookings yet.
                </TableCell>
              </TableRow>
            )}
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>
                  <StatusSelect bookingId={booking.id} status={booking.status} />
                </TableCell>
                <TableCell>
                  <PaidCheckbox bookingId={booking.id} paid={booking.paid} />
                </TableCell>
                <TableCell>
                  <div className="font-medium">{booking.name}</div>
                  <div className="text-sm text-muted-foreground">{booking.phone}</div>
                  <div className="text-sm text-muted-foreground">{booking.address}</div>
                </TableCell>
                <TableCell>
                  <div>{formatDate(booking.preferred_pickup_date)}</div>
                  <div className="text-sm text-muted-foreground">
                    {timeSlotLabel(booking.preferred_pickup_time)}
                  </div>
                </TableCell>
                <TableCell>
                  {booking.preferred_delivery_date ? (
                    <>
                      <div>{formatDate(booking.preferred_delivery_date)}</div>
                      <div className="text-sm text-muted-foreground">
                        {timeSlotLabel(booking.preferred_delivery_time)}
                      </div>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[220px] whitespace-normal break-words">
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
