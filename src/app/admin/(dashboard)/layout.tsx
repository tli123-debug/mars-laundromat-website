import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { Button } from "@/components/ui/button";
import { signOut } from "./actions";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Mars Laundromat
            </p>
            <p className="font-display text-lg font-semibold">Admin</p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign Out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
