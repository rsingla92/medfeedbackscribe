"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthState = "idle" | "sending" | "sent" | "expired" | "error";

export default function AuthPage() {
  const [state, setState] = useState<AuthState>("idle");
  const [sentEmail, setSentEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const supabase = createClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get("error") === "access_denied" ||
      params.get("error_description")?.includes("expired")
    ) {
      setState("expired");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Always read directly from the DOM — never rely on React state for mobile
    const input = (e.target as HTMLFormElement).querySelector("input[type=email]") as HTMLInputElement;
    const email = input?.value?.trim() || "";
    if (!email || !email.includes("@")) return;

    setState("sending");
    setSentEmail(email);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      if (
        error.message.toLowerCase().includes("expired") ||
        error.message.toLowerCase().includes("token")
      ) {
        setState("expired");
      } else {
        setState("error");
        setErrorMessage(error.message);
      }
    } else {
      setState("sent");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Branding */}
        <div className="space-y-2">
          <h1 className="text-4xl font-[family-name:var(--font-display)] text-foreground">MedScribe</h1>
          <p className="text-muted text-base">Capture feedback. Skip the forms.</p>
        </div>

        {/* Sent */}
        {state === "sent" && (
          <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-bg">
              <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Check your inbox!</h2>
              <p className="text-sm text-muted">
                We sent a magic link to <span className="font-medium text-foreground">{sentEmail}</span>. Click the link to sign in.
              </p>
            </div>
            <button type="button" onClick={() => setState("idle")} className="text-sm font-medium text-accent">
              Didn&apos;t receive it? Try again
            </button>
          </div>
        )}

        {/* Expired */}
        {state === "expired" && (
          <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-bg">
              <svg className="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Link expired</h2>
              <p className="text-sm text-muted">Magic links are valid for a limited time. Request a new one below.</p>
            </div>
            <button type="button" onClick={() => setState("idle")} className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-white">
              Resend magic link
            </button>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error-bg">
              <svg className="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
              <p className="text-sm text-muted">{errorMessage}</p>
            </div>
            <button type="button" onClick={() => setState("idle")} className="text-sm font-medium text-accent">
              Try again
            </button>
          </div>
        )}

        {/* Login form */}
        {(state === "idle" || state === "sending") && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                placeholder="you@hospital.edu"
                disabled={state === "sending"}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className="w-full rounded-lg bg-accent px-4 py-3 text-base font-semibold text-white disabled:bg-border disabled:text-muted"
              >
                {state === "sending" ? "Sending..." : "Send magic link"}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="text-xs text-subtle">
          By signing in you agree to our terms of service.
          <br />
          Data encrypted at rest (AES-256) and stored in Canada (ca-central-1).
        </p>
      </div>
    </main>
  );
}
