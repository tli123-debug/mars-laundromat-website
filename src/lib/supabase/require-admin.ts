import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Re-checks auth independently of proxy.ts. Required because Next.js's Proxy
 * matcher does not protect Server Function calls on excluded paths — every
 * admin page and Server Action must call this itself, not rely on proxy.ts alone.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/admin/login");
  }

  return user;
}
