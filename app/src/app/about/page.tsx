import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — Debrief by Whitecoat Prep",
  description: "About Debrief, a voice-to-assessment platform for medical trainee feedback by Whitecoat Prep.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav
        className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-5"
        aria-label="Site navigation"
      >
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
      </nav>

      <main
        id="main-content"
        className="mx-auto max-w-[720px] px-6 py-20 sm:py-28"
      >
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted">
          About
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[2.5rem] leading-[1.15] text-foreground sm:text-[3rem]">
          Coming soon.
        </h1>
        <p className="mt-6 max-w-[560px] text-base leading-relaxed text-muted">
          We are working on this page. In the meantime, visit{" "}
          <a
            href="https://www.whitecoatprep.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 hover:text-accent-hover transition-colors"
          >
            whitecoatprep.com
          </a>{" "}
          or reach out at{" "}
          <a
            href="mailto:hello@whitecoatprep.com"
            className="text-accent underline underline-offset-2 hover:text-accent-hover transition-colors"
          >
            hello@whitecoatprep.com
          </a>
          .
        </p>
        <div className="mt-10">
          <Link
            href="/landing"
            className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-border bg-surface px-5 text-sm font-medium text-foreground transition-colors hover:bg-border-light focus-visible:outline-none"
          >
            Back to home
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
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
