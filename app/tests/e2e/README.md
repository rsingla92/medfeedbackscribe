# E2E Tests

Playwright-based end-to-end tests for the Debrief app.

## Running locally

```bash
cd app
bun run test:e2e          # headless, list reporter
bun run test:e2e:ui       # opens Playwright UI
```

The `webServer` config in `playwright.config.ts` will automatically start `bun run dev`
on port 3000 if it is not already running (`reuseExistingServer: true` outside CI).

## What is mocked vs real

| Concern | Local / Demo flow | Notes |
|---|---|---|
| Auth | **None** — uses `/demo` route | `/demo` loads without Supabase session |
| MediaDevices | **Stubbed** via `addInitScript` | Injects a silent fake `MediaStream` so `getUserMedia` succeeds without a real mic |
| Audio pipeline | **Skipped** — demo uses mock data | `MOCK_ASSESSMENT` in `demo/page.tsx` drives the review step |
| Supabase DB | **Not used** in demo flow | No network calls to Supabase during demo |
| LLM / STT APIs | **Not used** in demo flow | Demo transitions through a simulated processing animation |

## Test files

| File | What it covers |
|---|---|
| `happy-path.spec.ts` | Full demo flow: rotation → preceptor → consent → recording → processing → review → export buttons visible |

## Next steps (future PRs)

- **Failure-path tests** (`failure-path.spec.ts`): mic denied, network error during upload, malformed LLM response
- **Auth-gates tests** (`auth-gates.spec.ts`): unauthenticated access redirects; magic-link login using Supabase service-role test user provisioning
- **Mobile viewport tests**: Verify PWA layout on 390px viewport
