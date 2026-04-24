"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export default function OnboardingPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [program, setProgram] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [yearOfTraining, setYearOfTraining] = useState("");
  const [site, setSite] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;

    setSaving(true);
    setError(null);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName.trim(),
        program: program || null,
        specialty: specialty || null,
        year_of_training: yearOfTraining ? parseInt(yearOfTraining) : null,
        site: site.trim() || null,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Failed to save profile");
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
          <div className="rounded-[var(--radius-md)] border border-border bg-error-bg p-3 text-sm text-error">
            {error}
          </div>
        )}

        <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
          <div>
            <label htmlFor="fullName" className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">
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
            <label htmlFor="program" className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">
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
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="specialty" className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">
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
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="year" className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">
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
            <label htmlFor="site" className="block text-xs font-medium text-muted uppercase tracking-wider mb-1">
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
          disabled={saving || !fullName.trim()}
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
