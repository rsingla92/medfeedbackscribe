export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type SessionStatus = "processing" | "ready" | "exported";

interface FeedbackSession {
  id: string;
  preceptor: { name: string } | null;
  rotation: { name: string } | null;
  created_at: string;
  date: string;
  status: SessionStatus;
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const config: Record<
    SessionStatus,
    { label: string; className: string }
  > = {
    processing: {
      label: "Processing",
      className: "bg-warning-bg text-warning",
    },
    ready: {
      label: "Ready",
      className: "bg-success-bg text-success",
    },
    exported: {
      label: "Exported",
      className: "bg-[var(--border-light)] text-subtle",
    },
  };

  const { label, className } = config[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
      <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
    </svg>
  );
}

function SessionCard({ session }: { session: FeedbackSession }) {
  return (
    <Link
      href={`/review/${session.id}`}
      className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition-colors hover:border-accent/30 active:bg-background"
    >
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-semibold text-foreground truncate">
          {session.preceptor?.name ?? "Unknown preceptor"}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted">
          {session.rotation?.name && (
            <>
              <span className="truncate">{session.rotation.name}</span>
              <span aria-hidden="true" className="text-subtle">
                ·
              </span>
            </>
          )}
          <span>{formatDate(session.created_at)}</span>
        </div>
      </div>
      <StatusBadge status={session.status} />
      <svg
        className="h-4 w-4 shrink-0 text-subtle"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m8.25 4.5 7.5 7.5-7.5 7.5"
        />
      </svg>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-light)]">
        <MicrophoneIcon className="h-7 w-7 text-accent" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">
          No feedback yet
        </p>
        <p className="text-sm text-muted">
          Record your first session to get started.
        </p>
      </div>
      <Link
        href="/record"
        className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        <MicrophoneIcon className="h-4 w-4" />
        Record session
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let sessions: FeedbackSession[] = [];

  if (user) {
    const { data } = await supabase
      .from("sessions")
      .select("id, status, created_at, date, preceptor:preceptors(name), rotation:rotations(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    sessions = ((data ?? []) as unknown as FeedbackSession[]).map((s) => ({
      ...s,
      preceptor: Array.isArray(s.preceptor) ? s.preceptor[0] : s.preceptor,
      rotation: Array.isArray(s.rotation) ? s.rotation[0] : s.rotation,
    }));
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* Header */}
      <header className="px-6 pt-12 pb-2">
        <h1 className="text-3xl font-[family-name:var(--font-display)] text-foreground">
          MedScribe
        </h1>
        <p className="mt-1 text-sm text-muted">
          Capture feedback. Skip the forms.
        </p>
      </header>

      {/* Record button */}
      <div className="flex justify-center py-8">
        <Link
          href="/record"
          aria-label="Record a new session"
          className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover hover:shadow-xl hover:shadow-accent/30 active:scale-95"
        >
          <MicrophoneIcon className="h-10 w-10 transition-transform group-hover:scale-110" />
          {/* Pulse ring */}
          <span
            className="absolute inset-0 rounded-full bg-accent/20 animate-ping"
            style={{ animationDuration: "2s" }}
            aria-hidden="true"
          />
        </Link>
      </div>

      {/* Sessions */}
      <section className="flex-1 px-6 pb-8">
        {!user ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted">
              Sign in to start recording feedback.
            </p>
            <Link
              href="/auth"
              className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Sign in
            </Link>
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Recent Sessions
            </h2>
            <div className="space-y-2">
              {sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
