import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/app/_landing/content";
import { SiteNav } from "@/app/_landing/site-nav";

export const metadata: Metadata = {
  title: "Privacy Policy — Debrief by Whitecoat Prep",
  description: "How Debrief collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main
        id="main-content"
        className="mx-auto max-w-[720px] px-6 py-12 sm:py-16"
      >
        <div className="mb-10">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
            Legal
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-[1.2] text-foreground sm:text-[2.5rem]">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-muted">
            Last updated: April 25, 2026.
          </p>
        </div>

        <div className="prose-stone space-y-10 text-base leading-relaxed text-foreground">

          <section aria-labelledby="who-we-are">
            <h2
              id="who-we-are"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              1. Who we are
            </h2>
            <p className="text-muted">
              Debrief is a product of Whitecoat Prep. We build tools for
              medical trainees and their supervisors.
            </p>
          </section>

          <section aria-labelledby="what-data">
            <h2
              id="what-data"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              2. What data we collect
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-muted">
              <li>
                <strong className="text-foreground">Audio recordings.</strong>{" "}
                Voice recordings captured during feedback sessions. These are
                processed and then deleted after transcription is complete.
              </li>
              <li>
                <strong className="text-foreground">Transcripts.</strong>{" "}
                Text versions of verbal feedback, with patient identifiers
                removed before storage.
              </li>
              <li>
                <strong className="text-foreground">
                  Structured assessments.
                </strong>{" "}
                Competency data extracted from transcripts and mapped to
                assessment form fields.
              </li>
              <li>
                <strong className="text-foreground">Account information.</strong>{" "}
                Your email address and name, used to create and manage your
                account.
              </li>
            </ul>
            <p className="mt-4 text-muted">
              We do not collect patient records, health card numbers, or any
              other data beyond what is listed above.
            </p>
          </section>

          <section aria-labelledby="how-we-use">
            <h2
              id="how-we-use"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              3. How we use it
            </h2>
            <p className="text-muted">
              Data is used solely to generate the assessment for the trainee
              who recorded the session. We do not sell your data, use it for
              advertising, or share it with third parties except as described
              in this policy.
            </p>
          </section>

          <section aria-labelledby="where-stored">
            <h2
              id="where-stored"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              4. Where data is stored
            </h2>
            <p className="text-muted">
              All data is stored in Canada on Canadian infrastructure. Data is
              encrypted at rest (AES-256) and in transit (TLS 1.2+). It never
              leaves Canada.
            </p>
          </section>

          <section aria-labelledby="third-parties">
            <h2
              id="third-parties"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              5. Third-party processors
            </h2>
            <p className="text-muted">
              We use the following categories of sub-processors, all operating
              within Canadian regions:
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-2 text-muted">
              <li>
                <strong className="text-foreground">
                  Speech recognition provider.
                </strong>{" "}
                Audio recordings are sent to a speech recognition service for
                transcription.
              </li>
              <li>
                <strong className="text-foreground">
                  Language model provider.
                </strong>{" "}
                Transcripts are processed by a language model to remove patient
                identifiers and extract competency data.
              </li>
              <li>
                <strong className="text-foreground">Email provider.</strong>{" "}
                We use a transactional email service to deliver assessment
                notifications.
              </li>
            </ul>
          </section>

          <section aria-labelledby="your-rights">
            <h2
              id="your-rights"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              6. Your rights
            </h2>
            <p className="text-muted">You have the right to:</p>
            <ul className="list-disc pl-5 mt-3 space-y-2 text-muted">
              <li>
                <strong className="text-foreground">Access</strong> the data we
                hold about you.
              </li>
              <li>
                <strong className="text-foreground">Correct</strong> inaccurate
                data.
              </li>
              <li>
                <strong className="text-foreground">Delete</strong> your
                account and all associated data.
              </li>
              <li>
                <strong className="text-foreground">
                  Withdraw consent
                </strong>{" "}
                at any time, which will stop future processing.
              </li>
            </ul>
            <p className="mt-4 text-muted">
              To exercise any of these rights, get in touch via our{" "}
              <Link
                href="/contact"
                className="text-accent underline underline-offset-2 hover:text-accent-hover"
              >
                contact page
              </Link>
              . We will respond within 30 days.
            </p>
          </section>

          <section aria-labelledby="compliance">
            <h2
              id="compliance"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              7. Compliance
            </h2>
            <p className="text-muted">
              We are committed to compliance with PHIPA (Personal Health
              Information Protection Act, Ontario) and PIPEDA (Personal
              Information Protection and Electronic Documents Act).
            </p>
          </section>

          <section aria-labelledby="changes">
            <h2
              id="changes"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              8. Changes to this policy
            </h2>
            <p className="text-muted">
              We will notify users of material changes to this policy by email.
              The date at the top of this page will always reflect the most
              recent update.
            </p>
          </section>

          <section
            aria-labelledby="contact"
            className="rounded-[var(--radius-lg)] border border-border bg-surface p-6"
          >
            <h2
              id="contact"
              className="font-[family-name:var(--font-display)] text-lg text-foreground mb-2"
            >
              Questions?
            </h2>
            <p className="text-muted text-sm">
              Reach out via our{" "}
              <Link
                href="/contact"
                className="text-accent underline underline-offset-2 hover:text-accent-hover"
              >
                contact page
              </Link>
              .
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
