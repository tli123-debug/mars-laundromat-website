import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { Button } from "@/components/ui/button";
import { signOut } from "./actions";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const NAV_LINKS = [
  { href: "/admin/today", label: "Today 今日" },
  { href: "/admin/bookings", label: "All Bookings 所有预约" },
];

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Mars Laundromat
            </p>
            <p className="font-display text-lg font-semibold">Admin</p>
          </div>
          <nav className="flex items-center gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-foreground/80 hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign Out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-6 py-10">{children}</main>
    </div>
  );
}
