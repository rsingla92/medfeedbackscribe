"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { ErrorAlert } from "@/app/_components/error-alert";
import { authError, type ErrorCopy } from "@/lib/errors";

type AuthState = "idle" | "sending" | "sent" | "error";

export default function AuthPage() {
  const [state, setState] = useState<AuthState>("idle");
  const [sentEmail, setSentEmail] = useState("");
  const [errorCopy, setErrorCopy] = useState<ErrorCopy | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      setState("error");
      setErrorCopy(authError(err));
    }
  }, []);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).querySelector(
      "input[type=email]",
    ) as HTMLInputElement;
    const email = input?.value?.trim() || "";
    if (!email || !email.includes("@")) return;

    setState("sending");
    setSentEmail(email);
    setErrorCopy(null);

    const callbackUrl =
      new URLSearchParams(window.location.search).get("callbackUrl") ??
      "/dashboard";
    const res = await signIn("email", { email, callbackUrl, redirect: false });

    if (res?.error) {
      setState("error");
      setErrorCopy({
        ...authError(res.error),
        action: { label: "Try again", onClick: () => setState("idle") },
      });
    } else {
      setState("sent");
    }
  }

  async function handleGoogle() {
    const callbackUrl =
      new URLSearchParams(window.location.search).get("callbackUrl") ??
      "/dashboard";
    await signIn("google", { callbackUrl });
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-[family-name:var(--font-display)] text-foreground">
            Debrief
          </h1>
          <p className="text-muted text-base">Talk first. Forms second.</p>
        </div>

        {state === "sent" && (
          <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-bg">
              <svg
                className="h-6 w-6 text-success"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">
                Check your inbox
              </h2>
              <p className="text-sm text-muted">
                We sent a sign-in link to{" "}
                <span className="font-medium text-foreground">{sentEmail}</span>
                . Click the link to sign in.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setState("idle")}
              className="text-sm font-medium text-accent"
            >
              Didn&apos;t receive it? Try again
            </button>
          </div>
        )}

        {state === "error" && errorCopy && (
          <ErrorAlert
            copy={{
              ...errorCopy,
              action: errorCopy.action ?? {
                label: "Try again",
                onClick: () => setState("idle"),
              },
            }}
          />
        )}

        {(state === "idle" || state === "sending") && (
          <div className="space-y-4">
            <form
              onSubmit={handleEmailSubmit}
              className="space-y-4 rounded-xl border border-border bg-surface p-6"
            >
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
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
                {state === "sending" ? "Sending..." : "Send sign-in link"}
              </button>
            </form>

            <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-subtle">
              <div className="h-px flex-1 bg-border" />
              <span>or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={state === "sending"}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-base font-medium text-foreground hover:bg-background disabled:opacity-50"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
                />
              </svg>
              Continue with Google
            </button>

            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Coming soon — pending institutional sign-off"
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface/60 px-4 py-3 text-base font-medium text-subtle"
            >
              <span
                aria-hidden="true"
                className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#002145] font-[family-name:var(--font-mono)] text-[9px] font-bold text-white"
              >
                UBC
              </span>
              UBC CWL
              <span className="ml-1 rounded-full border border-border bg-background px-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                Soon
              </span>
            </button>
          </div>
        )}

        <p className="text-xs text-subtle">
          By signing in you agree to our terms of service.
          <br />
          Data encrypted at rest and stored in Canada (ca-central-1).
        </p>
      </div>
    </main>
  );
}

