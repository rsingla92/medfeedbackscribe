import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Debrief by Whitecoat Prep",
  description: "How Debrief collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav
        className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-5"
        aria-label="Site navigation"
      >
        <Link
          href="/landing"
          className="font-[family-name:var(--font-display)] text-xl text-accent"
          aria-label="Debrief by Whitecoat Prep — home"
        >
          Debrief
        </Link>
      </nav>

      <main
        id="main-content"
        className="mx-auto max-w-[720px] px-6 py-12 sm:py-16"
      >
        {/* Header */}
        <div className="mb-10">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
            Legal
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-[1.2] text-foreground sm:text-[2.5rem]">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-muted">
            Last updated: April 14, 2026.{" "}
            <span className="font-medium text-warning">
              Draft, pending legal review.
            </span>
          </p>
        </div>

        <div className="prose-stone space-y-10 text-base leading-relaxed text-foreground">

          {/* 1. Who we are */}
          <section aria-labelledby="who-we-are">
            <h2
              id="who-we-are"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              1. Who we are
            </h2>
            <p className="text-muted">
              Debrief is a product of Whitecoat Prep (contact:{" "}
              <a
                href="mailto:privacy@whitecoatprep.com"
                className="text-accent underline underline-offset-2 hover:text-accent-hover"
              >
                privacy@whitecoatprep.com
              </a>
              ). We build tools for medical trainees and their supervisors.
            </p>
          </section>

          {/* 2. What data we collect */}
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

          {/* 3. How we use it */}
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

          {/* 4. Where data is stored */}
          <section aria-labelledby="where-stored">
            <h2
              id="where-stored"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              4. Where data is stored
            </h2>
            <p className="text-muted">
              All data is stored in Canada (ca-central-1 region) on
              infrastructure provided by Supabase. Data is encrypted at rest
              (AES-256) and in transit (TLS 1.2+). It never leaves Canada.
            </p>
          </section>

          {/* 5. Third-party processors */}
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
            <p className="mt-4 text-muted">
              We do not name vendors on this page as our provider agreements
              are subject to change. Contact us if you need specific details.
            </p>
          </section>

          {/* 6. Your rights */}
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
              To exercise any of these rights, email{" "}
              <a
                href="mailto:privacy@whitecoatprep.com"
                className="text-accent underline underline-offset-2 hover:text-accent-hover"
              >
                privacy@whitecoatprep.com
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          {/* 7. Compliance */}
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
              Information Protection and Electronic Documents Act). This policy
              is a draft and is pending formal legal review. It does not
              constitute legal advice or a binding compliance certification.
            </p>
          </section>

          {/* 8. Changes */}
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

          {/* Contact */}
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
              Email us at{" "}
              <a
                href="mailto:privacy@whitecoatprep.com"
                className="text-accent underline underline-offset-2 hover:text-accent-hover"
              >
                privacy@whitecoatprep.com
              </a>{" "}
              or write to Whitecoat Prep, British Columbia, Canada.
            </p>
          </section>
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
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
