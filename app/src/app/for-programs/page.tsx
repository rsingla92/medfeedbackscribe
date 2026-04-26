import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/app/_landing/content";
import { SiteNav } from "@/app/_landing/site-nav";

export const metadata: Metadata = {
  title: "For Programs — Debrief",
  description:
    "Debrief helps residency programs increase assessment completion rates, capture verbal feedback formally, and build richer competency data sets. Canadian data residency included.",
};

const problemPoints = [
  "Assessment completion rates stay low because filling out a form after a busy shift is the last thing a preceptor wants to do.",
  "Verbal feedback, which is often the richest feedback a trainee receives, never makes it into the formal record.",
  "Competency data arrives late, in batches, and rarely reflects what was actually observed in the room.",
];

function CheckCircleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
    >
      <path
        fillRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
    >
      <path
        fillRule="evenodd"
        d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
    >
      <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75ZM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875V8.625ZM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 3 19.875v-6.75Z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
    >
      <path
        fillRule="evenodd"
        d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const programBenefits = [
  {
    icon: <CheckCircleIcon />,
    title: "Higher completion",
    body: "Preceptors give feedback verbally, as they already do. Residents review, edit, and submit. The barrier to completion drops because no one is staring at a blank form.",
  },
  {
    icon: <BoltIcon />,
    title: "Faster turnaround",
    body: "A structured assessment can be ready minutes after a shift ends, not weeks later. Timely feedback is better feedback for both the trainee and the program.",
  },
  {
    icon: <ChartIcon />,
    title: "Richer competency data",
    body: "Verbal comments map automatically to CanMEDS roles, CCFP milestones, and Royal College Competence by Design (CBD) competencies. Aggregate data for Competence Committee reviews.",
  },
  {
    icon: <ShieldIcon />,
    title: "Canadian data residency",
    body: "All data is stored and processed on Canadian infrastructure. No cross-border transfer, no US-based cloud storage. A practical answer to institutional procurement questions.",
  },
];

const rolloutSteps = [
  {
    number: "01",
    title: "Pilot one block, 5 to 10 residents",
    body: "Pick a single rotation block (about one month). No IT integration required. Residents sign up, record, and export within the first week.",
  },
  {
    number: "02",
    title: "Drop into your existing forms",
    body: "Debrief exports to CSV or PDF. Drop the output into your current assessment system, whether that is One45, MedSIS, or your own forms. No new software to maintain.",
  },
  {
    number: "03",
    title: "Review the block, decide on scale",
    body: "At the end of the block we share completion rates, time-to-feedback, and resident and preceptor feedback. If the numbers move, expand to the full program.",
  },
];

const pilotMetrics = [
  {
    label: "# of assessments",
    body: "How many finalized assessments the cohort produced during the block, compared to the equivalent block last year.",
  },
  {
    label: "Time from encounter to documented feedback",
    body: "Median hours between the conversation and a structured assessment landing in your system.",
  },
  {
    label: "Words of narrative feedback per assessment",
    body: "A simple proxy for how rich the documented feedback is, compared to baseline.",
  },
  {
    label: "Preceptor and resident satisfaction",
    body: "Short end-of-block survey covering perceived burden, usefulness, and willingness to keep using it.",
  },
];

export default function ForProgramsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main id="main-content">
        {/* Hero */}
        <section
          aria-labelledby="hero-heading"
          className="mx-auto max-w-[960px] px-6 pb-16 pt-14 sm:pb-20 sm:pt-20"
        >
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted">
            For Programs
          </p>
          <h1
            id="hero-heading"
            className="font-[family-name:var(--font-display)] text-[2.5rem] leading-[1.1] text-foreground sm:text-[3.25rem] lg:text-[3.75rem]"
          >
            Built for residency programs,
            <br className="hidden sm:block" />
            <span className="text-accent"> not against them.</span>
          </h1>
          <p className="mt-6 max-w-[640px] text-lg leading-relaxed text-muted">
            Verbal feedback already happens. Preceptors and trainees talk after
            almost every encounter. Debrief preserves those conversations and
            turns them into the formal assessment record your program needs,
            reducing the documentation burden for preceptors without adding a
            new step to their day.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="mailto:pilot@debriefmd.ca?subject=Program%20inquiry"
              className="inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-accent px-8 text-base font-semibold text-white transition-colors hover:bg-accent-hover sm:w-auto"
            >
              Request a pilot
            </a>
            <Link
              href="/contact"
              className="inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface px-8 text-base font-medium text-foreground transition-colors hover:bg-border-light sm:w-auto"
            >
              Talk to us first
            </Link>
          </div>
        </section>

        {/* Problem */}
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
              Program directors know these three things well.
            </h2>
            <ul className="mt-8 flex flex-col gap-4" aria-label="Common program problems">
              {problemPoints.map((point, i) => (
                <li key={i} className="flex gap-4">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-background font-[family-name:var(--font-mono)] text-xs text-muted"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <p className="text-base leading-relaxed text-muted">{point}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* What Debrief gives a program */}
        <section
          aria-labelledby="benefits-heading"
          className="border-t border-border"
        >
          <div className="mx-auto max-w-[960px] px-6 py-16 sm:py-20">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              What you get
            </p>
            <h2
              id="benefits-heading"
              className="font-[family-name:var(--font-display)] text-[1.75rem] leading-[1.2] text-foreground sm:text-[2rem]"
            >
              What Debrief gives a program.
            </h2>
            <ul
              className="mt-10 grid gap-4 sm:grid-cols-2"
              aria-label="Program benefits"
            >
              {programBenefits.map((benefit) => (
                <li
                  key={benefit.title}
                  className="rounded-[var(--radius-lg)] border border-border bg-surface p-6"
                >
                  <div className="text-accent" aria-hidden="true">
                    {benefit.icon}
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-foreground">
                    {benefit.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {benefit.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Rollout */}
        <section
          aria-labelledby="rollout-heading"
          className="border-t border-border bg-surface"
        >
          <div className="mx-auto max-w-[960px] px-6 py-16 sm:py-20">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              Getting started
            </p>
            <h2
              id="rollout-heading"
              className="font-[family-name:var(--font-display)] text-[1.75rem] leading-[1.2] text-foreground sm:text-[2rem]"
            >
              A one-block pilot.
            </h2>
            <p className="mt-4 max-w-[640px] text-base leading-relaxed text-muted">
              The pilot is scoped to a single rotation block (about one month).
              That gives a clean before-and-after window without committing the
              full program.
            </p>
            <ol
              className="mt-10 grid gap-6 sm:grid-cols-3"
              aria-label="Rollout steps"
            >
              {rolloutSteps.map((step) => (
                <li
                  key={step.number}
                  className="rounded-[var(--radius-lg)] border border-border bg-background p-6"
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

            <div className="mt-12">
              <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
                What we measure during the block
              </p>
              <h3 className="font-[family-name:var(--font-display)] text-[1.25rem] leading-[1.25] text-foreground sm:text-[1.5rem]">
                A handful of metrics, against your own baseline.
              </h3>
              <ul
                className="mt-6 grid gap-4 sm:grid-cols-2"
                aria-label="Pilot metrics"
              >
                {pilotMetrics.map((metric) => (
                  <li
                    key={metric.label}
                    className="rounded-[var(--radius-lg)] border border-border bg-background p-5"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {metric.label}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">
                      {metric.body}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-muted">
                We share the readout with the program at the end of the block.
                You decide whether to scale.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section aria-labelledby="cta-heading" className="border-t border-border">
          <div className="mx-auto max-w-[960px] px-6 py-20 text-center sm:py-28">
            <h2
              id="cta-heading"
              className="font-[family-name:var(--font-display)] text-[2rem] leading-[1.2] text-foreground sm:text-[2.5rem]"
            >
              Start a pilot this rotation.
            </h2>
            <p className="mx-auto mt-4 max-w-[480px] text-base leading-relaxed text-muted">
              We work directly with program administrators to get a cohort set
              up. No procurement overhead for a pilot. Email us and we will
              respond within two business days.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href="mailto:pilot@debriefmd.ca?subject=Program%20inquiry"
                className="inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-accent px-10 text-base font-semibold text-white transition-colors hover:bg-accent-hover sm:w-auto"
              >
                pilot@debriefmd.ca
              </a>
              <Link
                href="/security"
                className="inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface px-8 text-base font-medium text-foreground transition-colors hover:bg-border-light sm:w-auto"
              >
                Security and compliance
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
