/**
 * Hand-written to match supabase/migrations/20260817000000_create_bookings_table.sql,
 * 20260819000000_pickup_delivery_windows_to_times.sql,
 * 20260820000000_add_paid_to_bookings.sql,
 * 20260821000000_add_special_instructions_zh_to_bookings.sql, and
 * 20260822000000_pickup_delivery_v1.sql.
 * If the schema changes, update this alongside the migration (or regenerate via
 * `npx supabase gen types typescript --linked --schema public` once the project is CLI-linked).
 */

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "picked_up"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

export type BookingSource = "website" | "phone";
export type ContactPreference = "text" | "call";
export type ServiceSpeed = "standard" | "flexible" | "same_day";
export type QuoteStatus = "not_started" | "draft" | "sent";
export type PaymentMethod = "cash" | "zelle";

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
          confirmed_pickup_date: string | null;
          confirmed_pickup_time: string | null;
          confirmed_delivery_date: string | null;
          confirmed_delivery_time: string | null;
          special_instructions: string | null;
          special_instructions_zh: string | null;
          status: BookingStatus;
          admin_notes: string | null;
          paid: boolean;
          booking_source: BookingSource;
          contact_preference: ContactPreference;
          sms_consent: boolean;
          sms_consent_at: string | null;
          service_speed: ServiceSpeed;
          // numeric(6,2) / integer — PostgREST returns both as JSON numbers here
          // (the string-coercion behavior applies to bigint/unbounded numeric,
          // not this bounded case), so neither needs string typing.
          actual_weight_lb: number | null;
          billable_weight_lb: number | null;
          laundry_charge_cents: number | null;
          same_day_fee_cents: number | null;
          surcharge_total_cents: number;
          surcharge_notes: string | null;
          // Generated column (laundry_charge_cents + same_day_fee_cents +
          // surcharge_total_cents) — read-only, omitted from Insert below.
          quote_total_cents: number | null;
          quote_status: QuoteStatus;
          quote_sent_at: string | null;
          payment_method: PaymentMethod | null;
          paid_at: string | null;
          payment_verified_by: string | null;
          created_by: string | null;
          updated_by: string | null;
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
          confirmed_pickup_date?: string | null;
          confirmed_pickup_time?: string | null;
          confirmed_delivery_date?: string | null;
          confirmed_delivery_time?: string | null;
          special_instructions?: string | null;
          special_instructions_zh?: string | null;
          status?: BookingStatus;
          admin_notes?: string | null;
          paid?: boolean;
          booking_source?: BookingSource;
          contact_preference?: ContactPreference;
          sms_consent?: boolean;
          sms_consent_at?: string | null;
          service_speed?: ServiceSpeed;
          actual_weight_lb?: number | null;
          billable_weight_lb?: number | null;
          laundry_charge_cents?: number | null;
          same_day_fee_cents?: number | null;
          surcharge_total_cents?: number;
          surcharge_notes?: string | null;
          quote_status?: QuoteStatus;
          quote_sent_at?: string | null;
          payment_method?: PaymentMethod | null;
          paid_at?: string | null;
          payment_verified_by?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
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
          confirmed_pickup_date?: string | null;
          confirmed_pickup_time?: string | null;
          confirmed_delivery_date?: string | null;
          confirmed_delivery_time?: string | null;
          special_instructions?: string | null;
          special_instructions_zh?: string | null;
          status?: BookingStatus;
          admin_notes?: string | null;
          paid?: boolean;
          booking_source?: BookingSource;
          contact_preference?: ContactPreference;
          sms_consent?: boolean;
          sms_consent_at?: string | null;
          service_speed?: ServiceSpeed;
          actual_weight_lb?: number | null;
          billable_weight_lb?: number | null;
          laundry_charge_cents?: number | null;
          same_day_fee_cents?: number | null;
          surcharge_total_cents?: number;
          surcharge_notes?: string | null;
          quote_status?: QuoteStatus;
          quote_sent_at?: string | null;
          payment_method?: PaymentMethod | null;
          paid_at?: string | null;
          payment_verified_by?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
        };
        // created_by/updated_by/payment_verified_by reference auth.users, not a
        // public-schema table — included for parity with what the Supabase CLI
        // would generate, but PostgREST's relational-embedding shorthand
        // (.select('*, users(*)')) doesn't work through them since they cross
        // schemas; this app only ever reads these as plain uuid columns.
        Relationships: [
          {
            foreignKeyName: "bookings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_payment_verified_by_fkey";
            columns: ["payment_verified_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
