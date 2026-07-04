export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db/client";

/** Pilot-phase admin emails. Override via PILOT_ADMIN_EMAILS (comma-separated). */
const PILOT_ADMINS = (process.env.PILOT_ADMIN_EMAILS ?? "admin@med-student-feedback-scribe.dev")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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
  const session = await auth();
  if (!session?.user || !PILOT_ADMINS.includes(session.user.email ?? "")) {
    redirect("/");
  }

  const [totals] = await sql<{ total: number; completed: number }[]>`
    select
      count(*)::int as total,
      count(*) filter (where status in ('ready', 'exported'))::int as completed
    from recording_sessions
  `;

  const [{ preceptor_count }] = await sql<{ preceptor_count: number }[]>`
    select count(distinct preceptor_id)::int as preceptor_count
    from recording_sessions
  `;

  const turnaroundRows = await sql<{ avg_minutes: number | null }[]>`
    select avg(
      extract(epoch from (earliest_export - rs.created_at)) / 60
    )::int as avg_minutes
    from recording_sessions rs
    left join lateral (
      select min(exported_at) as earliest_export
      from assessments a
      where a.session_id = rs.id and a.exported_at is not null
    ) ae on true
    where rs.status != 'created' and ae.earliest_export is not null
  `;

  const total = totals.total;
  const completed = totals.completed;
  const completionRate =
    total > 0 ? `${Math.round((completed / total) * 100)}%` : "--";

  const avgMinutes = turnaroundRows[0]?.avg_minutes ?? null;
  let avgTurnaroundLabel = "--";
  if (avgMinutes != null) {
    if (avgMinutes < 60) {
      avgTurnaroundLabel = `${avgMinutes}m`;
    } else {
      const hours = Math.floor(avgMinutes / 60);
      const mins = avgMinutes % 60;
      avgTurnaroundLabel = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
  }

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
            value={String(preceptor_count)}
          />
          <StatCard label="Avg turnaround" value={avgTurnaroundLabel} />
        </div>
      </div>
    </main>
  );
}
