import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * The dedicated calendar-sync worker identity — a real Supabase Auth user
 * the owner creates once (dashboard, never scripted — creating a user via
 * the admin API needs the service-role key this project never uses; see
 * the runbook). Its RLS access is scoped to exactly calendar_sync_config/
 * calendar_sync_state via the worker_user_id check in
 * 20260919000000_calendar_sync_outbox.sql — not bookings, and not the
 * broad "any authenticated user is trusted" model the rest of this app's
 * staff policies use.
 *
 * Session is cached at module scope so a warm serverless invocation
 * reuses it instead of calling signInWithPassword() (a rate-limited grant
 * type) on every single sync attempt — both the eager after() path and
 * the cron recovery route share this same cache within one running
 * process.
 */

let cachedClient: SupabaseClient<Database> | null = null;
let cachedSessionExpiresAt = 0;

const SESSION_REFRESH_MARGIN_SECONDS = 60;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function createAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * Returns a Supabase client authenticated as the calendar-sync worker.
 * Never logs the password; only ever reads it from
 * CALENDAR_SYNC_WORKER_PASSWORD, a server-only env var.
 */
export async function getCalendarSyncWorkerClient(): Promise<SupabaseClient<Database>> {
  const nowSeconds = Date.now() / 1000;
  if (cachedClient && cachedSessionExpiresAt - nowSeconds > SESSION_REFRESH_MARGIN_SECONDS) {
    return cachedClient;
  }

  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({
    email: requireEnv("CALENDAR_SYNC_WORKER_EMAIL"),
    password: requireEnv("CALENDAR_SYNC_WORKER_PASSWORD"),
  });
  if (error) {
    throw new Error(`Calendar sync worker sign-in failed: ${error.message}`);
  }

  const { data } = await client.auth.getSession();
  cachedSessionExpiresAt = data.session?.expires_at ?? 0;
  cachedClient = client;
  return client;
}

/** Test-only: forces the next call to re-authenticate instead of reusing the cache. */
export function resetCalendarSyncWorkerSessionCache(): void {
  cachedClient = null;
  cachedSessionExpiresAt = 0;
}
