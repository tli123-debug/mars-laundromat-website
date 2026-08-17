import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Public, unauthenticated on purpose — a Vercel Cron hits this weekly just to
// generate real API traffic against Supabase, so the free-tier project doesn't
// auto-pause after 7 days of inactivity.
export async function GET() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const { error } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
