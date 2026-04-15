# RLS Policy Integration Tests

Integration tests that verify Supabase Row Level Security (RLS) policies are correctly enforced for all tables in the Debrief schema.

## What is tested

Every policy across all RLS-enabled tables:

| Table | Policies tested |
|-------|----------------|
| `sessions` | Users see/create/update own rows; cannot read/update/delete other users' rows |
| `recordings` | Users see/create/update own rows (via session ownership); cross-user isolation |
| `assessments` | Users see/create/update own rows (via session ownership); cross-user isolation |
| `pipeline_logs` | Users see/create own logs (via session ownership); cross-user isolation |
| `preceptors` | Authenticated users have full CRUD (shared resource); anon blocked |
| `profiles` | Users see/insert/update own profile only; cannot impersonate others |
| Anonymous | Zero access to all tables |
| Service role | Full access to all tables (harness sanity check) |

## Prerequisites

### 1. Install Supabase CLI

```bash
brew install supabase/tap/supabase
```

### 2. Start the local Supabase stack

From the `app/` directory:

```bash
cd app
supabase start
```

This starts a local Postgres instance with GoTrue auth at `http://127.0.0.1:54321`.
The first run downloads Docker images; subsequent starts are fast.

### 3. Apply migrations

Migrations are applied automatically on `supabase start`. If you need to re-apply:

```bash
supabase db reset
```

### 4. Get the local keys

```bash
supabase status
```

Example output:
```
API URL: http://127.0.0.1:54321
anon key: eyJhbGciOi...
service_role key: eyJhbGciOi...
```

### 5. Set environment variables

```bash
export SUPABASE_TEST_URL=http://127.0.0.1:54321
export SUPABASE_TEST_ANON_KEY=<anon key from supabase status>
export SUPABASE_TEST_SERVICE_KEY=<service_role key from supabase status>
```

Or add them to a `.env.test.local` file (not committed):

```env
SUPABASE_TEST_URL=http://127.0.0.1:54321
SUPABASE_TEST_ANON_KEY=eyJhbGciOi...
SUPABASE_TEST_SERVICE_KEY=eyJhbGciOi...
```

## Running the tests

```bash
cd app

# Run all tests (unit + integration if env set)
bun run test

# Run only integration tests
bun run test tests/integration/rls.test.ts

# Run with env vars inline
SUPABASE_TEST_URL=http://127.0.0.1:54321 \
SUPABASE_TEST_ANON_KEY=<anon> \
SUPABASE_TEST_SERVICE_KEY=<service> \
bun run test tests/integration/rls.test.ts
```

## Skip behavior

When `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, and `SUPABASE_TEST_SERVICE_KEY` are **not** set, all integration test suites call `describe.skip(...)` and the test run exits cleanly. Existing unit tests are unaffected.

## Stopping the local stack

```bash
supabase stop
```

## Notes

- Tests create isolated users (user A, user B) and seed rows at test start, then clean up in `afterAll`.
- Each user's JWT is obtained by signing in with the seeded credentials — the same flow a real client uses.
- The service-role client is used only for seeding/cleanup and the sanity-check describe block.
- No production or staging data is touched; all operations target the local Docker stack.
