# debrief-pipeline-worker (Lambda)

SQS-triggered worker that runs Debrief's async processing pipeline:

```
S3 PutObject ─▶ SQS ─▶ Lambda ─▶ STT ─▶ PHI scrub ─▶ extract ─▶ Postgres ─▶ SES
                         │                                            │
                         └───────── pipeline_logs row per step ───────┘
```

All PHI processing stays on Canadian infrastructure:
- Audio + transcripts: S3 (`ca-central-1`), KMS-encrypted.
- STT / PHI scrub / extraction: Vertex AI Gemini 2.5 Flash in `northamerica-northeast1` (Montreal).
- Database: RDS Postgres in `ca-central-1`.
- Email: SES v2 in `ca-central-1`.

## Build

```bash
cd infra/lambda/pipeline
npm install
npm run build           # bundles handler.ts → dist/index.js via esbuild
npm run typecheck       # optional — strict tsc check
```

The CDK packages `dist/index.js` automatically via `NodejsFunction` (see
`infra/lib/compute-stack.ts`).

## Test

```bash
npm test                # vitest run
npm run test:watch      # watch mode
```

Port-mates of the Next.js app tests live in `__tests__/`:
- `phi-scrub.test.ts` — verbatim copy from `app/tests/unit/phi-scrub.test.ts`
- `gemini.test.ts` — Vertex AI mocked, same assertions
- `extract.test.ts` — pure prompt-builder tests
- `pipeline.test.ts` — orchestrator with db/gemini/email mocks
- `handler.test.ts` — SQS event triggers `runPipeline` with correct `sessionId`

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | dev only | Full postgres URL. Overrides `DB_SECRET_ARN`. |
| `DB_SECRET_ARN` | Lambda | Secrets Manager ARN for RDS creds (JSON: `{username, password, host, port, dbname}`). |
| `RDS_SECRET_ARN` | Lambda | Alias accepted — the CDK passes this today. |
| `RDS_ENDPOINT` | Lambda | RDS hostname (used if the secret omits `host`). |
| `DB_NAME` | Lambda | Database name (default `debrief`). |
| `GCP_PROJECT_ID` | yes | Vertex AI project. |
| `GCP_SA_SECRET_ARN` | Lambda | Secrets Manager ARN holding the GCP service-account JSON. Cold-start code writes it to `/tmp/gcp-sa.json` and exports `GOOGLE_APPLICATION_CREDENTIALS`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | dev only | Path to a service-account JSON file. |
| `S3_RECORDINGS_BUCKET` | - | Not read directly — the bucket comes from the S3 event. |
| `SES_FROM_EMAIL` | no | Defaults to `Debrief <noreply@debrief.whitecoatprep.com>`. |
| `SES_APP_URL` | no | Base URL for "open Debrief" links (default `https://debrief.whitecoatprep.com`). |
| `PROGRAM_ADMIN_EMAIL` | no | If set, BCC-equivalent notification to this address. |
| `AWS_REGION` / `AWS_REGION_DEBRIEF` | - | SES/S3 client region; defaults to `ca-central-1`. |

## Local testing

Invoke with a sample SQS event:

```bash
# Build first
npm run build

# Minimal sample SQS→S3 event
cat > /tmp/event.json <<'JSON'
{
  "Records": [
    {
      "messageId": "local-1",
      "receiptHandle": "r1",
      "body": "{\"Records\":[{\"s3\":{\"bucket\":{\"name\":\"debrief-recordings-000000000000-ca-central-1\"},\"object\":{\"key\":\"00000000-0000-0000-0000-000000000001/session-abc.webm\"}}}]}",
      "attributes": {},
      "messageAttributes": {},
      "md5OfBody": "",
      "eventSource": "aws:sqs",
      "eventSourceARN": "arn:aws:sqs:ca-central-1:000000000000:debrief-pipeline-queue",
      "awsRegion": "ca-central-1"
    }
  ]
}
JSON

# Run against a local postgres + real Vertex AI:
DATABASE_URL=postgres://postgres:postgres@localhost:5432/debrief \
GOOGLE_APPLICATION_CREDENTIALS=$HOME/.config/gcp/debrief-sa.json \
GCP_PROJECT_ID=debrief-prod \
node -e "require('./dist/index.js').handler(require('/tmp/event.json'))"
```

For unit tests, none of the above env vars are required — Vertex AI, SES, and
the Postgres client are all mocked.

## Deployment

Handled by `infra/lib/compute-stack.ts` via the `NodejsFunction` construct —
it runs `npm run build` behind the scenes (esbuild) and uploads `dist/`.
Do **not** check in `node_modules/` or `dist/`.

## File layout

```
infra/lambda/pipeline/
├── handler.ts             Lambda entrypoint (SQS → runPipeline)
├── pipeline.ts            Orchestrator
├── gemini.ts              Vertex AI wrapper (STT + PHI scrub + extract)
├── phi-scrub.ts           Regex PHI scrubber (26 pattern groups)
├── extract.ts             Extraction prompt helper
├── email.ts               SES v2 transactional email
├── db.ts                  Postgres client + typed query helpers
├── types.ts               Shared types
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── __tests__/
    ├── phi-scrub.test.ts
    ├── gemini.test.ts
    ├── extract.test.ts
    ├── pipeline.test.ts
    └── handler.test.ts
```
