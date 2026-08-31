import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import { ScheduleCard } from "./schedule-card";

export default async function AdminRecurringPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: schedules, error } = await supabase
    .from("recurring_schedules")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Couldn&apos;t load recurring schedules: {error.message}
      </p>
    );
  }

  const rows = schedules ?? [];
  const active = rows.filter((s) => s.status === "active");
  const paused = rows.filter((s) => s.status === "paused");
  const cancelled = rows.filter((s) => s.status === "cancelled");

  const SECTIONS = [
    { key: "active", label: "Active 进行中", rows: active, empty: "No active recurring schedules. 暂无进行中的定期服务。" },
    { key: "paused", label: "Paused 已暂停", rows: paused, empty: "No paused recurring schedules. 暂无已暂停的定期服务。" },
    {
      key: "cancelled",
      label: "Cancelled 已取消",
      rows: cancelled,
      empty: "No cancelled recurring schedules. 暂无已取消的定期服务。",
    },
  ] as const;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Recurring Pickups 定期取件</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {active.length} active · {paused.length} paused · {cancelled.length} cancelled
      </p>

      <div className="mt-8 space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.key}>
            <h2 className="font-display text-lg font-semibold">
              {section.label}{" "}
              <span className="font-sans text-sm font-normal text-muted-foreground">
                ({section.rows.length})
              </span>
            </h2>
            {section.rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{section.empty}</p>
            ) : (
              <div className="mt-3 space-y-3">
                {section.rows.map((schedule) => (
                  <ScheduleCard key={schedule.id} schedule={schedule} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
