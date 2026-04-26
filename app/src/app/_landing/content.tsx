import Link from "next/link";
import Image from "next/image";
import { SiteNav } from "./site-nav";

// Wordmark

export function DebriefWordmark({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2"
      aria-label="Debrief — home"
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

// Icons

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

function HeartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6"
    >
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
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

// Feature cards (PHI scrub detail removed — kept high-level)

const features = [
  {
    icon: <DocumentIcon />,
    title: "Competency-based forms",
    body: "Auto-populates EPA forms and competency-based assessments from a single voice recording.",
  },
  {
    icon: <HeartIcon />,
    title: "Built by a resident",
    body: "Designed from inside a training program, with preceptors and residents, for the way feedback actually happens on the wards.",
  },
  {
    icon: <CheckCircleIcon />,
    title: "CanMEDS mapping",
    body: "Verbal feedback is automatically mapped to CanMEDS roles and competency milestones.",
  },
  {
    icon: <GlobeIcon />,
    title: "English and French",
    body: "Transcription in both official languages, with no accent penalty.",
  },
  {
    icon: <ShieldIcon />,
    title: "Canadian data residency",
    body: "Encrypted at rest and stored exclusively on Canadian infrastructure. Patient information never leaves Canada.",
  },
  {
    icon: <DocumentIcon />,
    title: "Flexible export",
    body: "One-click export to CSV or PDF. Drop straight into your program's existing workflow.",
  },
];

// Step visuals

function RecordMockup() {
  return (
    <div
      className="mx-auto mt-5 w-full max-w-[260px] rounded-[var(--radius-lg)] border border-border bg-background p-4 shadow-sm"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-2.5">
        <div className="text-xs font-medium uppercase tracking-widest text-muted">
          Recording
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent shadow-[0_2px_12px_rgba(217,119,6,0.35)]">
          <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
            <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
          </svg>
        </div>
        <div className="flex items-end gap-[2px] h-4">
          {[2, 4, 6, 3, 7, 5, 2, 6, 4, 3, 7, 4, 2].map((h, i) => (
            <span
              key={i}
              className="w-[2px] rounded-full bg-accent"
              style={{ height: `${h * 2}px`, opacity: 0.4 + h * 0.07 }}
            />
          ))}
        </div>
        <div className="font-[family-name:var(--font-mono)] text-xs text-muted">
          0:42
        </div>
      </div>
    </div>
  );
}

function ProcessMockup() {
  return (
    <div
      className="mx-auto mt-5 w-full max-w-[260px] rounded-[var(--radius-lg)] border border-border bg-background p-4 shadow-sm"
      aria-hidden="true"
    >
      <div className="text-xs font-medium uppercase tracking-widest text-muted mb-2">
        Transcript
      </div>
      <p className="text-[13px] leading-relaxed text-foreground">
        &ldquo;Good differential today. Your history-taking was thorough and
        your plan presentation was confident. Consider starting imaging
        earlier next time...&rdquo;
      </p>
      <div className="mt-3 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <span className="text-xs text-muted">Patient identifiers removed</span>
      </div>
    </div>
  );
}

function ReviewMockup() {
  return (
    <div
      className="mx-auto mt-5 w-full max-w-[260px] rounded-[var(--radius-lg)] border border-border bg-background p-4 shadow-sm"
      aria-hidden="true"
    >
      <div className="text-xs font-medium uppercase tracking-widest text-muted mb-2">
        Assessment
      </div>
      {[
        { label: "Medical Expert", value: "4 / 5" },
        { label: "Communicator", value: "5 / 5" },
        { label: "Collaborator", value: "4 / 5" },
      ].map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between border-b border-border-light py-1.5 last:border-0"
        >
          <span className="text-[13px] text-muted">{row.label}</span>
          <span className="font-[family-name:var(--font-mono)] text-[13px] font-semibold text-accent">
            {row.value}
          </span>
        </div>
      ))}
      <div className="mt-3 flex justify-end">
        <span className="rounded-[var(--radius-sm)] bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">
          Export
        </span>
      </div>
    </div>
  );
}

const steps = [
  {
    number: "01",
    title: "Record",
    body: "Open Debrief right after an encounter. The preceptor speaks naturally for a few minutes. No app installation needed.",
    visual: <RecordMockup />,
  },
  {
    number: "02",
    title: "Transcribe and de-identify",
    body: "The recording is transcribed and patient identifiers are removed. Competency data is extracted and mapped to your assessment form fields.",
    visual: <ProcessMockup />,
  },
  {
    number: "03",
    title: "Review and export",
    body: "The resident reviews and edits the pre-filled assessment, then exports to CSV or PDF with one tap.",
    visual: <ReviewMockup />,
  },
];

function HeroVignette() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col items-center gap-4 w-full max-w-[380px] mx-auto lg:mx-0 lg:max-w-[360px]"
    >
      <div className="w-full rounded-[var(--radius-lg)] border border-border bg-surface shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-end gap-[2px] h-4 shrink-0">
            {[3, 6, 4, 7, 5, 3, 6, 4].map((h, i) => (
              <span
                key={i}
                className="w-[2px] rounded-full bg-accent"
                style={{ height: `${h * 2}px`, opacity: 0.5 + i * 0.05 }}
              />
            ))}
          </div>
          <span className="text-xs font-medium uppercase tracking-widest text-muted">
            Preceptor speaking
          </span>
        </div>
        <div className="relative rounded-[var(--radius-md)] bg-background border border-border px-4 py-3">
          <p className="text-sm leading-relaxed text-foreground italic">
            &ldquo;Your approach to the differential was methodical. You picked
            up the history details that mattered and communicated the plan
            clearly to the team.&rdquo;
          </p>
          <span className="absolute -bottom-[7px] left-5 block h-3 w-3 rotate-45 border-b border-r border-border bg-background" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 py-1">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-5 w-5 text-muted"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"
          />
        </svg>
        <span className="text-xs font-medium uppercase tracking-widest text-muted">
          Structured
        </span>
      </div>

      <div className="w-full rounded-[var(--radius-lg)] border border-border bg-surface shadow-sm p-5">
        <div className="text-xs font-medium uppercase tracking-widest text-muted mb-3">
          Assessment form
        </div>
        <div className="space-y-2.5">
          {[
            { role: "Medical Expert", rating: "4 / 5", tag: "CanMEDS" },
            { role: "Communicator", rating: "5 / 5", tag: "CanMEDS" },
            { role: "Collaborator", rating: "4 / 5", tag: "CanMEDS" },
          ].map((row) => (
            <div
              key={row.role}
              className="flex items-center justify-between border-b border-border-light pb-2 last:border-0 last:pb-0"
            >
              <div>
                <span className="text-sm font-medium text-foreground">
                  {row.role}
                </span>
                <span className="ml-1.5 font-[family-name:var(--font-mono)] text-[11px] text-muted">
                  {row.tag}
                </span>
              </div>
              <span className="font-[family-name:var(--font-mono)] text-sm font-semibold text-accent">
                {row.rating}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          <span className="text-xs text-muted">
            Resident reviews and edits before export
          </span>
        </div>
      </div>
    </div>
  );
}

// Footer (no WhiteCoat Prep link)

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-[960px] px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              Product
            </p>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/#how-it-works"
                  className="text-sm text-foreground hover:text-accent transition-colors"
                >
                  How it works
                </Link>
              </li>
              <li>
                <Link
                  href="/demo"
                  className="text-sm text-foreground hover:text-accent transition-colors"
                >
                  Demo
                </Link>
              </li>
              <li>
                <Link
                  href="/for-programs"
                  className="text-sm text-foreground hover:text-accent transition-colors"
                >
                  For Programs
                </Link>
              </li>
              <li>
                <a
                  href="mailto:pilot@whitecoatprep.com?subject=Program%20inquiry"
                  className="text-sm text-foreground hover:text-accent transition-colors"
                >
                  Request a pilot
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              Company
            </p>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/about"
                  className="text-sm text-foreground hover:text-accent transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-foreground hover:text-accent transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              Trust
            </p>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/security"
                  className="text-sm text-foreground hover:text-accent transition-colors"
                >
                  Security and Compliance
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              Legal
            </p>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-foreground hover:text-accent transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-foreground hover:text-accent transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/accessibility"
                  className="text-sm text-foreground hover:text-accent transition-colors"
                >
                  Accessibility
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-1 border-t border-border pt-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-xs text-muted">
            Debrief &middot; Built by a resident for residency programs &middot; &copy; 2026
          </p>
          <p className="text-xs text-subtle">Talk first. Forms second.</p>
        </div>
      </div>
    </footer>
  );
}

// Landing content

export function LandingContent({
  isAuthenticated = false,
}: {
  isAuthenticated?: boolean;
} = {}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav isAuthenticated={isAuthenticated} />

      <main id="main-content">
        <section
          aria-labelledby="hero-heading"
          className="mx-auto max-w-[960px] px-6 pb-20 pt-16 sm:pt-24"
        >
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <p className="mb-4 inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted">
                Built by a resident, for residency programs
              </p>
              <h1
                id="hero-heading"
                className="font-[family-name:var(--font-display)] text-[2.75rem] leading-[1.1] text-foreground sm:text-[3.5rem] lg:text-[4rem]"
              >
                Talk first.
                <br />
                <span className="text-accent">Forms second.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-[560px] text-lg leading-relaxed text-muted lg:mx-0">
                Preceptors give rich verbal feedback. Debrief captures it, scrubs
                patient identifiers, and fills competency-based assessment forms
                in minutes.
              </p>

              <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/demo"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-accent px-8 text-base font-semibold text-white transition-colors hover:bg-accent-hover sm:w-auto"
                >
                  <MicIcon />
                  Try it, no sign-up
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-8 text-base font-medium text-foreground transition-colors hover:bg-border-light sm:w-auto"
                >
                  See how it works
                  <ArrowDownIcon />
                </a>
              </div>

              <p className="mt-5 text-sm text-muted">
                Running a residency program?{" "}
                <Link
                  href="/for-programs"
                  className="font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
                >
                  See For programs &rarr;
                </Link>
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 lg:items-start">
                <p className="text-sm text-muted">
                  Piloting with{" "}
                  <span className="font-medium text-foreground">
                    UBC Family Medicine
                  </span>
                </p>
                <Image
                  src="/ubc-logo.svg"
                  alt="University of British Columbia"
                  width={160}
                  height={48}
                  className="h-10 w-auto opacity-70"
                  unoptimized
                />
              </div>
            </div>

            <div className="w-full lg:w-auto order-first lg:order-last">
              <HeroVignette />
            </div>
          </div>
        </section>

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
              My preceptor gave me the best feedback in person.
              <br className="hidden sm:block" /> None of it made it to the form.
            </h2>
            <p className="mt-5 max-w-[680px] text-base leading-relaxed text-muted">
              Verbal feedback is some of the richest a trainee will ever get,
              but filling out a form after a case is friction. The conversation
              lives in someone&rsquo;s memory for a few hours, and what does
              get written down rarely captures what was actually said.
            </p>
            <p className="mt-4 max-w-[680px] text-base leading-relaxed text-muted">
              Debrief lets a preceptor speak for a few minutes whenever the
              moment lands, and turns that conversation into structured
              documentation that counts toward the formal record. The resident
              reviews and edits before it&rsquo;s finalized.
            </p>
          </div>
        </section>

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
              Three steps. A few minutes. No forms.
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
                  {step.visual}
                </li>
              ))}
            </ol>

            <p className="mt-8 text-sm text-muted">
              Maps to{" "}
              <span className="font-[family-name:var(--font-mono)] text-xs text-foreground">
                CanMEDS
              </span>
              ,{" "}
              <span className="font-[family-name:var(--font-mono)] text-xs text-foreground">
                CCFP
              </span>
              , and the Royal College&rsquo;s{" "}
              <span className="font-[family-name:var(--font-mono)] text-xs text-foreground">
                Competence by Design (CBD)
              </span>
              .
            </p>
          </div>
        </section>

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
              Built for medical education.
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
                    className="text-accent [&_svg]:h-5 [&_svg]:w-5"
                    aria-hidden="true"
                  >
                    {feature.icon}
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {feature.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="cta-heading" className="border-t border-border">
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
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/demo"
                className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-10 text-base font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                <MicIcon />
                Try it, no sign-up
              </Link>
              <Link
                href="/auth"
                className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-10 text-base font-medium text-foreground transition-colors hover:bg-border-light"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
