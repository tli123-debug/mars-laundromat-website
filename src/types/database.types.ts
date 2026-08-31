/**
 * Hand-written to match supabase/migrations/20260817000000_create_bookings_table.sql,
 * 20260819000000_pickup_delivery_windows_to_times.sql,
 * 20260820000000_add_paid_to_bookings.sql,
 * 20260821000000_add_special_instructions_zh_to_bookings.sql,
 * 20260822000000_pickup_delivery_v1.sql,
 * 20260826000000_dry_cleaning_expansion.sql,
 * 20260827000000_status_simplification_and_delete_policy.sql,
 * 20260828000000_same_day_fee_reduction.sql, and
 * 20260830000000_recurring_pickups_v1.sql.
 * If the schema changes, update this alongside the migration (or regenerate via
 * `npx supabase gen types typescript --linked --schema public` once the project is CLI-linked).
 */

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "picked_up"
  | "ready_for_delivery"
  | "completed"
  | "cancelled";

// 'recurring' is system-generated only — an anon website submission's RLS
// policy still requires booking_source = 'website'; only
// generate_due_recurring_bookings() ever writes 'recurring'.
export type BookingSource = "website" | "phone" | "recurring";
export type ContactPreference = "text" | "call";
// 'dry_cleaning_timeline' is not a customer-chosen speed tier like the
// other three — every dry_cleaning/both booking is normalized to it
// server-side, since dry cleaning's turnaround is a fixed 3-4 calendar days,
// not a standard/flexible/same_day choice. See resolveServiceSpeed() in
// src/lib/service-type.ts.
export type ServiceSpeed = "standard" | "flexible" | "same_day" | "dry_cleaning_timeline";
export type ServiceType = "wash_and_fold" | "dry_cleaning" | "both";
export type QuoteStatus = "not_started" | "draft" | "sent";
export type PaymentMethod = "cash" | "zelle";
export type RecurringScheduleStatus = "active" | "paused" | "cancelled";
export type RecurringFrequency = "weekly" | "every_two_weeks";

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
          // Generated column (laundry_charge_cents + dry_cleaning_effective_charge_cents
          // + same_day_fee_cents + surcharge_total_cents) — read-only, omitted from Insert below.
          quote_total_cents: number | null;
          quote_status: QuoteStatus;
          quote_sent_at: string | null;
          payment_method: PaymentMethod | null;
          paid_at: string | null;
          payment_verified_by: string | null;
          created_by: string | null;
          updated_by: string | null;
          service_type: ServiceType;
          dry_cleaning_item_description: string | null;
          dry_cleaning_item_description_zh: string | null;
          dry_cleaning_item_subtotal_cents: number | null;
          // App-computed (like laundry_charge_cents), not itself a generated
          // column — quote_total_cents can't reference another generated
          // column. See buildServiceQuoteUpdatePayload() in quote-validation.ts.
          dry_cleaning_effective_charge_cents: number | null;
          dry_cleaning_notes: string | null;
          // Both null (an ordinary booking) or both set (a recurring
          // occurrence) — never one without the other, enforced by
          // bookings_recurring_fields_check.
          recurring_schedule_id: string | null;
          recurring_occurrence_date: string | null;
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
          service_type?: ServiceType;
          dry_cleaning_item_description?: string | null;
          dry_cleaning_item_description_zh?: string | null;
          dry_cleaning_item_subtotal_cents?: number | null;
          dry_cleaning_effective_charge_cents?: number | null;
          dry_cleaning_notes?: string | null;
          recurring_schedule_id?: string | null;
          recurring_occurrence_date?: string | null;
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
          service_type?: ServiceType;
          dry_cleaning_item_description?: string | null;
          dry_cleaning_item_description_zh?: string | null;
          dry_cleaning_item_subtotal_cents?: number | null;
          dry_cleaning_effective_charge_cents?: number | null;
          dry_cleaning_notes?: string | null;
          recurring_schedule_id?: string | null;
          recurring_occurrence_date?: string | null;
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
          {
            foreignKeyName: "bookings_recurring_schedule_id_fkey";
            columns: ["recurring_schedule_id"];
            isOneToOne: false;
            referencedRelation: "recurring_schedules";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_schedules: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          status: RecurringScheduleStatus;
          frequency: RecurringFrequency;
          customer_name: string;
          customer_phone: string;
          customer_phone_normalized: string;
          address: string;
          pickup_time: string;
          delivery_time: string;
          next_pickup_date: string;
          recurring_instructions: string | null;
          recurring_instructions_zh: string | null;
          source_booking_id: string;
          recurring_consent_at: string;
          created_by: string;
          updated_by: string;
          paused_at: string | null;
          cancelled_at: string | null;
          last_generated_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          status?: RecurringScheduleStatus;
          frequency: RecurringFrequency;
          customer_name: string;
          customer_phone: string;
          customer_phone_normalized: string;
          address: string;
          pickup_time: string;
          delivery_time: string;
          next_pickup_date: string;
          recurring_instructions?: string | null;
          recurring_instructions_zh?: string | null;
          source_booking_id: string;
          recurring_consent_at: string;
          created_by: string;
          updated_by: string;
          paused_at?: string | null;
          cancelled_at?: string | null;
          last_generated_at?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          status?: RecurringScheduleStatus;
          frequency?: RecurringFrequency;
          customer_name?: string;
          customer_phone?: string;
          customer_phone_normalized?: string;
          address?: string;
          pickup_time?: string;
          delivery_time?: string;
          next_pickup_date?: string;
          recurring_instructions?: string | null;
          recurring_instructions_zh?: string | null;
          source_booking_id?: string;
          recurring_consent_at?: string;
          created_by?: string;
          updated_by?: string;
          paused_at?: string | null;
          cancelled_at?: string | null;
          last_generated_at?: string | null;
        };
        // created_by/updated_by reference auth.users, same cross-schema
        // caveat as bookings' own created_by/updated_by above — read as
        // plain uuid columns, never relationally embedded.
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_source_booking_id_fkey";
            columns: ["source_booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_schedules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_schedules_updated_by_fkey";
            columns: ["updated_by"];
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
