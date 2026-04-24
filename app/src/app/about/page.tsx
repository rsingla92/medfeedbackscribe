import type { Metadata } from "next";
import Link from "next/link";
import { DebriefWordmark, SiteFooter } from "@/app/_landing/content";

export const metadata: Metadata = {
  title: "About — Debrief",
  description:
    "Debrief is built by a resident, for residency programs. Verbal feedback is the best feedback; we capture it, scrub identifiers, and turn it into the formal record training programs need.",
};

const beliefs = [
  {
    title: "Preceptors should talk, not type.",
    body: "Clinicians already give high-quality verbal feedback. The problem isn&rsquo;t quality; it&rsquo;s that nothing captures it. A busy preceptor should not have to choose between a good conversation and a completed form.",
  },
  {
    title: "Residents deserve specific feedback.",
    body: "Generic 5-point ratings aren&rsquo;t feedback. What residents need is what was actually said: specific observations, concrete suggestions, clear strengths. Verbal feedback already contains all of that. We preserve it.",
  },
  {
    title: "Assessment data should reflect what was actually said.",
    body: "Competency ratings filled in from memory, days after an encounter, reflect the form, not the case. Data drawn directly from the conversation is more accurate, more specific, and more useful — for the resident and the program.",
  },
  {
    title: "Canadian training data stays in Canada.",
    body: "We store and process everything on Canadian infrastructure. This wasn&rsquo;t a feature added at the end; it&rsquo;s how the system was designed from day one.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav
        className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-5"
        aria-label="Site navigation"
      >
        <DebriefWordmark />
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/auth"
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-border-light sm:px-5"
          >
            Sign in
          </Link>
          <Link
            href="/demo"
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover sm:px-5"
          >
            Try it free
          </Link>
        </div>
      </nav>

      <main id="main-content">
        {/* Hero */}
        <section
          aria-labelledby="hero-heading"
          className="mx-auto max-w-[720px] px-6 pb-16 pt-14 sm:pb-20 sm:pt-20"
        >
          <p className="mb-4 inline-block rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-muted">
            Built by a resident, for residency programs
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
            in a conversation, not in a form. Preceptors and residents talk
            after almost every encounter. That&rsquo;s where the real learning
            happens. The form comes after, and it often doesn&rsquo;t come at
            all.
          </p>
        </section>

        {/* Founder story */}
        <section
          aria-labelledby="story-heading"
          className="border-t border-border bg-surface"
        >
          <div className="mx-auto max-w-[720px] px-6 py-16 sm:py-20">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
              The story
            </p>
            <h2
              id="story-heading"
              className="font-[family-name:var(--font-display)] text-[1.75rem] leading-[1.2] text-foreground sm:text-[2rem]"
            >
              From a busy night shift.
            </h2>

            {/* Visual: simple quote-mark accent */}
            <div
              aria-hidden="true"
              className="mt-8 flex items-center gap-4"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-10 w-10 shrink-0 text-accent-light"
              >
                <path d="M7.5 5.25A2.25 2.25 0 0 0 5.25 7.5v4.5A2.25 2.25 0 0 0 7.5 14.25h1.19l-.63 3.38a.75.75 0 0 0 1.22.73l4.5-4.13a.75.75 0 0 0 .22-.54V7.5A2.25 2.25 0 0 0 11.75 5.25h-4.25Zm9 0A2.25 2.25 0 0 0 14.25 7.5v4.5A2.25 2.25 0 0 0 16.5 14.25h1.19l-.63 3.38a.75.75 0 0 0 1.22.73l4.5-4.13a.75.75 0 0 0 .22-.54V7.5a2.25 2.25 0 0 0-2.25-2.25h-4.25Z" />
              </svg>
              <p className="font-[family-name:var(--font-display)] text-xl leading-snug text-foreground italic">
                &ldquo;My preceptor gave me the best feedback of my training — in the
                stairwell, at 2am. None of it ever made it to a form.&rdquo;
              </p>
            </div>

            <div className="mt-8 space-y-5 text-base leading-relaxed text-muted">
              <p>
                Debrief was built by a family medicine resident in British
                Columbia after years of watching the same thing happen on every
                rotation: a preceptor gives rich, specific, immediately useful
                verbal feedback right after a case — and none of it is ever
                written down.
              </p>
              <p>
                What gets written down is the form. The generic boxes, filled
                in days later from memory, with whichever trainee happened to
                come to mind that week. The actual feedback — the part that
                would have changed how the trainee practices tomorrow — lives
                in the hallway and then disappears.
              </p>
              <p>
                That gap between what&rsquo;s said and what&rsquo;s documented
                is the whole reason this product exists. Every design decision
                comes back to it: we don&rsquo;t ask clinicians to do more
                typing, we don&rsquo;t ask residents to chase preceptors for
                paperwork, and we don&rsquo;t pretend a rating scale captures
                anything that matters. We just preserve the conversation,
                scrub what shouldn&rsquo;t be there, and give the resident a
                draft they can review before it counts.
              </p>
            </div>

            <div className="mt-8 rounded-[var(--radius-lg)] border border-border bg-background p-5">
              <p className="text-sm font-medium text-foreground">
                Currently piloting with UBC Family Medicine.
              </p>
              <p className="mt-1 text-sm text-muted">
                We&rsquo;re in an active pilot with the University of British
                Columbia Family Medicine program. Feedback from residents and
                preceptors in that cohort shapes every release.
              </p>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section
          aria-labelledby="mission-heading"
          className="border-t border-border"
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
              record without making clinicians fill out one more form. We
              capture the conversation, remove any patient identifiers that
              might have slipped in, and map what was said to the competency
              framework your program uses. The resident reviews everything
              before it becomes official. No automation without oversight.
            </p>
          </div>
        </section>

        {/* What we believe */}
        <section
          aria-labelledby="beliefs-heading"
          className="border-t border-border bg-surface"
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
                  className="rounded-[var(--radius-lg)] border border-border bg-background p-6"
                >
                  <h3 className="text-base font-semibold text-foreground">
                    {belief.title}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-relaxed text-muted"
                    dangerouslySetInnerHTML={{ __html: belief.body }}
                  />
                </li>
              ))}
            </ul>
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
              Talk to us.
            </h2>
            <p className="mx-auto mt-4 max-w-[480px] text-base leading-relaxed text-muted">
              If you&rsquo;re running a residency program — or if you&rsquo;re a
              resident who has opinions about assessment — we want to hear from
              you.
            </p>
            <a
              href="mailto:hello@whitecoatprep.com"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-10 text-base font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              hello@whitecoatprep.com
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
