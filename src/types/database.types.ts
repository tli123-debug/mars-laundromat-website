/**
 * Hand-written to match supabase/migrations/20260817000000_create_bookings_table.sql.
 * If the schema changes, update this alongside the migration (or regenerate via
 * `npx supabase gen types typescript --linked --schema public` once the project is CLI-linked).
 */

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type TimeWindow = "morning" | "afternoon" | "evening";

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
          preferred_pickup_window: TimeWindow;
          preferred_delivery_date: string | null;
          preferred_delivery_window: TimeWindow | null;
          special_instructions: string | null;
          status: BookingStatus;
          admin_notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name: string;
          phone: string;
          address: string;
          preferred_pickup_date: string;
          preferred_pickup_window: TimeWindow;
          preferred_delivery_date?: string | null;
          preferred_delivery_window?: TimeWindow | null;
          special_instructions?: string | null;
          status?: BookingStatus;
          admin_notes?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name?: string;
          phone?: string;
          address?: string;
          preferred_pickup_date?: string;
          preferred_pickup_window?: TimeWindow;
          preferred_delivery_date?: string | null;
          preferred_delivery_window?: TimeWindow | null;
          special_instructions?: string | null;
          status?: BookingStatus;
          admin_notes?: string | null;
        };
      };
    };
  };
}
