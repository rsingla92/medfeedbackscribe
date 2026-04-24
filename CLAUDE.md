# Debrief

## Project
AI-powered voice-to-assessment platform for medical trainee feedback. Residents capture verbal preceptor feedback, which gets transcribed and auto-populates required assessment forms.

## Tech Stack
- **Frontend**: Next.js 16 (App Router, Turbopack, standalone container), React 19, Tailwind CSS 4, PWA
- **Auth**: Auth.js v5 (NextAuth) — magic link via SES + Google OAuth, database sessions, `@auth/pg-adapter`
- **Database**: AWS RDS PostgreSQL 16 (ca-central-1), accessed via `postgres` (Porsager) in the app + Lambda. Migrations in `app/src/lib/db/migrations/`, runner at `app/scripts/migrate.ts`
- **Storage**: AWS S3 (ca-central-1) with SSE-KMS, presigned PUT uploads from the browser
- **Async pipeline**: S3 PutObject → SQS → Lambda worker (`infra/lambda/pipeline/`). No Vercel `after()`, no threading — SQS delivers; Lambda processes
- **STT + LLM**: Gemini 2.5 Flash via Vertex AI (northamerica-northeast1, Montreal) for STT, PHI scrubbing, and assessment extraction
- **Email**: AWS SES (ca-central-1) for magic links + assessment notifications
- **Hosting**: AWS App Runner (container from ECR, auto-deploy on `:latest` push). GitHub Actions OIDC → ECR → App Runner
- **Infra**: AWS CDK (TypeScript) at `infra/` — `DebriefDataStack` (RDS, S3, KMS, SES, VPC) + `DebriefComputeStack` (SQS, Lambda, App Runner, ECR, IAM)
- **Testing**: Vitest for unit tests (app: 20 tests; Lambda: 134 tests)

PHIPA residency: every AWS resource is in ca-central-1; Vertex AI is northamerica-northeast1. All PHI stays in Canada.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Key Design Decisions
- Amber accent (#D97706), not blue — warm, personal, not clinical
- Instrument Serif for headlines, DM Sans for body, Geist Mono for data
- Minimal decoration — content is the visual focus
- Mobile-first single-column layout

## Architecture
- **Recording → upload**: browser fetches `/api/upload-url` → presigned S3 PUT → direct upload. No `/api/process` call; S3 event drives the rest.
- **Pipeline**: S3 PutObject → SQS → Lambda `debrief-pipeline-worker`. Lambda runs STT → regex scrub → Gemini PHI scrub → regex → extract → DB writes → SES notification. Retries 3x via SQS, then DLQ.
- **Auth**: Auth.js database sessions. Custom `users` table (Auth.js-owned) + `profiles` (app-owned, 1:1, mirrors `users.email` so the Lambda can notify residents without crossing into Auth.js schema).
- **Schema naming**: app's session table is `recording_sessions` (renamed to avoid collision with Auth.js's `sessions` table). All Lambda + app queries use this name.
- **Authorization**: no RLS. Every user-scoped DB query in `app/src/lib/db/queries.ts` takes `userId` and filters on it. PHIPA-critical — don't break this invariant.
- **PHI scrubbing**: belt-and-suspenders — regex first (26 pattern groups, all 18 HIPAA + Canadian), then Gemini contextual, then regex again. All on Canadian infrastructure.
- **One recording per trainee** (no multi-trainee splitting).
- **Resident is the quality gate** — reviews all LLM output before export.
- **French/Québécois**: production cutover complete — Gemini handles both languages natively.

## Testing
- Run app tests: `cd app && bun run test`
- Run Lambda tests: `cd infra/lambda/pipeline && npm test`
- Vitest for unit tests
- Playwright E2E suite is paused during the AWS migration; specs need rewriting against the new API surface.
- Custom eval harness for LLM extraction accuracy (planned)

## Deploy
1. `cd infra && cdk deploy DebriefDataStack` (RDS, S3, KMS, SES, VPC) — ~15 min. Add the SES DKIM records from stack outputs to DNS, wait for verification.
2. `cd infra && cdk deploy DebriefComputeStack` (SQS, Lambda, App Runner, ECR, IAM) — needs a placeholder ECR image on first deploy; see `infra/README.md`.
3. From the `app/` directory or via GitHub Actions: `docker buildx build --push -t <ecr>/debrief-web:latest ./app`. App Runner auto-redeploys on `:latest`.
4. Run migrations: `cd app && DATABASE_URL=... bun run migrate`.
