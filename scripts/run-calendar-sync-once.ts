/**
 * Manual test/diagnostic utility. Authenticates as the dedicated calendar
 * worker and reconciles one bounded batch against the configured CalDAV
 * calendar. Credentials are read only from process environment variables;
 * use run-calendar-sync-test.ps1 so passwords are entered with hidden prompts
 * and removed from the shell immediately afterward.
 */
import { createClient } from "@supabase/supabase-js";
import { processPendingCalendarSyncBatch } from "../src/lib/calendar-sync/sync-worker";
import type { Database } from "../src/types/database.types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main() {
  const client = createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { error: signInError } = await client.auth.signInWithPassword({
    email: requireEnv("CALENDAR_SYNC_WORKER_EMAIL"),
    password: requireEnv("CALENDAR_SYNC_WORKER_PASSWORD"),
  });
  if (signInError) {
    throw new Error(`Calendar worker sign-in failed: ${signInError.message}`);
  }

  const result = await processPendingCalendarSyncBatch(
    client,
    {
      fetchImpl: fetch,
      credentials: {
        username: requireEnv("ICLOUD_CALDAV_USERNAME"),
        appPassword: requireEnv("ICLOUD_CALDAV_APP_PASSWORD"),
      },
      adminBaseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.marslaundromat.com",
    },
    3
  );

  console.log("Calendar sync result:", result);
}

main().catch((error) => {
  console.error("Calendar sync failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
