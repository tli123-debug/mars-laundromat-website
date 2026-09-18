/**
 * Manual, one-time setup utility — lists the display name and CalDAV
 * collection URL of every calendar visible to the configured iCloud
 * account, so the owner can identify "Mars Pickups & Deliveries" (or a
 * throwaway test calendar) and copy its URL into
 * calendar_sync_config.active_calendar_identity (see the runbook).
 *
 * This is the ONLY place in this project tsdav's own DAVClient/discovery
 * machinery is used — the sync worker itself never does live discovery,
 * it uses the URL this script reports, stored once. Never prints
 * ICLOUD_CALDAV_APP_PASSWORD or any Authorization header value.
 *
 * Run with:
 *   npx tsx scripts/discover-caldav-calendars.ts
 * after setting ICLOUD_CALDAV_USERNAME and ICLOUD_CALDAV_APP_PASSWORD in
 * your shell (not committed anywhere) or a local, gitignored .env file
 * loaded by your shell of choice.
 */
import { createDAVClient } from "tsdav";

async function main() {
  const username = process.env.ICLOUD_CALDAV_USERNAME;
  const appPassword = process.env.ICLOUD_CALDAV_APP_PASSWORD;

  if (!username || !appPassword) {
    console.error(
      "Set ICLOUD_CALDAV_USERNAME and ICLOUD_CALDAV_APP_PASSWORD in your shell before running this script."
    );
    process.exitCode = 1;
    return;
  }

  const client = await createDAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: { username, password: appPassword },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });

  const calendars = await client.fetchCalendars();

  console.log(`Found ${calendars.length} calendar(s) for this account:\n`);
  for (const calendar of calendars) {
    console.log(`- ${String(calendar.displayName ?? "(untitled)")}`);
    console.log(`  url: ${calendar.url}`);
    console.log("");
  }
  console.log(
    "Copy the url of the calendar you want to use, then set it in Supabase:\n" +
      "  update public.calendar_sync_config set active_calendar_identity = '<url>' where id = true;"
  );
}

main().catch((error) => {
  // Deliberately prints only the error's message, never headers/credentials.
  console.error("Discovery failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
