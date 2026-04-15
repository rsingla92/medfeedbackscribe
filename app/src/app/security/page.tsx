import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security and Compliance — Debrief by Whitecoat Prep",
  description:
    "How Debrief protects patient information: Canadian data residency, AES-256 encryption, belt-and-suspenders PHI scrubbing, and PHIPA/PIPEDA alignment.",
};

function DebriefWordmark() {
  return (
    <Link
      href="/landing"
      className="flex items-center gap-2"
      aria-label="Debrief by Whitecoat Prep — home"
    >
      <span aria-hidden="true" className="flex items-end gap-[2px] h-5">
        <span className="w-[3px] h-2 rounded-full bg-accent opacity-60" />
        <span className="w-[3px] h-4 rounded-full bg-accent" />
        <span className="w-[3px] h-3 rounded-full bg-accent opacity-80" />
        <span className="w-[3px] h-5 rounded-full bg-accent" />
        <span className="w-[3px] h-2.5 rounded-full bg-accent opacity-70" />
        <span className="w-[3px] h-3.5 rounded-full bg-accent opacity-90" />
        <span className="w-[3px] h-1.5 rounded-full bg-accent opacity-50" />
      </span>
      <span className="font-[family-name:var(--font-display)] text-xl text-accent leading-none">
        Debrief
      </span>
    </Link>
  );
}

const subprocessors = [
  {
    category: "Database and file storage",
    vendor: "Supabase",
    location: "Toronto and Montreal, Canada",
    note: null,
  },
  {
    category: "Transcription and language processing",
    vendor: "Google Cloud (Canadian region)",
    location: "Montreal, Canada",
    note: null,
  },
  {
    category: "Email delivery",
    vendor: "Resend",
    location: "United States",
    note: "Email notifications contain only de-identified assessment summaries. Full transcripts are never included in email. This is the only component that operates outside Canada.",
  },
  {
    category: "Web hosting",
    vendor: "Vercel",
    location: "Montreal, Canada",
    note: null,
  },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav
        className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-5"
        aria-label="Site navigation"
      >
        <DebriefWordmark />
        <a
          href="mailto:dpa@whitecoatprep.com"
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-5 text-sm font-medium text-foreground transition-colors hover:bg-border-light focus-visible:outline-none"
        >
          Request DPA
        </a>
      </nav>

      <main
        id="main-content"
        className="mx-auto max-w-[720px] px-6 py-12 sm:py-16"
      >
        {/* Header */}
        <div className="mb-12">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
            Security and compliance
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-[1.15] text-foreground sm:text-[2.75rem]">
            Patient information stays in Canada.
            <br />
            <span className="text-accent">End to end.</span>
          </h1>
          <p className="mt-5 max-w-[600px] text-lg leading-relaxed text-muted">
            This page describes how Debrief handles patient-adjacent data:
            where it is stored, how it is protected, what gets scrubbed before
            storage, and who can access what. It is written for institutional
            procurement, IT, and privacy officers.
          </p>
          <p className="mt-3 text-sm text-muted">
            Last updated: April 14, 2026.{" "}
            <span className="font-medium text-warning">
              Draft, pending formal legal review.
            </span>
          </p>
        </div>

        <div className="space-y-12">

          {/* Data residency */}
          <section aria-labelledby="residency-heading">
            <h2
              id="residency-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              Data residency
            </h2>
            <p className="text-base leading-relaxed text-muted">
              All storage and processing happens on Canadian infrastructure.
              Our cloud database and file storage operate in the
              Toronto/Montreal region. Transcription and language processing
              run in our Canadian processing region (Montreal). No data is
              sent to US-based servers for any of these core functions.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted">
              The single exception is email delivery (see Subprocessors
              below). Email notifications contain only de-identified assessment
              summaries, never full transcripts or raw audio.
            </p>
            <div className="mt-5 rounded-[var(--radius-md)] bg-success-light border border-success border-opacity-30 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                Core data never leaves Canada.
              </p>
              <p className="mt-1 text-sm text-muted">
                Audio recordings, transcripts, and structured assessment data
                are stored and processed exclusively on Canadian
                infrastructure.
              </p>
            </div>
          </section>

          {/* Encryption */}
          <section aria-labelledby="encryption-heading">
            <h2
              id="encryption-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              Encryption
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
                <p className="text-xs font-medium uppercase tracking-widest text-muted mb-2">
                  At rest
                </p>
                <p className="font-[family-name:var(--font-mono)] text-base font-semibold text-foreground">
                  AES-256
                </p>
                <p className="mt-2 text-sm text-muted">
                  All data stored in our cloud database and file storage is
                  encrypted at rest using AES-256.
                </p>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
                <p className="text-xs font-medium uppercase tracking-widest text-muted mb-2">
                  In transit
                </p>
                <p className="font-[family-name:var(--font-mono)] text-base font-semibold text-foreground">
                  TLS 1.2+
                </p>
                <p className="mt-2 text-sm text-muted">
                  All data in transit is encrypted using TLS 1.2 or higher.
                  No unencrypted HTTP connections.
                </p>
              </div>
            </div>
          </section>

          {/* PHI handling */}
          <section aria-labelledby="phi-heading">
            <h2
              id="phi-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              PHI handling: belt-and-suspenders
            </h2>
            <p className="text-base leading-relaxed text-muted">
              Audio recordings sometimes contain patient-identifying
              information, even though the intent is to capture feedback about
              clinical skills. For example, a preceptor might say "remember
              the patient in room 412 last Tuesday." We treat this as
              expected, not exceptional, and scrub it in three passes before
              anything is stored.
            </p>
            <ol className="mt-6 flex flex-col gap-4" aria-label="PHI scrubbing passes">
              <li className="flex gap-4">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light font-[family-name:var(--font-mono)] text-xs font-semibold text-accent"
                  aria-hidden="true"
                >
                  1
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Automated pattern matching
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    A fast, deterministic scan removes phone numbers, health
                    card numbers, dates, postal codes, MRNs, and other
                    structured identifiers before any language processing
                    occurs.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light font-[family-name:var(--font-mono)] text-xs font-semibold text-accent"
                  aria-hidden="true"
                >
                  2
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Contextual scrubbing
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    A second pass handles identifiers that require context:
                    names without a title prefix, implicit room references,
                    and other identifiers that pattern matching alone cannot
                    catch reliably.
                  </p>
                </div>
              </li>
              <li className="flex gap-4">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light font-[family-name:var(--font-mono)] text-xs font-semibold text-accent"
                  aria-hidden="true"
                >
                  3
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Final pattern check before storage
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    A second automated pass runs on the output from contextual
                    scrubbing. Any additional matches are flagged and logged.
                    The cleaned transcript is then stored.
                  </p>
                </div>
              </li>
            </ol>
            <p className="mt-5 text-sm text-muted">
              The system covers all 18 HIPAA identifier categories plus
              Canadian-specific identifiers including Social Insurance Numbers
              (SIN), provincial health card numbers (BC PHN, OHIP, RAMQ,
              Alberta PHN), and Canadian postal codes. Redactions appear as
              inline markers in the stored transcript (for example,
              [REDACTED-NAME]) so auditors can see what was detected.
            </p>
            <p className="mt-4 text-sm text-muted">
              The trainee reviews all output before it is exported or
              submitted. Resident review is the final gate.
            </p>
          </section>

          {/* Compliance posture */}
          <section aria-labelledby="compliance-heading">
            <h2
              id="compliance-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              Compliance posture
            </h2>
            <p className="text-base leading-relaxed text-muted">
              Debrief is designed with Canadian healthcare privacy requirements
              in mind. We are building toward alignment with:
            </p>
            <ul className="mt-4 flex flex-col gap-3 list-none">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    PHIPA (Personal Health Information Protection Act, Ontario)
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    Governs how personal health information is collected, used,
                    and disclosed in Ontario.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    PIPEDA (Personal Information Protection and Electronic Documents Act)
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    Federal private-sector privacy law applying to commercial
                    activities across Canada.
                  </p>
                </div>
              </li>
            </ul>
            <div className="mt-5 rounded-[var(--radius-md)] bg-warning-bg border border-warning border-opacity-40 px-4 py-3">
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">Aspirational statement:</span>{" "}
                This compliance posture reflects our design intent and
                engineering decisions. It has not been independently audited or
                certified. We recommend that institutions conduct their own
                privacy impact assessment before deploying in a regulated
                context.
              </p>
            </div>
          </section>

          {/* Subprocessors */}
          <section aria-labelledby="subprocessors-heading">
            <h2
              id="subprocessors-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              Subprocessors
            </h2>
            <p className="text-base leading-relaxed text-muted mb-6">
              These are the third-party services Debrief relies on. We are
              transparent about who they are and where they operate.
            </p>
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted">
                      Function
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted">
                      Vendor
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-muted sm:table-cell">
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subprocessors.map((sp, i) => (
                    <tr
                      key={sp.vendor}
                      className={i < subprocessors.length - 1 ? "border-b border-border-light" : ""}
                    >
                      <td className="px-4 py-3 font-medium text-foreground align-top">
                        {sp.category}
                        {sp.note && (
                          <p className="mt-1 text-xs font-normal text-muted leading-relaxed">
                            {sp.note}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-foreground align-top">
                        {sp.vendor}
                      </td>
                      <td className="hidden px-4 py-3 text-muted align-top sm:table-cell">
                        {sp.location}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* DPA + Disclosure */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <section
              aria-labelledby="dpa-heading"
              className="rounded-[var(--radius-lg)] border border-border bg-surface p-6"
            >
              <h2
                id="dpa-heading"
                className="font-[family-name:var(--font-display)] text-lg text-foreground mb-2"
              >
                Data Processing Agreement
              </h2>
              <p className="text-sm text-muted mb-4">
                A Data Processing Agreement is available on request for
                institutional procurement.
              </p>
              <a
                href="mailto:dpa@whitecoatprep.com"
                className="inline-block text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-hover transition-colors"
              >
                dpa@whitecoatprep.com
              </a>
            </section>

            <section
              aria-labelledby="vuln-heading"
              className="rounded-[var(--radius-lg)] border border-border bg-surface p-6"
            >
              <h2
                id="vuln-heading"
                className="font-[family-name:var(--font-display)] text-lg text-foreground mb-2"
              >
                Vulnerability disclosure
              </h2>
              <p className="text-sm text-muted mb-4">
                If you discover a security issue, please report it
                responsibly. We will respond within two business days and
                keep you informed as we investigate.
              </p>
              <a
                href="mailto:security@whitecoatprep.com"
                className="inline-block text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-hover transition-colors"
              >
                security@whitecoatprep.com
              </a>
            </section>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="mx-auto max-w-[960px] px-6 py-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted">
            <p>
              Debrief by{" "}
              <a
                href="https://www.whitecoatprep.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2 hover:text-accent-hover"
              >
                Whitecoat Prep
              </a>
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/landing" className="hover:text-foreground transition-colors">
                Home
              </Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="/accessibility" className="hover:text-foreground transition-colors">
                Accessibility
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
