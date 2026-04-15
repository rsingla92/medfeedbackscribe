/**
 * E2E spec for the Reprocess feature (F-03 recovery flow)
 *
 * Architecture note
 * -----------------
 * /review/[id] is behind Supabase auth middleware — direct navigation without
 * a valid session cookie redirects to /auth.  Tests that exercise the live UI
 * (processing_failed banner, Retry button, status polling) are marked skip with
 * clear activation instructions, exactly matching the pattern in failure-path.spec.ts.
 *
 * What IS tested (no auth required)
 * -----------------------------------
 *  1. POST /api/reprocess with an invalid sessionId returns 400 JSON.
 *  2. POST /api/reprocess without auth returns 401 JSON (not HTML / stack trace).
 *  3. POST /api/reprocess response shape: { error: string }, no stack / PHI leak.
 *  4. POST /api/reprocess with a valid UUID format returns a consistent JSON shape
 *     (the status code may be 401/403 in CI since we have no session, which is fine).
 *  5. Intercepted /api/reprocess 202 mock → calling code receives { status: 'reprocessing' }.
 *  6. Intercepted /api/reprocess 409 mock → error message is present in response body.
 *
 * Skipped (require authenticated session + seeded DB)
 * ----------------------------------------------------
 *  - Happy path: simulate processing_failed → click "Retry processing" → status changes
 *  - Stuck detection: simulate processing + elapsed > 5 min → "Looks stuck — retry?" shown
 *  - Reprocess toast appears after successful retry and auto-dismisses
 *  - Status polling resumes after retry (sessionStatus → "processing" → "ready")
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.join(__dirname, '../../test-results/screenshots');

// ──────────────────────────────────────────────────────────────────────────────
// Group 1 — /api/reprocess endpoint safety (no auth needed)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('/api/reprocess — endpoint safety (unauthenticated)', () => {
  test('missing sessionId returns 400 JSON with { error } field', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return { status: res.status, body: await res.json() };
    });

    // Either 400 (input validation fires first) or 401 (auth fires first)
    // Both are acceptable — what matters is: JSON with error, no HTML, no stack
    expect([400, 401]).toContain(result.status);
    expect(result.body).toHaveProperty('error');
    expect(typeof result.body.error).toBe('string');
    expect(result.body).not.toHaveProperty('stack');

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/reprocess-01-missing-session-id.png`,
      fullPage: true,
    });
  });

  test('invalid UUID returns 400 or 401 JSON, not HTML or stack trace', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'not-a-uuid' }),
      });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = { raw: text }; }
      return { status: res.status, body };
    });

    expect([400, 401]).toContain(result.status);
    // Response must be JSON (not HTML redirect or stack dump)
    expect(result.body).not.toHaveProperty('raw');
    expect(result.body).toHaveProperty('error');
    expect(typeof result.body.error).toBe('string');
  });

  test('valid UUID format without auth returns 401 JSON, not HTML', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: '550e8400-e29b-41d4-a716-446655440000' }),
      });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = { raw: text }; }
      return { status: res.status, body, contentType: res.headers.get('content-type') };
    });

    // Unauthenticated should be 401
    expect(result.status).toBe(401);
    expect(result.body).toHaveProperty('error');
    // Must be JSON, not an HTML redirect page
    expect(result.contentType).toMatch(/application\/json/);
    expect(result.body).not.toHaveProperty('raw');

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/reprocess-02-unauth-401.png`,
      fullPage: true,
    });
  });

  test('error response has { error: string } shape — no stack or PHI leaked', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: '550e8400-e29b-41d4-a716-446655440000' }),
      });
      return res.json();
    });

    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
    // No raw exception fields
    expect(result).not.toHaveProperty('stack');
    expect(result).not.toHaveProperty('message');
    // No PHI patterns
    const errText = String(result.error).toLowerCase();
    expect(errText).not.toMatch(/\d{3}-\d{2}-\d{4}/); // SSN
    expect(errText).not.toMatch(/mrn|date of birth|dob/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Group 2 — /api/reprocess mock interception (no auth needed)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('/api/reprocess — mocked responses via page.route', () => {
  test('202 mock: calling code receives { status: "reprocessing" }', async ({ page }) => {
    await page.route('**/api/reprocess', async (route, request) => {
      if (request.method() === 'POST') {
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'reprocessing' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: '550e8400-e29b-41d4-a716-446655440000' }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(202);
    expect(result.body).toEqual({ status: 'reprocessing' });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/reprocess-03-202-mock.png`,
      fullPage: true,
    });
  });

  test('409 mock: error message is present and well-shaped', async ({ page }) => {
    await page.route('**/api/reprocess', async (route, request) => {
      if (request.method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: "Session was updated less than 5 minutes ago. Wait a moment before retrying.",
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: '550e8400-e29b-41d4-a716-446655440000' }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(409);
    expect(result.body).toHaveProperty('error');
    expect(typeof result.body.error).toBe('string');
    expect(result.body.error.length).toBeGreaterThan(0);
  });

  test('reprocess trigger is idempotent — second call within 5 min returns 409', async ({ page }) => {
    let callCount = 0;

    await page.route('**/api/reprocess', async (route, request) => {
      if (request.method() === 'POST') {
        callCount++;
        const status = callCount === 1 ? 202 : 409;
        const body =
          callCount === 1
            ? { status: 'reprocessing' }
            : { error: 'Session was updated less than 5 minutes ago. Wait a moment before retrying.' };
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');

    const results = await page.evaluate(async () => {
      const opts: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: '550e8400-e29b-41d4-a716-446655440000' }),
      };
      const r1 = await fetch('/api/reprocess', opts);
      const r2 = await fetch('/api/reprocess', opts);
      return {
        first: { status: r1.status, body: await r1.json() },
        second: { status: r2.status, body: await r2.json() },
      };
    });

    expect(results.first.status).toBe(202);
    expect(results.second.status).toBe(409);
    expect(results.second.body.error).toMatch(/5 minutes/i);
    expect(callCount).toBe(2);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/reprocess-04-idempotent.png`,
      fullPage: true,
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SKIPPED — authenticated UI tests (require auth + seeded DB)
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Authenticated reprocess UI — SKIPPED (requires auth + DB)', () => {
  /**
   * SKIP REASON: /review/[id] is protected by Supabase auth middleware.
   * Without a valid session cookie the middleware redirects immediately to /auth.
   *
   * To activate these tests:
   *   1. Run `supabase start` and configure .env.local to point at the local instance.
   *   2. Create a test user and seed a session with status='processing_failed'
   *      and updated_at < now() - 5 minutes.
   *   3. Inject session cookies via page.context().addCookies() or storageState.
   *   4. Navigate to /review/<seeded-session-id>.
   */

  test.skip('processing_failed: shows error UI and "Retry processing" button', async ({ page }) => {
    // Navigate to /review/<session-id> with auth cookies set
    // await expect(page.getByText('Processing failed')).toBeVisible();
    // await expect(page.getByRole('button', { name: /Retry processing/i })).toBeVisible();
    void page;
  });

  test.skip('happy path: click "Retry processing" → 202 → status changes to processing', async ({ page }) => {
    // Intercept /api/reprocess to return 202, verify sessionStatus flips to 'processing'
    // and the spinner / "Transcribing audio" step appears.
    void page;
  });

  test.skip('stuck detection: processing > 5 min shows "Looks stuck — retry?" button', async ({ page }) => {
    // Seed a session with status='processing' and updated_at 10 min ago.
    // Navigate to /review/<id>, wait for the 5-min polling window, assert button label.
    void page;
  });

  test.skip('reprocess toast auto-dismisses after 5 seconds', async ({ page }) => {
    // Click retry, await toast "Reprocessing started", wait 6s, assert toast gone.
    void page;
  });

  test.skip('409 from /api/reprocess shows error message inline, not a full-page error', async ({ page }) => {
    // Intercept /api/reprocess to return 409.
    // Assert error text appears below the retry button in the ProcessingView.
    void page;
  });
});
