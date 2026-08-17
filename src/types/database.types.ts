/**
 * Hand-written to match supabase/migrations/20260817000000_create_bookings_table.sql,
 * 20260819000000_pickup_delivery_windows_to_times.sql, and
 * 20260820000000_add_paid_to_bookings.sql.
 * If the schema changes, update this alongside the migration (or regenerate via
 * `npx supabase gen types typescript --linked --schema public` once the project is CLI-linked).
 */

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface Database {
  public: {
    Tables: {
      bookings: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          name: string;
          phone: string;
          address: string;
          preferred_pickup_date: string;
          preferred_pickup_time: string;
          preferred_delivery_date: string | null;
          preferred_delivery_time: string | null;
          special_instructions: string | null;
          status: BookingStatus;
          admin_notes: string | null;
          paid: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name: string;
          phone: string;
          address: string;
          preferred_pickup_date: string;
          preferred_pickup_time: string;
          preferred_delivery_date?: string | null;
          preferred_delivery_time?: string | null;
          special_instructions?: string | null;
          status?: BookingStatus;
          admin_notes?: string | null;
          paid?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name?: string;
          phone?: string;
          address?: string;
          preferred_pickup_date?: string;
          preferred_pickup_time?: string;
          preferred_delivery_date?: string | null;
          preferred_delivery_time?: string | null;
          special_instructions?: string | null;
          status?: BookingStatus;
          admin_notes?: string | null;
          paid?: boolean;
        };
        // Required by @supabase/postgrest-js's GenericTable constraint even
        // though this table has no foreign keys — without it (and without
        // Views/Functions below), the client silently types every table as
        // `never` instead of erroring, which only surfaces as a `next build`
        // type-check failure, never in `next dev`.
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
