import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — Debrief by Whitecoat Prep",
  description:
    "Debrief is built on a simple premise: verbal feedback is the best feedback. We capture it, scrub patient identifiers, and turn it into the formal record your training program needs.",
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

const beliefs = [
  {
    title: "Supervisors should talk, not type.",
    body: "Clinicians already give high-quality verbal feedback. The problem is not the quality of their feedback; it is that nothing captures it. A busy preceptor should not have to choose between a good conversation and a completed form.",
  },
  {
    title: "Trainees deserve specific feedback.",
    body: "Generic ratings on a five-point scale are not feedback. What residents need is what was actually said: specific observations, concrete suggestions, and clear strengths. Verbal feedback already contains all of that. We preserve it.",
  },
  {
    title: "Assessment data should reflect what was actually said.",
    body: "Competency ratings filled in from memory, days after an encounter, reflect what the form asks for, not what happened. Data drawn directly from the conversation is more accurate, more specific, and more useful for both the trainee and the program.",
  },
  {
    title: "Data about Canadian medical training should stay in Canada.",
    body: "We store and process everything on Canadian infrastructure. This is not a feature we added at the end; it is how the system was designed from the start.",
  },
];

export default function AboutPage() {
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
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-none"
        >
          Try it free
        </Link>
      </nav>

      <main id="main-content">
        {/* Hero */}
        <section
          aria-labelledby="hero-heading"
          className="mx-auto max-w-[720px] px-6 pb-16 pt-14 sm:pb-20 sm:pt-20"
        >
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted">
            About
          </p>
          <h1
            id="hero-heading"
            className="font-[family-name:var(--font-display)] text-[2.5rem] leading-[1.1] text-foreground sm:text-[3.25rem]"
          >
            Talk first.
            <br />
            <span className="text-accent">Forms second.</span>
          </h1>
          <p className="mt-6 max-w-[600px] text-lg leading-relaxed text-muted">
            Debrief exists because the best feedback in medical training happens
            in a conversation, not in a form. Preceptors and trainees talk after
            almost every encounter. That conversation has always been where the
            real learning happens. The form comes after, and it often doesn't
            come at all.
          </p>
        </section>

        {/* Mission */}
        <section
          aria-labelledby="mission-heading"
          className="border-t border-border bg-surface"
        >
          <div className="mx-auto max-w-[720px] px-6 py-16 sm:py-20">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              Mission
            </p>
            <h2
              id="mission-heading"
              className="font-[family-name:var(--font-display)] text-[1.75rem] leading-[1.2] text-foreground sm:text-[2rem]"
            >
              Preserve the feedback that already happens.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted">
              Our mission is to preserve the high-quality verbal feedback that
              already happens in clinical training, and turn it into a formal
              record without making clinicians fill out one more form. We do
              that by capturing the conversation, removing any patient
              identifiers that might have slipped in, and mapping what was said
              to the competency framework your program uses. The trainee reviews
              everything before it becomes official. No automation without
              oversight.
            </p>
          </div>
        </section>

        {/* What we believe */}
        <section
          aria-labelledby="beliefs-heading"
          className="border-t border-border"
        >
          <div className="mx-auto max-w-[960px] px-6 py-16 sm:py-20">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              What we believe
            </p>
            <h2
              id="beliefs-heading"
              className="font-[family-name:var(--font-display)] text-[1.75rem] leading-[1.2] text-foreground sm:text-[2rem]"
            >
              Four things we keep coming back to.
            </h2>
            <ul
              className="mt-10 grid gap-6 sm:grid-cols-2"
              aria-label="Core beliefs"
            >
              {beliefs.map((belief) => (
                <li
                  key={belief.title}
                  className="rounded-[var(--radius-lg)] border border-border p-6"
                >
                  <h3 className="text-base font-semibold text-foreground">
                    {belief.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {belief.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* About Whitecoat Prep */}
        <section
          aria-labelledby="wcp-heading"
          className="border-t border-border bg-surface"
        >
          <div className="mx-auto max-w-[720px] px-6 py-16 sm:py-20">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              Parent brand
            </p>
            <h2
              id="wcp-heading"
              className="font-[family-name:var(--font-display)] text-[1.75rem] leading-[1.2] text-foreground sm:text-[2rem]"
            >
              About Whitecoat Prep
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted">
              Debrief is a product of{" "}
              <a
                href="https://www.whitecoatprep.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2 hover:text-accent-hover transition-colors"
              >
                Whitecoat Prep
              </a>
              , a Canadian company building tools for medical trainees and the
              clinicians who supervise them. Whitecoat Prep is focused on the
              parts of medical training that don't have good software yet:
              feedback, documentation, and the administrative burden that takes
              time away from learning.
            </p>
            <div className="mt-8 rounded-[var(--radius-lg)] border border-border bg-background p-5">
              <p className="text-sm font-medium text-foreground">
                Currently piloting with UBC Family Medicine.
              </p>
              <p className="mt-1 text-sm text-muted">
                We are in an active pilot with the University of British Columbia
                Family Medicine program. Feedback from that cohort shapes every
                release.
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section
          aria-labelledby="contact-heading"
          className="border-t border-border"
        >
          <div className="mx-auto max-w-[720px] px-6 py-16 sm:py-20 text-center">
            <h2
              id="contact-heading"
              className="font-[family-name:var(--font-display)] text-[1.75rem] leading-[1.2] text-foreground sm:text-[2rem]"
            >
              No team page yet.
            </h2>
            <p className="mx-auto mt-4 max-w-[480px] text-base leading-relaxed text-muted">
              We're not listing names until there are more names to list. In the
              meantime, email us directly.
            </p>
            <a
              href="mailto:hello@whitecoatprep.com"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-10 text-base font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-none"
            >
              hello@whitecoatprep.com
            </a>
            <p className="mt-4 text-sm text-muted">
              Want to work with us?{" "}
              <a
                href="mailto:hello@whitecoatprep.com"
                className="text-accent underline underline-offset-2 hover:text-accent-hover transition-colors"
              >
                hello@whitecoatprep.com
              </a>
            </p>
          </div>
        </section>
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
