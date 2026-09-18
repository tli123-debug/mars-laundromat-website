/**
 * Hand-written to match supabase/migrations/20260817000000_create_bookings_table.sql,
 * 20260819000000_pickup_delivery_windows_to_times.sql,
 * 20260820000000_add_paid_to_bookings.sql,
 * 20260821000000_add_special_instructions_zh_to_bookings.sql,
 * 20260822000000_pickup_delivery_v1.sql,
 * 20260826000000_dry_cleaning_expansion.sql,
 * 20260827000000_status_simplification_and_delete_policy.sql,
 * 20260828000000_same_day_fee_reduction.sql,
 * 20260830000000_recurring_pickups_v1.sql,
 * 20260908000000_add_acquisition_source_to_bookings.sql,
 * 20260917000000_booking_submission_idempotency.sql, and
 * 20260919000000_calendar_sync_outbox.sql.
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
// How the original customer discovered Mars — distinct from BookingSource,
// which means how the booking *record* was created (website/phone/recurring).
// See src/lib/acquisition-source.ts, the shared source of truth for this list.
export type AcquisitionSource =
  | "google_ads"
  | "google_business"
  | "google_search_maps"
  | "nextdoor"
  | "facebook_instagram"
  | "meta_ads"
  | "apartment_flyer"
  | "storefront"
  | "referral"
  | "existing_customer"
  | "other";

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
          acquisition_source: AcquisitionSource | null;
          // Minted by the browser once per logical submission attempt and
          // reused across retries — see submit_booking()/
          // find_existing_booking_submission() in
          // 20260917000000_booking_submission_idempotency.sql. Null for
          // every non-website row (phone, recurring).
          client_submission_id: string | null;
          // Durable — set ONCE at insert time by a BEFORE INSERT trigger
          // from booking_source + calendar_sync_config at that instant,
          // never recalculated later. See 20260919000000_calendar_sync_
          // outbox.sql and src/lib/calendar-sync/desired-state.ts.
          calendar_sync_eligible: boolean;
          // Mutable staff override — no dedicated admin UI in this pass;
          // set directly via SQL if a specific booking needs excluding.
          calendar_sync_excluded: boolean;
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
          acquisition_source?: AcquisitionSource | null;
          client_submission_id?: string | null;
          // Ignored even if supplied — the BEFORE INSERT trigger always
          // overwrites this with its own computed value.
          calendar_sync_eligible?: boolean;
          calendar_sync_excluded?: boolean;
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
          acquisition_source?: AcquisitionSource | null;
          client_submission_id?: string | null;
          calendar_sync_eligible?: boolean;
          calendar_sync_excluded?: boolean;
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
      calendar_sync_config: {
        // Singleton — always exactly one row, id = true. Application
        // code never selects from this table directly (see
        // src/lib/calendar-sync/sync-worker.ts's own comment on why);
        // typed here for completeness against the real schema.
        Row: {
          id: boolean;
          enabled: boolean;
          launched_at: string | null;
          active_calendar_identity: string | null;
          worker_user_id: string | null;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          enabled?: boolean;
          launched_at?: string | null;
          active_calendar_identity?: string | null;
          worker_user_id?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          enabled?: boolean;
          launched_at?: string | null;
          active_calendar_identity?: string | null;
          worker_user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      calendar_sync_state: {
        // The outbox — one row per (booking_id, leg). No FK to bookings
        // (deliberately — see 20260919000000_calendar_sync_outbox.sql).
        Row: {
          id: string;
          booking_id: string;
          leg: "pickup" | "delivery";
          desired_version: number;
          synced_version: number | null;
          desired_calendar_identity: string | null;
          synced_calendar_identity: string | null;
          desired_disposition: "absent" | "active" | "historical";
          fulfilled: boolean;
          desired_start: string | null;
          desired_end: string | null;
          desired_summary: string | null;
          desired_location: string | null;
          desired_phone: string | null;
          desired_service_type: string | null;
          desired_instructions: string | null;
          ical_uid: string;
          caldav_href: string | null;
          remote_etag: string | null;
          attempt_count: number;
          next_attempt_at: string;
          last_attempted_at: string | null;
          last_success_at: string | null;
          last_error: string | null;
          claimed_at: string | null;
          claimed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          leg: "pickup" | "delivery";
          desired_version?: number;
          synced_version?: number | null;
          desired_calendar_identity?: string | null;
          synced_calendar_identity?: string | null;
          desired_disposition: "absent" | "active" | "historical";
          fulfilled?: boolean;
          desired_start?: string | null;
          desired_end?: string | null;
          desired_summary?: string | null;
          desired_location?: string | null;
          desired_phone?: string | null;
          desired_service_type?: string | null;
          desired_instructions?: string | null;
          ical_uid: string;
          caldav_href?: string | null;
          remote_etag?: string | null;
          attempt_count?: number;
          next_attempt_at?: string;
          last_attempted_at?: string | null;
          last_success_at?: string | null;
          last_error?: string | null;
          claimed_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          leg?: "pickup" | "delivery";
          desired_version?: number;
          synced_version?: number | null;
          desired_calendar_identity?: string | null;
          synced_calendar_identity?: string | null;
          desired_disposition?: "absent" | "active" | "historical";
          fulfilled?: boolean;
          desired_start?: string | null;
          desired_end?: string | null;
          desired_summary?: string | null;
          desired_location?: string | null;
          desired_phone?: string | null;
          desired_service_type?: string | null;
          desired_instructions?: string | null;
          ical_uid?: string;
          caldav_href?: string | null;
          remote_etag?: string | null;
          attempt_count?: number;
          next_attempt_at?: string;
          last_attempted_at?: string | null;
          last_success_at?: string | null;
          last_error?: string | null;
          claimed_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    // generate_due_recurring_bookings() (20260830000000_recurring_pickups_v1.sql)
    // is deliberately absent here — it's only ever invoked by pg_cron
    // (`select public.generate_due_recurring_bookings();`), never from
    // application code via supabase.rpc(), so it has never needed a type
    // here. find_existing_booking_submission/submit_booking
    // (20260917000000_booking_submission_idempotency.sql) are the first
    // functions this app calls via .rpc() — see src/app/(site)/book/actions.ts.
    Functions: {
      find_existing_booking_submission: {
        Args: {
          p_client_submission_id: string;
          p_name: string;
          p_phone: string;
          p_address: string;
          p_service_type: string;
          p_service_speed: string;
          p_pickup_date: string;
          p_pickup_time: string;
          p_delivery_date: string;
          p_delivery_time: string;
          p_dry_cleaning_item_description: string | null;
          p_special_instructions: string | null;
        };
        Returns: { booking_id: string | null; outcome: string }[];
      };
      submit_booking: {
        Args: {
          p_client_submission_id: string;
          p_name: string;
          p_phone: string;
          p_address: string;
          p_service_type: string;
          p_service_speed: string;
          p_pickup_date: string;
          p_pickup_time: string;
          p_delivery_date: string;
          p_delivery_time: string;
          p_dry_cleaning_item_description: string | null;
          p_dry_cleaning_item_description_zh: string | null;
          p_special_instructions: string | null;
          p_special_instructions_zh: string | null;
          p_acquisition_source: string | null;
        };
        Returns: { booking_id: string; outcome: string }[];
      };
      // Owner-only (no anon/authenticated grant) — run manually via the
      // Supabase SQL editor per the launch runbook, never called from
      // application code. Typed here anyway for completeness/documentation.
      enable_calendar_sync: {
        Args: { p_calendar_identity?: string | null };
        Returns: undefined;
      };
      // The calendar-sync worker's lease-based claim — see
      // src/lib/calendar-sync/sync-worker.ts.
      claim_calendar_sync_batch: {
        Args: { p_limit: number; p_claimed_by: string; p_lease_seconds?: number };
        Returns: Database["public"]["Tables"]["calendar_sync_state"]["Row"][];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
