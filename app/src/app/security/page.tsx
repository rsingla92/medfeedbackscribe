import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/app/_landing/content";
import { SiteNav } from "@/app/_landing/site-nav";

export const metadata: Metadata = {
  title: "Security and Compliance — Debrief",
  description:
    "How Debrief protects patient information: Canadian data residency, AES-256 encryption, PHI scrubbing before storage, and PHIPA/PIPEDA alignment.",
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main
        id="main-content"
        className="mx-auto max-w-[720px] px-6 py-12 sm:py-16"
      >
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
            storage, and who can access what. Written for institutional
            procurement, IT, and privacy officers.
          </p>
          <p className="mt-3 text-sm text-muted">Last updated: April 25, 2026.</p>
        </div>

        <div className="space-y-12">
          <section aria-labelledby="residency-heading">
            <h2
              id="residency-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              Data residency
            </h2>
            <p className="text-base leading-relaxed text-muted">
              All storage and compute happens on Canadian infrastructure. The
              application, database, object storage, message queue, pipeline
              compute, transcription, language processing, and email delivery
              all run in Canadian regions under signed data processing
              agreements.
            </p>
            <div className="mt-5 rounded-[var(--radius-md)] bg-success-light border border-success border-opacity-30 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                No data crosses the border.
              </p>
              <p className="mt-1 text-sm text-muted">
                Audio recordings, transcripts, structured assessment data, and
                the email that delivers notifications are all stored and
                processed exclusively on Canadian infrastructure.
              </p>
            </div>
          </section>

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
                  All data at rest (database, object storage, message queue,
                  and secret store) is encrypted with customer-managed keys,
                  rotated annually.
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
                  All data in transit uses TLS 1.2 or higher. HTTPS is forced
                  at the load balancer and database connections require SSL.
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="network-heading">
            <h2
              id="network-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              Network isolation
            </h2>
            <p className="text-base leading-relaxed text-muted">
              The database sits in a private subnet with no public IP. It is
              only reachable from the application and pipeline worker. Object
              storage blocks all public access and is only readable through
              short-lived presigned URLs issued by the application after an
              authenticated, ownership-scoped check.
            </p>
          </section>

          <section aria-labelledby="phi-heading">
            <h2
              id="phi-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              PHI handling
            </h2>
            <p className="text-base leading-relaxed text-muted">
              Audio recordings sometimes contain patient-identifying
              information even when the intent is to capture feedback about
              clinical skills. We treat this as expected, and the transcript is
              scrubbed before it is stored or displayed. The system covers all
              18 HIPAA identifier categories plus Canadian-specific identifiers
              (SIN, provincial health card numbers, postal codes). Redactions
              are inline markers (for example, <code>[REDACTED-NAME]</code>) so
              auditors can see what was detected.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted">
              The resident reviews every output before it is exported or
              submitted. Resident review is the final gate.
            </p>
          </section>

          <section aria-labelledby="access-heading">
            <h2
              id="access-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              Access control
            </h2>
            <p className="text-base leading-relaxed text-muted">
              Residents can only see their own sessions, recordings, and
              assessments. This is enforced at the application layer: every
              database query filters by the authenticated user, and API routes
              verify ownership before returning data or issuing presigned URLs.
              Program administrators see aggregate, de-identified metrics
              only.
            </p>
          </section>

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
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    PHIPA (Ontario) and provincial health-privacy equivalents
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    Governs how personal health information is collected, used,
                    and disclosed in Ontario. British Columbia, Alberta, and
                    Quebec have comparable frameworks (FIPPA/PIPA/HIA/Law 25).
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    PIPEDA (federal)
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    Federal private-sector privacy law applying to commercial
                    activities across Canada.
                  </p>
                </div>
              </li>
            </ul>
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
              If you discover a security issue, please report it responsibly.
              We will respond within two business days.
            </p>
            <a
              href="mailto:security@med-student-feedback-scribe.dev"
              className="inline-block text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-hover transition-colors"
            >
              security@med-student-feedback-scribe.dev
            </a>
          </section>

          <div className="flex justify-center pt-4">
            <Link
              href="/"
              className="text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
            >
              &larr; Back to home
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
