export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HomeClient } from "./home-client";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  type SessionStatus = "created" | "uploading" | "processing" | "ready" | "exported" | "processing_failed";
  let sessions: {
    id: string;
    preceptor: { name: string } | null;
    rotation: { name: string } | null;
    created_at: string;
    date: string;
    status: SessionStatus;
  }[] = [];

  if (user) {
    const { data } = await supabase
      .from("sessions")
      .select("id, status, created_at, date, preceptor:preceptors(name), rotation:rotations(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    sessions = ((data ?? []) as unknown as typeof sessions).map((s) => ({
      ...s,
      preceptor: Array.isArray(s.preceptor) ? s.preceptor[0] : s.preceptor,
      rotation: Array.isArray(s.rotation) ? s.rotation[0] : s.rotation,
    }));
  }

  if (!user) {
    return (
      <main className="flex flex-1 flex-col">
        <header className="px-6 pt-12 pb-2">
          <h1 className="text-3xl font-[family-name:var(--font-display)] text-foreground">
            Debrief
          </h1>
          <p className="mt-1 text-sm text-muted">Talk first. Forms second.</p>
        </header>

        <div className="flex justify-center py-8">
          <Link
            href="/record"
            aria-label="Record a new session"
            className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover hover:shadow-xl hover:shadow-accent/30 active:scale-95"
          >
            <svg className="h-10 w-10 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
              <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
            </svg>
            <span className="absolute inset-0 rounded-full bg-accent/20 animate-ping" style={{ animationDuration: "2s" }} aria-hidden="true" />
          </Link>
        </div>

        <section className="flex-1 px-6 pb-8">
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted">Sign in to start recording feedback.</p>
            <Link
              href="/auth"
              className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Sign in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <HomeClient
      initialSessions={sessions}
      userEmail={user.email ?? ""}
    />
  );
}
