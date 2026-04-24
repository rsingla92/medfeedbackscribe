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

    router.push("/");
    router.refresh();
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
