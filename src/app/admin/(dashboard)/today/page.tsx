import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import { categorizeBooking, type BookingColumn } from "@/lib/categorize-booking";
import { getBrooklynToday } from "@/lib/booking-hours";
import { BookingCard } from "./booking-card";
import type { Database } from "@/types/database.types";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

const COLUMNS: { key: BookingColumn; label: string }[] = [
  { key: "pending_review", label: "Pending Review 待处理" },
  { key: "awaiting_customer", label: "Awaiting Customer 等待客户确认" },
  { key: "todays_pickups", label: "Today's Pickups 今日取件" },
  { key: "at_store", label: "At Store 已到店" },
  { key: "ready_for_delivery", label: "Ready for Delivery 待送件" },
  { key: "todays_deliveries", label: "Today's Deliveries 今日送件" },
  { key: "unpaid", label: "Unpaid 未付款" },
];

export default async function AdminTodayPage() {
  await requireAdmin();

  const supabase = await createClient();
  // Cancelled bookings always categorize to [] (see categorize-booking.ts),
  // so there's no need to fetch them at all. Everything else is fetched
  // regardless of date — overdue/missed bookings from any day still need to
  // surface (categorizeBooking uses <=, not =, for exactly this reason).
  const { data: rows, error } = await supabase
    .from("bookings")
    .select("*")
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <p className="text-sm text-destructive">Couldn&apos;t load bookings: {error.message}</p>
    );
  }

  const today = getBrooklynToday();
  const bookings = rows ?? [];

  const grouped: Record<BookingColumn, BookingRow[]> = {
    pending_review: [],
    awaiting_customer: [],
    todays_pickups: [],
    at_store: [],
    ready_for_delivery: [],
    todays_deliveries: [],
    unpaid: [],
  };

  for (const booking of bookings) {
    for (const column of categorizeBooking(booking, today)) {
      grouped[column].push(booking);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Today 今日概览</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {bookings.length} active booking{bookings.length === 1 ? "" : "s"} across all sections
        below.
      </p>

      <div className="mt-8 space-y-10">
        {COLUMNS.map((column) => {
          const columnBookings = grouped[column.key];
          return (
            <section key={column.key}>
              <h2 className="font-display text-lg font-semibold">
                {column.label}{" "}
                <span className="font-sans text-sm font-normal text-muted-foreground">
                  ({columnBookings.length})
                </span>
              </h2>
              {columnBookings.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nothing here right now. 目前没有。
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {columnBookings.map((booking) => (
                    <BookingCard key={`${column.key}-${booking.id}`} booking={booking} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
