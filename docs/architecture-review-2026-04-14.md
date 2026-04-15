# Adversarial Architecture Review — Debrief
**Date:** 2026-04-14
**Reviewer:** Automated adversarial review
**Scope:** Scale, reliability, observability, cost, and operational fragility

---

## Thesis

The single highest operational risk is that `/api/process` awaits the entire pipeline synchronously inside a Vercel serverless function. Every concurrent recording session consumes one function execution slot for 30-120 seconds, CPU billing is linear against wall-clock time, and there is zero queue or circuit-breaker between the user's HTTP request and three sequential external API calls (Deepgram, Claude PHI, Claude extract). At pilot scale with 5-10 residents this is invisible. At 50 concurrent users hitting the app right after rounds (6-7pm), the cost-per-run blowup, Vercel CPU-hour exhaustion, and cascading Deepgram/Anthropic rate-limit failures will all arrive simultaneously with no alerting and no retry path — leaving sessions silently stranded in `processing` status until a human notices.

---

## Findings Table

| ID | Severity | Area | Evidence | Blast Radius | Recommendation |
|----|----------|------|----------|--------------|----------------|
| F-01 | **Critical** | Pipeline Architecture | `route.ts:148` — `await runPipeline(...)` is synchronous. The HTTP response does not return until the full pipeline (STT + PHI + extract + email) completes. Verified: no background dispatch, no `waitUntil`, no queue. | Every concurrent user ties up one Vercel function invocation for 30-120s. At Vercel Pro's 16 CPU-hr/mo soft cap, ~480 2-min pipeline calls exhaust the included budget and begin incurring overage charges. Cold-start latency adds ~1-2s per call. | Use `after()` (Next.js 15+) or Supabase Edge Function triggered by a database row status change to move pipeline off the HTTP path. Return 202 immediately; let the client poll session status. |
| F-02 | **Critical** | PHI / Compliance | Transcripts containing PHI are sent to Deepgram (US-domiciled) and Anthropic (US-domiciled). The README states "Canadian data residency — all data encrypted at rest and stored in Canada" — this is factually incomplete. PHI leaves Canada on every recording. There is no documented BAA with Deepgram or Anthropic, no PIPEDA/PHIPA risk assessment, and no disclosure to users. | PHIPA (Ontario) and PIPEDA require consent for cross-border PHI transfer with comparable protections. Absence of a BAA is a regulatory gap that could block institutional procurement. | (1) Add explicit disclosure: "Audio is processed by Deepgram (US) and Anthropic (US) — see our privacy policy." (2) Confirm or obtain BAAs before institutional launch. (3) Evaluate Deepgram's Canadian region or on-prem STT alternatives. |
| F-03 | **High** | Failure Modes / Idempotency | No retry logic anywhere in the pipeline. If Deepgram returns 429 or times out, the session is marked `processing_failed` and cannot be re-triggered — the user has no "try again" button exposed in the UI. In `route.ts:50-55`, a session in `processing` state is rejected with 409, but a stuck `processing` session (e.g., Vercel function killed by OOM before the catch block runs) is never recovered. | At 1% Deepgram error rate and 100 sessions/day, ~1 session/day stuck permanently. At 10% (Deepgram incident), 10/day. Users lose recordings with no recourse. | (1) Expose a "Re-process" button that resets status from `processing_failed` → `created`. (2) Add a stuck-detection cron: sessions in `processing` for >5 min get reset to `processing_failed`. (3) Add exponential backoff for 429s inside `stt.ts`. |
| F-04 | **High** | Observability | `pipeline_logs` table is written but never read in production. No alerting, no dashboard, no Sentry integration. Error rate spike discovery path: a resident complains, someone manually queries Supabase SQL editor. Metrics page (`/metrics`) shows aggregate session counts but not pipeline error rates. `PILOT_ADMINS` is a hardcoded array — adding a second admin requires a code deploy. | A 50% pipeline error rate would go undetected until user complaints. No p95 latency data, no cost attribution per run, no anomaly detection. | (1) Add a Supabase cron query that alerts (email/Slack) when `pipeline_logs` error rate in the last hour exceeds 10%. (2) Add an error-rate row to `/metrics`. (3) Move admin list to a DB table. |
| F-05 | **High** | Storage / Retention | `delete_expired_audio()` (migration 002) NULLs `audio_path` in Postgres but does NOT delete the actual Supabase Storage object. The comment says "actual Storage file deletion must be done via the Supabase Storage API — a companion Edge Function or cron should call `storage.remove()`." This companion function does not exist in the codebase. Audio files accumulate forever in Storage. | At 2 MB avg per 2-min recording, 100 sessions/day: 200 MB/day, 6 GB/month, 72 GB/year. Supabase Storage is $0.021/GB/month beyond the free 1 GB. 72 GB costs ~$1.50/mo — low dollar cost but PHI accumulates indefinitely in violation of the 90-day retention claim. | Implement the companion Storage deletion Edge Function. Schedule alongside the SQL cron. Test that both execute in CI. |
| F-06 | **High** | Cost — Vercel CPU Hours | Vercel Pro includes 16 CPU-hours/month. Each pipeline run at 60s wall-clock ≈ 60s of compute (generous: function stays active entire duration). 16 CPU-hr = 57,600 CPU-seconds = ~960 pipeline runs/month before overage at $0.18/CPU-hr. At 100 sessions/day (3,000/month), overage = ~$370/month in CPU alone on top of the $20 base. | Pilot (30 sessions/month): within limits. 100 sessions/day: $370/month CPU overage. 1,000 sessions/day: $3,700+/month — cost structure makes the synchronous model untenable before meaningful user numbers. | Move to fire-and-forget architecture (F-01 recommendation). Supabase Edge Functions billed at $2/million invocations + $0.09/GB-hr memory — 3,000 2-min jobs/month ≈ $0.006. |
| F-07 | **Medium** | Single-Region Risk | Supabase `ca-central-1` (Montreal) + Vercel `yul1` (Montreal). Both in the same metro region/AZ cluster. AWS ca-central-1 has had multi-AZ incidents (most recently November 2024 for ~4 hours). No RTO/RPO defined, no read replica, no cold-standby. | Full outage for entire user base during AWS ca-central-1 incidents. No automated failover. No backup restoration runbook. | Document RTO/RPO (even "best effort, 4hr RTO" is better than nothing). Enable Supabase PITR (point-in-time recovery). Consider Vercel's global fallback for static pages. |
| F-08 | **Medium** | Deploy Pipeline | No CI. No test gate before deploy. No staging environment. Deploy is `vercel deploy --prod` from a developer's laptop. The 14 unit tests are not run as part of any automated pipeline. `bun.lock` must be manually committed. | A breaking change to the pipeline (e.g., Claude model swap from `claude-sonnet-4-20250514` to Gemini) ships directly to production residents. One bad migration can corrupt the live database. | Add GitHub Actions workflow: `bun test` on push to main, `vercel deploy --prod` only on green. Add a `preview` environment for PRs. |
| F-09 | **Medium** | Database Migrations | 6 migration files, no rollback scripts, no migration tests. Migration 006 adds RLS policies — a policy bug ships directly to prod. The `delete_expired_audio` function is created with `CREATE OR REPLACE` but the cron schedule is documented only in a SQL comment, not in the codebase or CI. The `pipeline_logs` table joins every step insert — at 100 sessions/day × 5 log rows = 500 inserts/day; at 10,000/day this becomes a write hotspot without partitioning. | A botched migration on the `sessions` table (which has no `LOCK TIMEOUT`) blocks reads for the entire user base during the ALTER. `pipeline_logs` becomes a multi-GB table with no TTL. | (1) Add `-- rollback:` comments with inverse SQL to every migration. (2) Add `lock_timeout = '2s'` to future DDL statements. (3) Add a `created_at < now() - interval '30 days'` TTL delete on `pipeline_logs` in the same cron job. |
| F-10 | **Medium** | Concurrent Processing — No Concurrency Limit | Nothing prevents 100 users from each hitting `/api/process` simultaneously. Each call fires Deepgram + two Claude calls concurrently with all others. Deepgram nova-2-medical has per-account concurrency limits (default 10-25 concurrent streams on growth plan). | At 25 concurrent requests: Deepgram throttles calls 26-100, each throws `STT_RATE_LIMIT`, pipeline marks sessions `processing_failed`. Mass failure event post-rounds. | Add a global processing semaphore (Redis or Supabase pg_advisory_lock) limiting concurrent pipeline runs to ≤ 10 while queue-based redesign is built (F-01). |
| F-11 | **Low** | Feature Flags / Model Rollout | `claude-sonnet-4-20250514` is hardcoded in both `phi-scrub.ts` and `extract.ts`. The TODOS.md mentions a future Gemini swap. No feature-flag mechanism exists. Model change = code change = full deploy. | Gemini swap ships to all users at once with no gradual rollout, no A/B comparison, no rollback capability. | Introduce a `PIPELINE_MODEL` env var read at runtime. Shadow-mode testing (run new model in parallel, compare outputs, log deltas) before traffic migration. |
| F-12 | **Low** | Preceptor Table — Shared Mutable State | Migration 003 grants all authenticated users INSERT/UPDATE/DELETE on `preceptors`. Any resident can rename or delete any preceptor globally. | Resident A accidentally deletes Dr. Smith. All of Resident B's historical sessions now have a dangling `preceptor_id`. No audit log of preceptor mutations. | (1) Remove DELETE policy from preceptors. (2) Add `created_by uuid references auth.users(id)` to `preceptors` and scope UPDATE to `created_by = auth.uid()`. (3) Add a `preceptors_audit` log trigger. |
| F-13 | **Low** | Transcript Raw PHI in DB | `transcript_raw` (pre-PHI-scrub) is stored permanently in the `recordings` table. If PHI scrubbing fails (which is non-fatal — see `pipeline/index.ts:143-145`), the raw transcript with patient names survives in the database indefinitely. | PHI breach surface: anyone with Supabase service role (e.g., a future data analyst) can read raw patient names, room numbers, etc. | NULL out `transcript_raw` after successful PHI scrubbing and assessment extraction. Or encrypt `transcript_raw` at the column level with a resident-scoped key. |

---

## Load Model

| Load Tier | Sessions/Day | Concurrent Peak (6pm) | What Breaks |
|-----------|-------------|----------------------|-------------|
| **1x (Pilot)** | 10-30 | 3-5 | Nothing obvious. All within Vercel/Supabase free limits. Deepgram concurrency fine. Vercel CPU ~30-90 CPU-sec/day, well within 16 CPU-hr/mo. |
| **10x** | 100-300 | 30-50 | Deepgram concurrency limit hit (default 25): 5-25 requests throttled per surge → `processing_failed` cascade. Vercel CPU overage begins (~$370/mo). `pipeline_logs` table at 1,500 rows/day — no impact yet. Admin email list still hardcoded. |
| **100x** | 1,000-3,000 | 300-500 | Vercel CPU exhausted ($3,700+/mo in overage or function throttling). Deepgram rate limits → mass failures. `pipeline_logs` at 15,000 rows/day → query slowdown without index on `created_at`. Audio Storage at 200 GB/mo (no retention enforcement). Synchronous pipeline model fundamentally incompatible with this load. Supabase free tier (500 MB DB) exceeded by month 2. |

**First breakage point:** ~25 simultaneous users, triggered by Deepgram concurrency limit. Expected at ~50 residents at peak rounds time (6-7pm) with 2-3 sites in pilot.

---

## Cost Model

**Assumptions:**
- Average recording: 2 minutes audio
- Deepgram nova-2-medical: $0.0043/min (pre-recorded) → $0.0086 per 2-min call
- Claude PHI scrub: ~800 input tokens (transcript) + 800 output tokens, claude-sonnet-4-20250514 at $3/MTok in / $15/MTok out → ($0.0024 + $0.012) = **$0.0144 per scrub**
- Claude extract: ~2,000 input tokens (transcript + template) + 1,500 output tokens → ($0.006 + $0.0225) = **$0.0285 per extract**
- Supabase Storage: $0.021/GB/month; 2 MB per recording → $0.000042/recording storage (negligible for first year)
- Vercel invocation: $0.60/1M over included; at 1 invocation/session → negligible per-recording cost; CPU is the binding constraint
- Resend email (2-3 emails/session at $0.001/email): **$0.002-0.003 per session**
- Vercel CPU: 60s wall-clock per pipeline = 1 CPU-min; at 16 CPU-hr/mo included, overage at ~$0.18/CPU-hr

| Volume | Deepgram | Claude PHI | Claude Extract | Email | Vercel CPU | Total/Month |
|--------|----------|-----------|----------------|-------|------------|-------------|
| 30 sessions/mo (pilot) | $0.26 | $0.43 | $0.86 | $0.09 | Included | **~$1.64/mo** |
| 1,000 sessions/mo | $8.60 | $14.40 | $28.50 | $3.00 | ~$3.00 overage | **~$57.50/mo** |
| 10,000 sessions/mo | $86.00 | $144.00 | $285.00 | $30.00 | ~$270.00 overage | **~$815/mo** |
| 100,000 sessions/mo | $860.00 | $1,440.00 | $2,850.00 | $300.00 | ~$2,700.00 overage | **~$8,150/mo** |

**Key observation:** Claude extract is the dominant API cost at scale (35% of total). Vercel CPU overage becomes significant at 10,000+ sessions/month. Moving to a queue-based architecture (Supabase Edge Functions) would cut Vercel CPU costs by ~90% — Edge Functions at $0.09/GB-hr with 128 MB allocation = $0.000003/call vs $0.003/call in CPU overage.

**Cost per resident/month assumption (1,000 residents, 10 sessions each):** ~$57.50/month total → $0.058/resident/month in API costs. Economically viable but Vercel CPU overage is the cost wild card that needs addressing before scale.

---

## Top 5 Things to Address Before Scale

**Rank 1 — Move pipeline off the synchronous HTTP path (F-01, F-06)**
This is the load ceiling, the cost multiplier, and the reliability blocker simultaneously. `await runPipeline()` inside a Vercel function is an architectural dead-end. Return HTTP 202 immediately; use Supabase's `pg_listen`/Realtime or a Supabase Edge Function triggered by a DB row insert to do the work asynchronously. The client already polls for status — the frontend change is minimal. Estimated effort: 2-3 days. Risk of not doing it: hard wall at ~25 concurrent users.

**Rank 2 — Obtain BAAs and add PHI transfer disclosure (F-02)**
Deepgram and Anthropic are US companies receiving medical audio and transcript text. Operating a PHIPA/PIPEDA-applicable product (medical residents, patient feedback context) without BAAs and user disclosure is a compliance risk that can block institutional procurement contracts. The README's "Canadian data residency" claim is misleading as written. This is a legal/process task, not a code task, but it must happen before any formal institutional pilot launch.

**Rank 3 — Add stuck-session recovery and a "Re-process" button (F-03)**
The current failure mode is a dead end: `processing_failed` is terminal with no UI recovery path. A background job resetting sessions stuck in `processing` for >5 minutes costs one database query on a cron. A "Re-process" button is one line of UI. Without these, every Deepgram incident permanently loses resident recordings.

**Rank 4 — Implement the Storage deletion companion (F-05)**
The audio retention policy is documented but not enforced. `audio_path` is NULLed in Postgres but the actual S3 objects persist. This is a PHI residency violation against the app's own stated 90-day policy. The fix is a Supabase Edge Function calling `supabase.storage.from('recordings').remove([path])` — ~30 lines of code. Without it, PHI accumulates in Storage indefinitely.

**Rank 5 — Add CI with test gate and a staging environment (F-08)**
14 unit tests exist but run only manually. No CI means a broken pipeline ships to production residents. A two-job GitHub Actions workflow (`bun test` + `vercel deploy`) takes under an hour to add and prevents the category of breakage where a model-name typo or schema mismatch silently fails for all users. A Vercel preview environment for PRs costs $0 additional on Pro.

---

## Appendix: Evidence Map

| Finding | Source File | Line(s) |
|---------|-------------|---------|
| F-01: sync pipeline | `app/src/app/api/process/route.ts` | 148 — `await runPipeline(...)` |
| F-01: no queue | `app/src/lib/pipeline/index.ts` | entire file — no deferred dispatch |
| F-02: PHI to Deepgram | `app/src/lib/pipeline/stt.ts` | 19-36 — direct POST to `api.deepgram.com` |
| F-02: PHI to Anthropic | `app/src/lib/pipeline/phi-scrub.ts` | 79-108 — full transcript in prompt |
| F-02: misleading claim | `README.md` | line 32 — "Canadian data residency" |
| F-03: no retry | `app/src/lib/pipeline/stt.ts` | 38-42 — throws on 429, no backoff |
| F-03: no re-trigger | `app/src/app/api/process/route.ts` | 50-55 — 409 on re-process |
| F-04: logs not read | `app/src/app/metrics/page.tsx` | no pipeline_logs query |
| F-04: hardcoded admins | `app/src/app/metrics/page.tsx` | 8-11 — `PILOT_ADMINS` array |
| F-05: storage not deleted | `app/supabase/migrations/002_audio_retention.sql` | 19-27 — comment: "actual Storage file deletion must be done via the Supabase Storage API" |
| F-06: CPU binding | `docs/DEPLOYMENT-OPTIONS.md` | Vercel Pro 16 CPU-hr/mo |
| F-07: single region | `app/vercel.json` — `["yul1"]`; Supabase in `ca-central-1` | |
| F-08: no CI | `.github/` directory — only ISSUE_TEMPLATE, no workflows | |
| F-09: no rollbacks | `app/supabase/migrations/*.sql` — no `-- rollback:` sections | |
| F-10: no concurrency limit | `app/src/app/api/process/route.ts` — no semaphore or queue | |
| F-11: hardcoded model | `app/src/lib/pipeline/phi-scrub.ts:80`, `extract.ts:101` | |
| F-12: shared preceptors | `app/supabase/migrations/003_preceptor_management.sql` | 10-11 — DELETE policy |
| F-13: raw PHI retained | `app/src/lib/pipeline/index.ts` | 105-113 — `transcript_raw` saved; `phi-scrub` failure is non-fatal |
