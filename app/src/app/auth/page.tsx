"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthState = "idle" | "sending" | "sent" | "expired" | "error";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<AuthState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const supabase = createClient();

  // Check for expired link via URL params on mount
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

    const trimmed = email.trim();
    if (!trimmed) return;

    setState("sending");
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
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

  function handleResend() {
    setState("idle");
    setEmail("");
  }

  const isValidEmail = email.trim().length > 0 && email.includes("@");
  const canSubmit = isValidEmail && state !== "sending";

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Branding */}
        <div className="space-y-2">
          <h1 className="text-4xl font-[family-name:var(--font-display)] text-foreground">
            MedScribe
          </h1>
          <p className="text-muted text-base">
            Capture feedback. Skip the forms.
          </p>
        </div>

        {/* Sent state */}
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
                We sent a magic link to{" "}
                <span className="font-medium text-foreground">{email}</span>.
                Click the link to sign in.
              </p>
            </div>
            <button type="button" onClick={handleResend} className="text-sm font-medium text-accent hover:text-accent-hover transition-colors min-h-11">
              Didn&apos;t receive it? Try again
            </button>
          </div>
        )}

        {/* Expired state */}
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
            <button type="button" onClick={handleResend} className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-hover">
              Resend magic link
            </button>
          </div>
        )}

        {/* Error state */}
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
            <button type="button" onClick={handleResend} className="text-sm font-medium text-accent hover:text-accent-hover transition-colors min-h-11">
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
                type="email"
                required
                autoComplete="email"
                autoFocus
                placeholder="you@hospital.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={state === "sending"}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-subtle transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-lg bg-accent px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {state === "sending" ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  "Send magic link"
                )}
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
