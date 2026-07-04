# Debrief (archived)

> **This repository is archived and no longer maintained.** It was an early build exploring an idea for voice-to-assessment tooling in medical education. Nothing here is deployed or actively developed. Domain and email references below use the placeholder `med-student-feedback-scribe.dev` and do not resolve to anything.

An AI-powered voice-to-assessment prototype: a preceptor talks for a minute or two, and the app transcribes, de-identifies, and maps the conversation onto a structured medical-trainee assessment form.

**Author.** Rohit Singla, rsingla@ece.ubc.ca, [LinkedIn](https://www.linkedin.com/in/rsingla92/)

```
    ┌──────────────────────────────────────────────────────────┐
    │  Preceptor talks. Resident gets a filled-out form.        │
    │                                                            │
    │   [Browser]                                                │
    │      │  record audio, presigned PUT                        │
    │      ▼                                                     │
    │   [S3 bucket]  (SSE-KMS, ca-central-1)                      │
    │      │  PutObject event                                    │
    │      ▼                                                     │
    │   [SQS queue]  ── retries 3x, then DLQ                      │
    │      │                                                      │
    │      ▼                                                     │
    │   [Lambda worker]                                           │
    │      1. Gemini 2.5 Flash STT      (Vertex AI, Montreal)     │
    │      2. regex PHI scrub           (pass 1)                  │
    │      3. Gemini contextual scrub   (pass 2)                  │
    │      4. regex PHI scrub           (pass 3)                  │
    │      5. Gemini structured extract (CanMEDS / T-Res / One45) │
    │      6. write to Postgres, email resident via SES           │
    │      ▼                                                     │
    │   [Review page]  resident edits every field before export   │
    │      ▼                                                     │
    │   [Export]  PDF or One45-compatible CSV                     │
    └──────────────────────────────────────────────────────────┘
```

## Table of contents

- [How this project came about](#how-this-project-came-about)
- [What this project is](#what-this-project-is)
- [Why it is designed this way](#why-it-is-designed-this-way)
- [Current state](#current-state)
- [If you are skimming, look at these](#if-you-are-skimming-look-at-these)
- [Repository layout](#repository-layout)
- [Running it](#running-it)
- [How this project was built, and what I learned](#how-this-project-was-built-and-what-i-learned)
- [License](#license)

## How this project came about

I was a medical resident watching the same failure mode repeat every rotation: supervising physicians gave real, specific verbal feedback after a case, then never filled out the assessment form the program needed for accreditation. They had no incentive to spend five minutes writing something down that only helped someone else. Residents ended up self-writing their own evaluations, which defeats the point of a supervisor assessment. I wanted to know if the actual bottleneck, filling out the form, could be removed entirely by capturing what the preceptor already says out loud and mapping it onto the required fields. This repository is that first build of the idea.

## What this project is

A mobile-first [Next.js](https://nextjs.org/) app where a resident records a short conversation, and an asynchronous pipeline turns it into a structured, editable assessment. The core components:

- A recording flow that uploads audio directly to S3 via a presigned PUT, with no audio ever touching the app server.
- An S3 → SQS → Lambda pipeline that runs speech-to-text, PHI de-identification, and structured field extraction using [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models) on [Vertex AI](https://cloud.google.com/vertex-ai), all in the `northamerica-northeast1` (Montreal) region.
- Schema-driven form templates (T-Res field notes and One45 daily evaluations) mapped to [CanMEDS](https://en.wikipedia.org/wiki/CanMEDS) competencies, so a new form is a JSON template rather than a code change.
- A review page where the resident edits every extracted field before anything is exported, and an export step that produces a PDF or a One45-compatible CSV.
- Auth via [Auth.js](https://authjs.dev/) database sessions (magic link over SES, plus Google OAuth).

## Why it is designed this way

**Three PHI-scrubbing passes, not one.** Regex alone misses identifiers that only look like PHI in context (a name that also happens to be a place). An LLM alone misses identifiers a regex would catch deterministically, and can occasionally leave one in a paraphrase. The pipeline runs regex, then a Gemini contextual pass, then regex again, on the theory that each pass has a different failure mode and the combination catches more than either alone. The regex layer covers 26 pattern groups across all 18 HIPAA identifier categories plus Canadian additions (SIN, provincial health numbers, Canadian postal codes, bilingual date formats).

**A queue in front of the worker, not a fire-and-forget request handler.** An earlier version of this pipeline ran inline in a Next.js request handler using `after()`, with a cron job sweeping up sessions that got stuck. That worked until a slow Gemini call or a transient failure left a session half-processed with no automatic retry. Moving the trigger to S3 → SQS → Lambda meant retries and a dead-letter queue came for free from the queue itself, instead of being something I had to build and maintain.

**Every user-scoped query filters explicitly on `userId`, with no database-level row security.** The pipeline reads and writes plain RDS Postgres through a normal driver, not a platform with built-in row-level security. That means authorization is enforced in `app/src/lib/db/queries.ts`, not the database, which is a real constraint: every one of the 40 `userId`-scoped call sites in that file has to get it right, and a missed filter is a PHI leak rather than a cosmetic bug. That tradeoff is called out explicitly as a project invariant rather than left implicit.

**Gemini Flash over Pro, deliberately.** The Pro model was not generally available in the Montreal region at the time this was built. Rather than route any PHI through a US region to use a stronger model, the pipeline uses the weaker model that keeps every byte of patient-adjacent data in Canada. Data residency was treated as non-negotiable, not as a tradeoff to optimize against model quality.

**One LLM provider for STT, scrubbing, and extraction.** An earlier iteration used separate providers for transcription and language understanding. Consolidating onto Gemini for all three steps collapsed three API contracts, three billing relationships, and three failure modes into one.

## Current state

What's built, verified by running the suites in this snapshot:

- 20 unit tests passing in the Next.js app (`app/tests`).
- 137 unit tests passing in the Lambda pipeline worker (`infra/lambda/pipeline/__tests__`), covering the PHI scrubber, the Gemini client, and the pipeline orchestration end to end with mocked dependencies.
- A Playwright E2E suite exists but is paused; the specs predate the move to the current API surface and need rewriting rather than trusting as current coverage.
- The `deploy.yml` GitHub Actions workflow in this repo targets AWS infrastructure that this snapshot is no longer connected to, and fails immediately on every push. It is left in place as a record of the deploy shape (test gate, OIDC to ECR, App Runner rollout, health-check smoke test) rather than as something that currently runs.

What I have not built: a quantitative eval harness for extraction accuracy. I know qualitatively where the extraction pipeline does well (short, single-topic feedback) and where it struggles (long recordings covering multiple distinct encounters, which the multi-output mode only partially handles with heuristics rather than a scored classifier), but I do not have a number to put on it.

## If you are skimming, look at these

| File | Why |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Current architecture summary: stack, data flow, and the invariants (no RLS, one recording per trainee) that the rest of the code assumes. |
| [`infra/lambda/pipeline/pipeline.ts`](infra/lambda/pipeline/pipeline.ts) | The orchestration: STT → scrub → scrub → scrub → extract → write → notify, in order. |
| [`infra/lambda/pipeline/phi-scrub.ts`](infra/lambda/pipeline/phi-scrub.ts) | The regex half of the PHI defense: 26 pattern groups, with the medical-eponym exceptions (Crohn, Down syndrome) that must survive scrubbing. |
| [`infra/lambda/pipeline/__tests__/phi-scrub.test.ts`](infra/lambda/pipeline/__tests__/phi-scrub.test.ts) | What "verified" means here: positive, negative, and boundary cases per identifier category, bilingual. |
| [`app/src/lib/db/queries.ts`](app/src/lib/db/queries.ts) | Every user-scoped query in the app, and the `userId` filter each one depends on instead of database-level row security. |
| [`DESIGN.md`](DESIGN.md) | The design system: type, color, spacing, and the reasoning for each choice. |

## Repository layout

```
app/                          Next.js application
  src/app/                    App Router pages + API routes
  src/lib/db/                 Postgres client, pooled connections, queries.ts (authorization boundary)
  src/lib/pipeline/           Client-side pipeline helpers, form templates
  tests/                      Vitest unit + integration tests
infra/                        AWS CDK (TypeScript)
  lib/data-stack.ts           RDS, S3, KMS, SES, VPC
  lib/compute-stack.ts        SQS, Lambda, App Runner, ECR, IAM
  lambda/pipeline/            The pipeline worker: STT, PHI scrub, extraction, DB writes, email
data/                         Reference forms (T-Res, One45, Entrada, EPAs)
docs/                         Design docs, audits, wireframes, deploy notes
specifications.md             Original requirements spec (superseded, kept for history)
DESIGN.md                     Design system
CLAUDE.md                     Architecture + invariants, written for AI-assisted development
```

## Running it

This snapshot depends on AWS (RDS, S3, SQS, Lambda, SES) and GCP Vertex AI, all region-pinned to Canada, plus real credentials for both. It is kept here for reading, not for spinning up.

```bash
git clone https://github.com/rsingla92/medfeedbackscribe.git
cd medfeedbackscribe/app
bun install
bun run test        # 20 unit tests, no external services required

cd ../infra/lambda/pipeline
npm install
npm test             # 137 unit tests, mocked Vertex AI + DB
```

Full deploy steps (CDK stacks, DNS, migrations) are documented in [`CLAUDE.md`](CLAUDE.md) for reference; they assume AWS and GCP accounts this snapshot no longer has access to.

## How this project was built, and what I learned

**What I owned:** the problem framing (this came directly from residency, not from market research), the compliance scope (PHIPA/HIPAA identifier coverage, Canadian data residency as a hard constraint rather than a preference), the architecture pivots (dropping the fire-and-forget request handler for a queue, dropping database row-level security in favor of an explicitly-audited query layer, consolidating three LLM API contracts into one), and review of every PHI-handling code path before it landed.

**What AI tooling accelerated:** the pipeline implementation once the architecture was decided, the CDK stack scaffolding, the initial regex pattern authorship for the PHI scrubber (which I then had to correct in several places, see below), migrations, and test scaffolding.

**What I learned:**

- The regex PHI patterns an AI assistant writes first pass tend to be too aggressive. The first draft of the scrubber flagged medical eponyms like Crohn disease and Down syndrome as names, which would have redacted clinically necessary information out of every assessment. The fix was structural: an explicit exception list, tested with negative cases, not a smarter regex.
- Moving from a fire-and-forget request handler to SQS and Lambda cost more setup time than I expected (a queue, a dead-letter queue, IAM, a second deploy target) but it replaced a bespoke cron sweeper with retry behavior the queue already had built in. The upfront infrastructure cost was smaller than the ongoing cost of maintaining a hand-rolled retry mechanism.
- Giving up Supabase's row-level security when I moved to raw RDS Postgres was the design decision I was least comfortable with. It moves the entire authorization guarantee into application code, which is easy to state as an invariant in a doc and much harder to guarantee stays true as query surface area grows.
- Region pinning was the design decision with the most day-to-day friction: choosing a weaker model because the stronger one was not GA in Montreal is a decision I had to re-justify to myself more than once, and it only holds up because data residency was a hard requirement, not a nice-to-have.

## License

MIT. See [`LICENSE.txt`](LICENSE.txt).
