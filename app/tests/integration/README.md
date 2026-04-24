# Integration tests — PHIPA queryset filtering

These tests verify that **every user-scoped query helper in
`app/src/lib/db/queries.ts` refuses to return another user's data**. They
replace the old Supabase RLS harness — RLS is now enforced in the application
tier, so these integration tests are the only thing standing between a
refactor and a cross-user PHI leak.

## What's covered

One test per helper in `queries.ts`:

| Helper | Assertion |
|--------|-----------|
| `getRecordingSession` | null for non-owner, row for owner |
| `listRecordingSessions` | only caller's rows |
| `getRecordingSessionWithJoins` | null for non-owner |
| `createRecordingSession` | fresh row carries supplied user_id |
| `updateRecordingSessionStatus` | no-op for non-owner |
| `getRecordingBySession` | null for non-owner |
| `createRecording` | throws when session is another user's |
| `clearTranscriptClean` | no-op for non-owner |
| `listAssessmentsForSession` | empty for non-owner |
| `updateAssessment` | null for non-owner |
| `markAssessmentsExported` | no-op for non-owner |
| `listPipelineLogs` | empty for non-owner |
| `getProfile` | returns only caller's profile |
| `upsertProfile` | can't impersonate another user's row |
| `getSessionMetrics` | counts only caller's sessions |
| `listPreceptors` / `getPreceptor` / `listRotations` / `listFormTemplates` / `getFormTemplate` | positive baseline (shared data) |

## Prereqs

1. Local Postgres running (`postgresql://rsingla@localhost:5432/debrief` by
   default — whatever is in `app/.env.local`).
2. Migrations applied: `bun run migrate`.

## Running

```bash
cd app
bun run test:integration
```

Unit tests stay fast and DB-free:

```bash
bun run test   # excludes tests/integration/**
```

## How it stays safe

- Every inserted row is tagged with a shared **UUIDv4 prefix** (`TEST_PREFIX`)
  baked into `users.email`, `preceptors.name`, `form_templates.name`,
  `profiles.full_name`, etc.
- `cleanupTestData()` in `afterAll` deletes rows matching that prefix, in
  FK-safe order. The dev-seeded user (`dev@example.com`) and its demo
  session are never touched.
- After cleanup, the test asserts the non-test `recording_sessions` count is
  unchanged from the snapshot taken in `beforeAll`.

## Manual verification

```bash
psql debrief -c "select count(*) from recording_sessions \
  where user_id not in (select id from users where email like 'dev%');"
```

Should be zero (or whatever demo count you started with) after running the
suite.

## Files

- `queryset-filtering.test.ts` — the test suite.
- `helpers.ts` — seed/cleanup utilities, `.env.local` loader, connection
  verification, schema-feature detection (e.g. optional
  `preceptors.created_by_user_id` from migration 007).
