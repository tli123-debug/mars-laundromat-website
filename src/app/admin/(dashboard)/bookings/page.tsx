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

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function AdminBookingsPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Couldn&apos;t load bookings: {error.message}
      </p>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Bookings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {bookings.length} request{bookings.length === 1 ? "" : "s"}
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Pickup</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Requested</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                  <span className="text-sm text-muted-foreground">
                    {booking.special_instructions || "—"}
                  </span>
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
