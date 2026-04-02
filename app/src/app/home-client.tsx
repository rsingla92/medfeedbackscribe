"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionStatus = "created" | "uploading" | "processing" | "ready" | "exported" | "processing_failed";

interface FeedbackSession {
  id: string;
  preceptor: { name: string } | null;
  rotation: { name: string } | null;
  created_at: string;
  date: string;
  status: SessionStatus;
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SessionStatus }) {
  const config: Record<SessionStatus, { label: string; className: string }> = {
    created: { label: "Created", className: "bg-[var(--border-light)] text-subtle" },
    uploading: { label: "Uploading", className: "bg-warning-bg text-warning" },
    processing: { label: "Processing", className: "bg-warning-bg text-warning" },
    ready: { label: "Ready", className: "bg-success-bg text-success" },
    exported: { label: "Exported", className: "bg-[var(--border-light)] text-subtle" },
    processing_failed: { label: "Failed", className: "bg-error-bg text-error" },
  };

  const { label, className } = config[status] ?? config.processing;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {(status === "processing" || status === "uploading") && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {label}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
      <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
    </svg>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-[slideUp_250ms_ease-out]">
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-foreground px-4 py-3 text-sm text-background shadow-lg">
        <svg className="h-4 w-4 shrink-0 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
        <span>{message}</span>
        <button type="button" onClick={onDismiss} className="ml-2 text-background/60 hover:text-background">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────

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
              <span aria-hidden="true" className="text-subtle">·</span>
            </>
          )}
          <span>{formatDate(session.created_at)}</span>
        </div>
      </div>
      <StatusBadge status={session.status} />
      <svg className="h-4 w-4 shrink-0 text-subtle" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}

// ── Account Bar ───────────────────────────────────────────────────────────────

function AccountBar({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5 text-xs text-muted hover:text-foreground hover:bg-border-light transition-colors"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-light text-accent text-[10px] font-bold">
          {email[0].toUpperCase()}
        </div>
        <span className="max-w-[160px] truncate">{email}</span>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-[var(--radius-md)] border border-border bg-surface shadow-lg py-1">
            <div className="px-3 py-2 border-b border-border-light">
              <p className="text-xs text-muted truncate">{email}</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowMenu(false); onSignOut(); }}
              className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error-bg transition-colors"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Home Client ──────────────────────────────────────────────────────────

export function HomeClient({
  initialSessions,
  userEmail,
}: {
  initialSessions: FeedbackSession[];
  userEmail: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [sessions, setSessions] = useState<FeedbackSession[]>(initialSessions);
  const [toast, setToast] = useState<string | null>(null);

  // Show toast from URL params
  useEffect(() => {
    const toastParam = searchParams.get("toast");
    if (toastParam === "recording_submitted") {
      setToast("Recording submitted! Processing will take about a minute.");
      // Clean the URL
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams]);

  // Poll for session status changes (every 5s if any are processing)
  useEffect(() => {
    const hasProcessing = sessions.some(
      (s) => s.status === "processing" || s.status === "uploading" || s.status === "created"
    );
    if (!hasProcessing) return;

    const interval = setInterval(async () => {
      const processingIds = sessions
        .filter((s) => s.status === "processing" || s.status === "uploading" || s.status === "created")
        .map((s) => s.id);

      const { data } = await supabase
        .from("sessions")
        .select("id, status")
        .in("id", processingIds);

      if (data) {
        setSessions((prev) =>
          prev.map((s) => {
            const updated = data.find((d) => d.id === s.id);
            if (updated && updated.status !== s.status) {
              if (updated.status === "ready") {
                setToast("Assessment ready for review!");
              } else if (updated.status === "processing_failed") {
                setToast("Processing failed. Tap the session to retry.");
              }
              return { ...s, status: updated.status as SessionStatus };
            }
            return s;
          })
        );
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [sessions, supabase]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }, [supabase, router]);

  return (
    <main className="flex flex-1 flex-col">
      {/* Header with account */}
      <header className="px-6 pt-8 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-[family-name:var(--font-display)] text-foreground">
              Debrief
            </h1>
            <p className="mt-1 text-sm text-muted">Talk first. Forms second.</p>
          </div>
          <AccountBar email={userEmail} onSignOut={handleSignOut} />
        </div>
      </header>

      {/* Record button */}
      <div className="flex justify-center py-8">
        <Link
          href="/record"
          aria-label="Record a new session"
          className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover hover:shadow-xl hover:shadow-accent/30 active:scale-95"
        >
          <MicrophoneIcon className="h-10 w-10 transition-transform group-hover:scale-110" />
          <span className="absolute inset-0 rounded-full bg-accent/20 animate-ping" style={{ animationDuration: "2s" }} aria-hidden="true" />
        </Link>
      </div>

      {/* Quick links */}
      <div className="px-6 pb-2">
        <Link
          href="/preceptors"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          Manage preceptors
        </Link>
      </div>

      {/* Sessions */}
      <section className="flex-1 px-6 pb-8">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-light)]">
              <MicrophoneIcon className="h-7 w-7 text-accent" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium text-foreground">No feedback yet</p>
              <p className="text-sm text-muted">Record your first session to get started.</p>
            </div>
            <Link
              href="/record"
              className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              <MicrophoneIcon className="h-4 w-4" />
              Record session
            </Link>
          </div>
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

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </main>
  );
}
