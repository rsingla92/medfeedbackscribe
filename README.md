# Debrief (archived)

> **This repository is archived and no longer maintained.** It was an early build exploring an idea for voice-to-assessment tooling in medical education. Nothing here is deployed or actively developed. Domain and email references below use the placeholder `med-student-feedback-scribe.dev` and do not resolve to anything.

An AI-powered voice-to-assessment prototype: a preceptor talks for a minute or two, and the app transcribes, de-identifies, and maps the conversation onto a structured medical-trainee assessment form.

**Author.** Rohit Singla, rsingla@ece.ubc.ca, [LinkedIn](https://www.linkedin.com/in/rsingla92/)

## Table of contents

- [What](#what)
- [Why](#why)
- [How](#how)
- [Current state](#current-state)
- [If you are skimming, look at these](#if-you-are-skimming-look-at-these)
- [Repository layout](#repository-layout)
- [Running it](#running-it)
- [How this project was built, and what I learned](#how-this-project-was-built-and-what-i-learned)
- [License](#license)

## What

A mobile-first [Next.js](https://nextjs.org/) app where a resident records a short conversation with a preceptor, and an asynchronous pipeline turns it into a structured, editable assessment form.

- Records audio in the browser, uploads it directly to S3 via a presigned PUT.
- Runs speech-to-text, PHI de-identification, and structured field extraction with [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models) on [Vertex AI](https://cloud.google.com/vertex-ai), all in Montreal (`northamerica-northeast1`).
- Maps extracted fields onto schema-driven form templates (T-Res field notes, One45 daily evaluations) tagged with [CanMEDS](https://en.wikipedia.org/wiki/CanMEDS) competencies.
- Lets the resident edit every field before export to PDF or a One45-compatible CSV.
- Auth via [Auth.js](https://authjs.dev/) database sessions: magic link over SES, or Google OAuth.

## Why

I was a medical resident watching the same failure repeat every rotation: preceptors gave real, specific verbal feedback after a case, then never filled out the assessment form the program needed for accreditation. There was no incentive to spend five minutes writing down something that only helped someone else. I wanted to know if that bottleneck could be removed entirely by capturing what the preceptor already says out loud. This repo is that first build.

A few design choices worth explaining:

- **Three PHI-scrubbing passes (regex, Gemini, regex), not one.** Regex alone misses identifiers that only read as PHI in context; an LLM alone occasionally leaves one in a paraphrase. Each pass catches what the other misses.
- **A queue in front of the worker, not a fire-and-forget request handler.** An earlier version ran the pipeline inline in a Next.js request via `after()`, with a cron job sweeping up stuck sessions. S3 → SQS → Lambda gets retries and a dead-letter queue for free instead of a hand-rolled sweeper.
- **Gemini Flash over Pro, deliberately.** Pro wasn't GA in Montreal at the time. Rather than route PHI through a US region for a stronger model, the pipeline uses the weaker one that keeps data in Canada.
- **One LLM provider for STT, scrubbing, and extraction.** An earlier iteration split these across providers. Consolidating onto Gemini collapsed three API contracts into one.

## How

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
| [`CLAUDE.md`](CLAUDE.md) | Current architecture summary: stack, data flow, and the invariants the rest of the code assumes. |
| [`infra/lambda/pipeline/pipeline.ts`](infra/lambda/pipeline/pipeline.ts) | The orchestration: STT → scrub → scrub → scrub → extract → write → notify, in order. |
| [`infra/lambda/pipeline/phi-scrub.ts`](infra/lambda/pipeline/phi-scrub.ts) | The regex half of the PHI defense: 26 pattern groups, with the medical-eponym exceptions (Crohn, Down syndrome) that must survive scrubbing. |
| [`infra/lambda/pipeline/__tests__/phi-scrub.test.ts`](infra/lambda/pipeline/__tests__/phi-scrub.test.ts) | What "verified" means here: positive, negative, and boundary cases per identifier category, bilingual. |
| [`DESIGN.md`](DESIGN.md) | The design system: type, color, spacing, and the reasoning for each choice. |

## Repository layout

```
app/                          Next.js application
  src/app/                    App Router pages + API routes
  src/lib/db/                 Postgres client, pooled connections, queries
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

**I owned:** the problem framing, the compliance scope (HIPAA/PHIPA identifier coverage, Canadian residency as a hard requirement), the architecture pivots below, and review of every PHI-handling code path.

**AI tooling accelerated:** the pipeline implementation once the architecture was decided, CDK scaffolding, initial PHI regex authorship, migrations, and test scaffolding.

**What I learned:**

- AI-written PHI regex is too aggressive by default. First draft flagged Crohn disease and Down syndrome as names. Fix was an explicit, tested exception list, not a smarter pattern.
- The queue cost more setup than the fire-and-forget handler it replaced, but it replaced a hand-rolled cron sweeper with retries the queue already had.
- Picking Gemini Flash over Pro for regional availability was a call I re-justified more than once. It only holds up because residency was non-negotiable, not a preference.

## License

MIT. See [`LICENSE.txt`](LICENSE.txt).
