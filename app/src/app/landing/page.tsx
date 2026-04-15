import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Debrief by Whitecoat Prep — Talk first. Forms second.",
  description:
    "AI-powered voice-to-assessment for medical trainee feedback. Preceptors speak; residents get structured assessment forms in minutes.",
};

// ─── Icon helpers (inline SVG, no extra deps) ────────────────────────────────

function MicIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6"
    >
      <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
      <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-8 w-8 text-accent"
    >
      <path
        fillRule="evenodd"
        d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6"
    >
      <path
        fillRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6"
    >
      <path
        fillRule="evenodd"
        d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6"
    >
      <path d="M21.721 12.752a9.711 9.711 0 0 0-.945-5.003 12.754 12.754 0 0 1-4.339 2.708 18.991 18.991 0 0 1-.214 4.772 17.165 17.165 0 0 0 5.498-2.477ZM14.634 15.55a17.324 17.324 0 0 0 .332-4.647c-.952.227-1.945.347-2.966.347-1.021 0-2.014-.12-2.966-.347a17.515 17.515 0 0 0 .332 4.647 17.385 17.385 0 0 0 5.268 0ZM9.772 17.119a18.963 18.963 0 0 0 4.456 0A17.182 17.182 0 0 1 12 21.724a17.18 17.18 0 0 1-2.228-4.605ZM7.777 15.23a18.87 18.87 0 0 1-.214-4.774 12.753 12.753 0 0 1-4.34-2.708 9.711 9.711 0 0 0-.944 5.004 17.165 17.165 0 0 0 5.498 2.477ZM21.356 14.752a9.765 9.765 0 0 1-7.478 6.817 18.64 18.64 0 0 0 1.988-4.718 18.627 18.627 0 0 0 5.49-2.098ZM2.644 14.752c1.682.971 3.53 1.688 5.49 2.099a18.64 18.64 0 0 0 1.988 4.718 9.765 9.765 0 0 1-7.478-6.816ZM13.878 2.43a9.755 9.755 0 0 1 6.116 3.986 11.267 11.267 0 0 1-3.746 2.504 18.63 18.63 0 0 0-2.37-6.49ZM12 2.276a17.152 17.152 0 0 1 2.805 7.121c-.897.23-1.837.353-2.805.353-.968 0-1.908-.122-2.805-.353A17.151 17.151 0 0 1 12 2.276ZM10.122 2.43a18.629 18.629 0 0 0-2.37 6.49 11.266 11.266 0 0 1-3.746-2.504 9.754 9.754 0 0 1 6.116-3.985Z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6"
    >
      <path
        fillRule="evenodd"
        d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75-6.75a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z"
        clipRule="evenodd"
      />
      <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"
      />
    </svg>
  );
}

// ─── Feature card data ────────────────────────────────────────────────────────

const features = [
  {
    icon: <DocumentIcon />,
    title: "Multi-form support",
    body: "Auto-populates T-Res EPA forms and One45 assessments from a single recording.",
  },
  {
    icon: <ShieldIcon />,
    title: "PHI dual-pass scrubbing",
    body: "Regex fast-pass followed by an LLM contextual pass removes patient identifiers before any data is stored.",
  },
  {
    icon: <CheckCircleIcon />,
    title: "CanMEDS mapping",
    body: "Verbal feedback is automatically mapped to CanMEDS roles and competency milestones.",
  },
  {
    icon: <GlobeIcon />,
    title: "English & French",
    body: "Transcription powered by Deepgram in both official languages — no accent penalty.",
  },
  {
    icon: <ShieldIcon />,
    title: "Canadian data residency",
    body: "All data is encrypted AES-256 and stored exclusively in ca-central-1. Never leaves Canada.",
  },
  {
    icon: <DocumentIcon />,
    title: "One45 CSV export",
    body: "One-click export in One45-compatible CSV. Drop straight into your program's workflow.",
  },
];

// ─── Steps ────────────────────────────────────────────────────────────────────

const steps = [
  {
    number: "01",
    title: "Record",
    body: "Resident opens Debrief immediately after an encounter. Preceptor speaks naturally — 1 to 2 minutes of verbal feedback.",
  },
  {
    number: "02",
    title: "Transcribe & de-identify",
    body: "Deepgram transcribes. Claude scrubs PHI in two passes. The LLM extracts competency data and maps it to your form fields.",
  },
  {
    number: "03",
    title: "Review & export",
    body: "Resident reviews the pre-filled assessment, corrects anything the AI missed, and exports to One45 or PDF with one tap.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav
        className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-5"
        aria-label="Site navigation"
      >
        <span
          className="font-[family-name:var(--font-display)] text-xl text-foreground"
          aria-label="Debrief by Whitecoat Prep"
        >
          Debrief
        </span>
        <Link
          href="/demo"
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-none"
        >
          Try it free
        </Link>
      </nav>

      <main id="main-content">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="mx-auto max-w-[960px] px-6 pb-20 pt-16 text-center sm:pt-24"
        >
          {/* Pill label */}
          <p className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted">
            <span
              className="h-1.5 w-1.5 rounded-full bg-accent"
              aria-hidden="true"
            />
            Piloting with UBC Family Medicine
          </p>

          <h1
            id="hero-heading"
            className="font-[family-name:var(--font-display)] text-[2.75rem] leading-[1.1] text-foreground sm:text-[3.5rem] lg:text-[4rem]"
          >
            Talk first.
            <br />
            <span className="text-accent">Forms second.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-[560px] text-lg leading-relaxed text-muted">
            Preceptors give rich verbal feedback. Debrief captures it, scrubs
            PHI, and fills your assessment forms — in minutes, not weeks.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/demo"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-accent px-8 text-base font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-none sm:w-auto"
            >
              <MicIcon />
              Try it — no sign-up
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-8 text-base font-medium text-foreground transition-colors hover:bg-border-light focus-visible:outline-none sm:w-auto"
            >
              See how it works
              <ArrowDownIcon />
            </a>
          </div>
        </section>

        {/* ── Problem ──────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="problem-heading"
          className="border-t border-border bg-surface"
        >
          <div className="mx-auto max-w-[960px] px-6 py-16 sm:py-20">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              The problem
            </p>
            <h2
              id="problem-heading"
              className="font-[family-name:var(--font-display)] text-[1.75rem] leading-[1.2] text-foreground sm:text-[2rem]"
            >
              Preceptors already give the feedback.
              <br className="hidden sm:block" /> The forms just never get filled.
            </h2>
            <p className="mt-5 max-w-[680px] text-base leading-relaxed text-muted">
              Preceptors deliver rich, nuanced verbal feedback at the bedside
              every day — then the encounter ends, the EMR calls, and the form
              never gets touched. Residents wait weeks for assessments that are
              eventually written from memory. The result: competency data that
              is sparse, retrospective, and often invented. Training programs
              make promotion decisions on fiction.
            </p>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section
          id="how-it-works"
          aria-labelledby="how-heading"
          className="border-t border-border"
        >
          <div className="mx-auto max-w-[960px] px-6 py-16 sm:py-20">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              How it works
            </p>
            <h2
              id="how-heading"
              className="font-[family-name:var(--font-display)] text-[1.75rem] leading-[1.2] text-foreground sm:text-[2rem]"
            >
              Three steps. Two minutes.
            </h2>

            <ol
              className="mt-10 grid gap-6 sm:grid-cols-3"
              aria-label="Steps to use Debrief"
            >
              {steps.map((step) => (
                <li
                  key={step.number}
                  className="rounded-[var(--radius-lg)] border border-border bg-surface p-6"
                >
                  <span
                    className="font-[family-name:var(--font-mono)] text-2xl font-normal text-accent"
                    aria-hidden="true"
                  >
                    {step.number}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="features-heading"
          className="border-t border-border bg-surface"
        >
          <div className="mx-auto max-w-[960px] px-6 py-16 sm:py-20">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              Features
            </p>
            <h2
              id="features-heading"
              className="font-[family-name:var(--font-display)] text-[1.75rem] leading-[1.2] text-foreground sm:text-[2rem]"
            >
              Built for Canadian residency.
            </h2>

            <ul
              className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="Feature list"
            >
              {features.map((feature) => (
                <li
                  key={feature.title}
                  className="rounded-[var(--radius-lg)] border border-border p-5"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-accent-light text-accent"
                    aria-hidden="true"
                  >
                    {feature.icon}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {feature.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Social proof ─────────────────────────────────────────────────── */}
        <section
          aria-labelledby="quote-heading"
          className="border-t border-border"
        >
          <div className="mx-auto max-w-[960px] px-6 py-16 sm:py-20">
            <figure className="mx-auto max-w-[640px] text-center">
              <div className="flex justify-center">
                <SparkleIcon />
              </div>
              <blockquote className="mt-6">
                <p className="font-[family-name:var(--font-display)] text-2xl leading-[1.3] text-foreground sm:text-3xl">
                  &ldquo;Piloting with UBC Family Medicine.&rdquo;
                </p>
              </blockquote>
              <figcaption
                id="quote-heading"
                className="mt-4 text-sm text-muted"
              >
                Early access program — residency programs invited
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="cta-heading"
          className="border-t border-border bg-surface"
        >
          <div className="mx-auto max-w-[960px] px-6 py-20 text-center sm:py-28">
            <h2
              id="cta-heading"
              className="font-[family-name:var(--font-display)] text-[2rem] leading-[1.2] text-foreground sm:text-[2.5rem]"
            >
              Ready to stop losing feedback?
            </h2>
            <p className="mx-auto mt-4 max-w-[480px] text-base leading-relaxed text-muted">
              No sign-up. No credit card. Just open the demo and hit record.
            </p>
            <Link
              href="/demo"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-10 text-base font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-none"
            >
              <MicIcon />
              Try it — no sign-up
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-[960px] px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
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
              <p className="mt-1 text-sm text-muted">
                Built by a resident who lived the problem.
              </p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs text-subtle">
                MIT licensed. Data encrypted AES-256, stored in Canada.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
