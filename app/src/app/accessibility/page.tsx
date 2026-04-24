import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Accessibility — Debrief by Whitecoat Prep",
  description:
    "Debrief's accessibility statement. We are working toward WCAG 2.1 AA and treat accessibility as ongoing work, not a launch checkbox.",
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

const whatWeveDone = [
  {
    title: "Semantic HTML",
    body: "Pages use landmark elements (nav, main, section, footer), heading hierarchy, and ARIA labels where native semantics are insufficient.",
  },
  {
    title: "Keyboard navigation",
    body: "All interactive elements are reachable and operable with a keyboard. Focus indicators are visible and use our amber accent color at sufficient contrast.",
  },
  {
    title: "Color contrast",
    body: "Text and interactive element colors meet a 4.5:1 contrast ratio against their backgrounds for normal text, and 3:1 for large text, per WCAG 2.1 AA requirements.",
  },
  {
    title: "Screen-reader labels",
    body: "Interactive elements without visible text labels carry aria-label or aria-labelledby attributes. Decorative elements are marked aria-hidden.",
  },
];

const knownGaps = [
  "The platform has not yet been audited by a third-party accessibility specialist.",
  "The audio recording interface has not been tested with all common screen readers on mobile.",
  "Automated testing covers basic structural checks only, not full WCAG criterion verification.",
];

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav
        className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-5"
        aria-label="Site navigation"
      >
        <DebriefWordmark />
        <Link
          href="/demo"
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Try it free
        </Link>
      </nav>

      <main
        id="main-content"
        className="mx-auto max-w-[720px] px-6 py-12 sm:py-16"
      >
        {/* Header */}
        <div className="mb-10">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
            Accessibility
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-[1.2] text-foreground sm:text-[2.5rem]">
            Accessibility statement.
          </h1>
          <p className="mt-3 text-sm text-muted">
            Last updated: April 14, 2026.
          </p>
        </div>

        <div className="space-y-10">

          {/* Conformance target */}
          <section aria-labelledby="conformance-heading">
            <h2
              id="conformance-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              Conformance target
            </h2>
            <p className="text-base leading-relaxed text-muted">
              Debrief is working toward conformance with{" "}
              <strong className="font-semibold text-foreground">
                WCAG 2.1 Level AA
              </strong>{" "}
              (Web Content Accessibility Guidelines, published by the W3C).
              This is our design target for all new features and pages.
            </p>
            <div className="mt-4 rounded-[var(--radius-md)] bg-warning-bg border border-warning border-opacity-40 px-4 py-3">
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">Aspirational:</span>{" "}
                We have not yet completed a formal third-party accessibility
                audit. The statement below reflects our current engineering
                practices and intentions, not a certified conformance claim.
              </p>
            </div>
          </section>

          {/* What we've done */}
          <section aria-labelledby="done-heading">
            <h2
              id="done-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              What we have done
            </h2>
            <ul className="flex flex-col gap-4" aria-label="Accessibility measures taken">
              {whatWeveDone.map((item) => (
                <li
                  key={item.title}
                  className="rounded-[var(--radius-lg)] border border-border bg-surface p-5"
                >
                  <h3 className="text-sm font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* Known gaps */}
          <section aria-labelledby="gaps-heading">
            <h2
              id="gaps-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              Known gaps
            </h2>
            <ul className="flex flex-col gap-3" aria-label="Known accessibility gaps">
              {knownGaps.map((gap, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted"
                    aria-hidden="true"
                  />
                  <p className="text-base leading-relaxed text-muted">{gap}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Ongoing work */}
          <section aria-labelledby="ongoing-heading">
            <h2
              id="ongoing-heading"
              className="font-[family-name:var(--font-display)] text-xl text-foreground mb-3"
            >
              Ongoing work
            </h2>
            <p className="text-base leading-relaxed text-muted">
              We treat accessibility as ongoing work, not a launch checkbox.
              Each new feature and page is built with keyboard navigation and
              screen-reader compatibility in mind from the start. We plan to
              commission a third-party accessibility audit as the product
              matures.
            </p>
          </section>

          {/* Report an issue */}
          <section
            aria-labelledby="report-heading"
            className="rounded-[var(--radius-lg)] border border-border bg-surface p-6"
          >
            <h2
              id="report-heading"
              className="font-[family-name:var(--font-display)] text-lg text-foreground mb-2"
            >
              Report an accessibility issue
            </h2>
            <p className="text-sm text-muted mb-4">
              If you experience a barrier using Debrief, please let us know.
              We will investigate and respond within five business days.
            </p>
            <a
              href="mailto:accessibility@whitecoatprep.com"
              className="inline-block font-[family-name:var(--font-mono)] text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-hover transition-colors"
            >
              accessibility@whitecoatprep.com
            </a>
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
              <Link href="/security" className="hover:text-foreground transition-colors">
                Security
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
