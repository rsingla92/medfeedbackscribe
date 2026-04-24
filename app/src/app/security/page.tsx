import type { Metadata } from "next";
import Link from "next/link";
import { DebriefWordmark, SiteFooter } from "@/app/_landing/content";

export const metadata: Metadata = {
  title: "Security and Compliance — Debrief",
  description:
    "How Debrief protects patient information: Canadian data residency, AES-256 encryption, PHI scrubbing before storage, and PHIPA/PIPEDA alignment.",
};

const subprocessors = [
  {
    category: "Application hosting",
    vendor: "AWS App Runner (ca-central-1, Montreal)",
    location: "Canada",
    note: null,
  },
  {
    category: "Database",
    vendor: "AWS RDS for PostgreSQL (ca-central-1, Montreal)",
    location: "Canada",
    note: "Encrypted at rest with AWS KMS customer-managed keys. Private subnet, no public access.",
  },
  {
    category: "Audio and export storage",
    vendor: "AWS S3 (ca-central-1, Montreal)",
    location: "Canada",
    note: "Server-side encryption (SSE-KMS). Access via short-lived presigned URLs only.",
  },
  {
    category: "Pipeline queue and compute",
    vendor: "AWS SQS + AWS Lambda (ca-central-1, Montreal)",
    location: "Canada",
    note: null,
  },
  {
    category: "Transcription and language processing",
    vendor: "Google Cloud Vertex AI — Gemini 2.5 Flash",
    location: "northamerica-northeast1, Montreal, Canada",
    note: "Under Google Cloud BAA. No customer data is used to train Google models.",
  },
  {
    category: "Transactional email",
    vendor: "AWS SES (ca-central-1, Montreal)",
    location: "Canada",
    note: "Email notifications contain only a link back to Debrief. Transcripts and narrative summaries are never included in email body.",
  },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
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
            This page describes how Debrief handles patient-adjacent data: where
            it is stored, how it is protected, what gets scrubbed before
            storage, and who can access what. Written for institutional
            procurement, IT, and privacy officers.
          </p>
          <p className="mt-3 text-sm text-muted">
            Last updated: April 24, 2026.{" "}
            <span className="font-medium text-warning">
              Draft, pending formal legal review.
            </span>
          </p>
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
              compute, and email delivery all run in AWS&apos;s Montreal region
              (ca-central-1). Transcription and language processing run on
              Google Cloud&apos;s northamerica-northeast1 (Montreal) region
              under a signed BAA.
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
                  AES-256 + KMS
                </p>
                <p className="mt-2 text-sm text-muted">
                  All data at rest (database, object storage, message queue, and
                  secret store) is encrypted with AWS KMS customer-managed
                  keys, rotated annually.
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
              only reachable from the application and pipeline worker. The S3
              bucket blocks all public access and is only readable through
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
              Audio recordings sometimes contain patient-identifying information
              even when the intent is to capture feedback about clinical skills.
              We treat this as expected, and the transcript is scrubbed before
              it is stored or displayed. The system covers all 18 HIPAA
              identifier categories plus Canadian-specific identifiers (SIN,
              provincial health card numbers, postal codes). Redactions are
              inline markers (for example, <code>[REDACTED-NAME]</code>) so
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
            <div className="mt-5 rounded-[var(--radius-md)] bg-warning-bg border border-warning border-opacity-40 px-4 py-3">
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">
                  Aspirational statement:
                </span>{" "}
                This compliance posture reflects our design intent and
                engineering decisions. It has not been independently audited
                or certified. We recommend institutions conduct their own
                privacy impact assessment before deploying in a regulated
                context.
              </p>
            </div>
          </section>

          <section aria-labelledby="subprocessors-heading">
            <h2
              id="subprocessors-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              Subprocessors
            </h2>
            <p className="text-base leading-relaxed text-muted mb-6">
              These are the third-party services Debrief relies on. Every one
              operates in a Canadian region.
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
                      className={
                        i < subprocessors.length - 1
                          ? "border-b border-border-light"
                          : ""
                      }
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
                A DPA is available on request for institutional procurement.
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
                If you discover a security issue, please report it responsibly.
                We will respond within two business days.
              </p>
              <a
                href="mailto:security@whitecoatprep.com"
                className="inline-block text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-hover transition-colors"
              >
                security@whitecoatprep.com
              </a>
            </section>
          </div>

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
