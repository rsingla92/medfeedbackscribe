import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact — Debrief by Whitecoat Prep",
  description:
    "Get in touch with the Debrief team. General inquiries, pilot requests, privacy questions.",
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

const contactBlocks = [
  {
    label: "General",
    email: "hello@whitecoatprep.com",
    href: "mailto:hello@whitecoatprep.com",
    description:
      "Product questions, feedback, anything else. This is the right place to start.",
  },
  {
    label: "Pilot inquiries",
    email: "pilot@whitecoatprep.com",
    href: "mailto:pilot@whitecoatprep.com?subject=Program%20inquiry",
    description:
      "Program directors and residency administrators: reach out here to start a conversation about a pilot. We respond within two business days.",
  },
  {
    label: "Privacy or security questions",
    email: "privacy@whitecoatprep.com",
    href: "mailto:privacy@whitecoatprep.com",
    description:
      "Questions about data handling, our subprocessors, or requesting a Data Processing Agreement. See also our security page.",
  },
];

export default function ContactPage() {
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
        className="mx-auto max-w-[720px] px-6 py-14 sm:py-20"
      >
        {/* Hero */}
        <div className="mb-14">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted">
            Contact
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[2.5rem] leading-[1.1] text-foreground sm:text-[3.25rem]">
            Get in touch.
          </h1>
          <p className="mt-5 max-w-[520px] text-lg leading-relaxed text-muted">
            We respond within two business days. No forms. No ticketing system.
            Just email.
          </p>
        </div>

        {/* Contact blocks */}
        <div className="flex flex-col gap-6">
          {contactBlocks.map((block) => (
            <div
              key={block.label}
              className="rounded-[var(--radius-lg)] border border-border bg-surface p-6"
            >
              <p className="text-xs font-medium uppercase tracking-widest text-muted mb-3">
                {block.label}
              </p>
              <a
                href={block.href}
                className="inline-block font-[family-name:var(--font-mono)] text-base font-medium text-accent underline underline-offset-2 hover:text-accent-hover transition-colors"
              >
                {block.email}
              </a>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {block.description}
              </p>
            </div>
          ))}
        </div>

        {/* Location + response time */}
        <div className="mt-10 rounded-[var(--radius-lg)] border border-border-light bg-background p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-12">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted mb-1">
                Location
              </p>
              <p className="text-sm text-foreground">Vancouver, BC, Canada</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted mb-1">
                Response time
              </p>
              <p className="text-sm text-foreground">Within two business days</p>
            </div>
          </div>
        </div>

        {/* Security link */}
        <p className="mt-8 text-sm text-muted">
          Looking for security and compliance information?{" "}
          <Link
            href="/security"
            className="text-accent underline underline-offset-2 hover:text-accent-hover transition-colors"
          >
            See our security page.
          </Link>
        </p>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-8">
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
              <Link href="/security" className="hover:text-foreground transition-colors">
                Security
              </Link>
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
