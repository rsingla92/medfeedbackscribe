export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** Hardcoded admin emails for the pilot phase. */
const PILOT_ADMINS = [
  "admin@debrief.whitecoatprep.com",
  // Add pilot admin emails here
];

interface StatCardProps {
  label: string;
  value: string;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <p className="font-[family-name:var(--font-display)] text-3xl text-foreground">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-muted font-[family-name:var(--font-body)]">
        {label}
      </p>
    </div>
  );
}

export default async function MetricsPage() {
  const supabase = await createClient();

  // Auth gate
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !PILOT_ADMINS.includes(user.email ?? "")) {
    redirect("/");
  }

  // --- Fetch aggregate stats ---

  // Total sessions
  const { count: totalSessions } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true });

  // Sessions by status
  const { count: completedSessions } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .in("status", ["ready", "exported"]);

  // Unique preceptors (distinct preceptor_id)
  const { data: preceptorRows } = await supabase
    .from("sessions")
    .select("preceptor_id");

  const uniquePreceptors = new Set(
    (preceptorRows ?? []).map((r) => r.preceptor_id)
  ).size;

  // Average turnaround: time from created_at to the first assessment export
  const { data: turnaroundRows } = await supabase
    .from("sessions")
    .select("created_at, assessments(exported_at)")
    .not("status", "eq", "created");

  let avgTurnaroundLabel = "--";

  if (turnaroundRows && turnaroundRows.length > 0) {
    const durations: number[] = [];

    for (const session of turnaroundRows) {
      const assessments = session.assessments as
        | { exported_at: string | null }[]
        | null;
      if (!assessments) continue;

      const exportedTimes = assessments
        .map((a) => a.exported_at)
        .filter((t): t is string => t != null)
        .map((t) => new Date(t).getTime());

      if (exportedTimes.length > 0) {
        const earliest = Math.min(...exportedTimes);
        const created = new Date(session.created_at).getTime();
        durations.push(earliest - created);
      }
    }

    if (durations.length > 0) {
      const avgMs =
        durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const avgMinutes = Math.round(avgMs / 60_000);

      if (avgMinutes < 60) {
        avgTurnaroundLabel = `${avgMinutes}m`;
      } else {
        const hours = Math.floor(avgMinutes / 60);
        const mins = avgMinutes % 60;
        avgTurnaroundLabel = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      }
    }
  }

  // Completion rate
  const total = totalSessions ?? 0;
  const completed = completedSessions ?? 0;
  const completionRate =
    total > 0 ? `${Math.round((completed / total) * 100)}%` : "--";

  // Empty state
  if (total === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 bg-background">
        <p className="font-[family-name:var(--font-display)] text-2xl text-foreground">
          No pilot data yet.
        </p>
        <p className="mt-2 text-muted font-[family-name:var(--font-body)]">
          Waiting for first session.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-background px-6 py-12 sm:px-12">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-foreground mb-8">
          Pilot Metrics
        </h1>

        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Total sessions" value={String(total)} />
          <StatCard label="Completion rate" value={completionRate} />
          <StatCard
            label="Unique preceptors"
            value={String(uniquePreceptors)}
          />
          <StatCard label="Avg turnaround" value={avgTurnaroundLabel} />
        </div>
      </div>
    </main>
  );
}
