"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorAlert } from "@/app/_components/error-alert";
import { saveError, type ErrorCopy } from "@/lib/errors";

const PROGRAMS = [
  "UBC Family Medicine",
  "UBC Emergency Medicine",
  "UBC Internal Medicine",
  "UBC General Surgery",
  "UBC Pediatrics",
  "UBC Psychiatry",
  "UBC Obstetrics & Gynecology",
  "Other",
];

const SPECIALTIES = [
  "Family Medicine",
  "Emergency Medicine",
  "Internal Medicine",
  "General Surgery",
  "Pediatrics",
  "Psychiatry",
  "Obstetrics & Gynecology",
  "Other",
];

function isValidEmail(value: string): boolean {
  // Minimal RFC-style check — enough to catch typos, not a validator.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

interface OnboardingResponse {
  ok?: boolean;
  pending?: boolean;
  email_send_failed?: boolean;
  error?: string;
}

interface PendingState {
  email: string;
  sendFailed: boolean;
}

export function OnboardingForm({ authEmail }: { authEmail: string }) {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(authEmail);
  const [program, setProgram] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [yearOfTraining, setYearOfTraining] = useState("");
  const [site, setSite] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ErrorCopy | null>(null);
  // When the resident provides an email different from their auth email, the
  // server stages a pending-email confirmation instead of writing it
  // straight through. We stay on this page and show a success/pending card
  // rather than redirecting, so the resident sees exactly what to do next.
  const [pending, setPending] = useState<PendingState | null>(null);

  const emailLooksValid = isValidEmail(email);
  const canSubmit = fullName.trim() !== "" && emailLooksValid && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName.trim(),
        email: email.trim(),
        program: program || null,
        specialty: specialty || null,
        year_of_training: yearOfTraining ? parseInt(yearOfTraining) : null,
        site: site.trim() || null,
      }),
    });

    if (!res.ok) {
      setError(saveError("your profile"));
      setSaving(false);
      return;
    }

    // Parse so we can branch on { pending: true }. If the server returns an
    // unexpected shape, treat it as the direct-accept path (the profile was
    // still saved; the resident just doesn't get a pending card).
    let data: OnboardingResponse = {};
    try {
      data = (await res.json()) as OnboardingResponse;
    } catch {
      // swallow — fall through to router.push below
    }

    if (data.pending) {
      setPending({
        email: email.trim(),
        sendFailed: Boolean(data.email_send_failed),
      });
      setSaving(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (pending) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-light">
              <svg
                className="h-6 w-6 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-[family-name:var(--font-display)] text-foreground">
              Check your email
            </h1>
            <p className="text-sm text-muted">
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">
                {pending.email}
              </span>
              . Click it to confirm this is where you want Debrief to send
              coaching-note notifications. The link expires in 24 hours.
            </p>
            <p className="text-sm text-muted">
              You can use Debrief in the meantime — notifications will start
              arriving at this address once you confirm.
            </p>
            {pending.sendFailed && (
              <p className="text-xs text-error">
                We saved your profile but couldn&rsquo;t send the email.
                Try again from profile settings, or contact
                hello@debriefmd.ca if it keeps failing.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
            className="w-full rounded-[var(--radius-md)] bg-accent px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Back to app
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-[family-name:var(--font-display)] text-foreground">
            Welcome to Debrief
          </h1>
          <p className="text-sm text-muted">
            Tell us about yourself so we can personalize your experience.
          </p>
        </div>

        {error && (
          <ErrorAlert copy={error} onDismiss={() => setError(null)} />
        )}

        <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
          <div>
            <label
              htmlFor="fullName"
              className="block text-xs font-medium text-muted uppercase tracking-wider mb-1"
            >
              Full Name *
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dr. Jane Smith"
              className="w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-muted uppercase tracking-wider mb-1"
            >
              Institutional Email *
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jsmith@ubc.ca"
              autoComplete="email"
              className="w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
            />
            <p className="mt-1.5 text-xs text-muted">
              Where we send assessment notifications. Use your program email so
              preceptors and admins can reach you. Pre-filled from your sign-in
              — edit if different.
            </p>
            {email !== "" && !emailLooksValid && (
              <p className="mt-1 text-xs text-error">
                That doesn&rsquo;t look like a valid email address.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="program"
              className="block text-xs font-medium text-muted uppercase tracking-wider mb-1"
            >
              Program
            </label>
            <select
              id="program"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-base text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
            >
              <option value="">Select program...</option>
              {PROGRAMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="specialty"
              className="block text-xs font-medium text-muted uppercase tracking-wider mb-1"
            >
              Specialty
            </label>
            <select
              id="specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-base text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
            >
              <option value="">Select specialty...</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="year"
              className="block text-xs font-medium text-muted uppercase tracking-wider mb-1"
            >
              Year of Training
            </label>
            <select
              id="year"
              value={yearOfTraining}
              onChange={(e) => setYearOfTraining(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-base text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
            >
              <option value="">Select year...</option>
              <option value="1">PGY-1</option>
              <option value="2">PGY-2</option>
              <option value="3">PGY-3</option>
              <option value="4">PGY-4</option>
              <option value="5">PGY-5</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="site"
              className="block text-xs font-medium text-muted uppercase tracking-wider mb-1"
            >
              Training Site
            </label>
            <input
              id="site"
              type="text"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="UBC FM Vancouver"
              className="w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-[var(--radius-md)] bg-accent px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Get Started"}
        </button>

        <p className="text-xs text-subtle text-center">
          You can update this later in your profile settings.
        </p>
      </form>
    </main>
  );
}
