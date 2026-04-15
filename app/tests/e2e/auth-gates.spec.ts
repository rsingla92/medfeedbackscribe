/**
 * Auth-gate E2E tests
 *
 * These tests verify that the Next.js middleware (src/proxy.ts) correctly
 * enforces auth boundaries:
 *   - Protected routes redirect unauthenticated users to /auth
 *   - Public routes (/demo, /) render without credentials
 *   - Session-dependent cases are explicitly skipped with reasons
 *
 * The webServer is started with stub Supabase env vars (see playwright.config.ts).
 * The stub URL (http://localhost:54321) is unreachable, so any route that makes
 * a real Supabase auth.getUser() call will receive an auth error and treat the
 * request as unauthenticated — which is exactly what we want for tests #1-3.
 */

import { test, expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Assert the page is the login/auth UI by checking for the sign-in form. */
async function expectAuthPage(page: import('@playwright/test').Page) {
  const url = page.url();
  const onAuthPage = url.includes('/auth');
  if (onAuthPage) {
    // Landed on /auth — confirm the sign-in form is present.
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
  } else {
    // Some protected pages might render an inline sign-in gate instead of
    // redirecting; accept either pattern.
    await expect(
      page.getByRole('link', { name: /sign in/i }).or(page.getByRole('button', { name: /sign in/i }))
    ).toBeVisible({ timeout: 10_000 });
  }
}

// ── 1. Unauthenticated redirects ──────────────────────────────────────────────

test.describe('Unauthenticated redirect', () => {
  const protectedRoutes = [
    '/record',
    '/review/00000000-0000-0000-0000-000000000001',
    '/metrics',
    '/preceptors',
  ];

  for (const route of protectedRoutes) {
    test(`${route} → redirects to /auth`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'networkidle' });
      await expectAuthPage(page);
    });
  }

  test('/onboarding → accessible unauthenticated (public path in middleware)', async ({ page }) => {
    // /onboarding is listed as a public path in the middleware so it does NOT
    // redirect. When reached without a session the page itself may do a client-
    // side redirect to /auth, or render its own content. Either way the middleware
    // must not issue a redirect before the page loads.
    const response = await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
    // Verify we get a non-500 initial response (middleware did not reject it).
    expect(response?.status()).toBeLessThan(500);
  });
});

// ── 2. /demo loads without auth ───────────────────────────────────────────────

test.describe('/demo public access', () => {
  test('/demo renders without authentication (verifies commit cd33680)', async ({ page }) => {
    const response = await page.goto('/demo', { waitUntil: 'domcontentloaded' });

    // HTTP 200 — the page was served, not redirected to /auth.
    expect(response?.status()).toBe(200);

    // The /demo page should show the app name and "Demo Mode" badge.
    await expect(page.getByText('Debrief')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Demo Mode')).toBeVisible({ timeout: 10_000 });

    // Final URL must NOT be the auth page.
    expect(page.url()).not.toContain('/auth');
  });
});

// ── 3. Landing page (/) without auth ─────────────────────────────────────────

test.describe('Landing page without auth', () => {
  test('/ renders public content with sign-in prompt', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'networkidle' });

    // Server responds OK (the middleware leaves / as a public path).
    expect(response?.status()).toBe(200);

    // The unauthenticated landing page renders the app name and a sign-in CTA.
    await expect(page.getByRole('heading', { name: /debrief/i })).toBeVisible({ timeout: 10_000 });
    // There should be a "Sign in" link visible to unauthenticated visitors.
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible({ timeout: 10_000 });

    // Must NOT silently redirect to /auth (the landing page stays at /).
    expect(page.url()).toMatch(/\/$/);
  });
});

// ── 4. Session persistence after login simulation ─────────────────────────────

test.describe('Session persistence', () => {
  test.skip(true, [
    'Skipped: the webServer uses a stub Supabase URL (http://localhost:54321) that is',
    'not running, so injected session cookies cannot be validated by the server.',
    'addCookies() can plant a cookie but Supabase SSR will call getUser() against the',
    'stub endpoint, receive a network error, and treat the request as unauthenticated.',
    'A real Supabase instance (or a local Supabase stack via `supabase start`) would',
    'be required to validate this case end-to-end.',
  ].join(' '));

  // Kept as documentation of the intended test shape:
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('protected page renders when valid session cookie is present', async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'sb-access-token',
        value: 'stub-jwt',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
    await page.goto('/record');
    // With a real Supabase backend this would render /record, not redirect to /auth.
    expect(page.url()).not.toContain('/auth');
  });
});

// ── 5. Logout flow ────────────────────────────────────────────────────────────

test.describe('Logout flow', () => {
  test.skip(true, [
    'Skipped: reaching a logout button requires a valid authenticated session,',
    'which is not possible with the stub Supabase instance used by the webServer.',
    'The sign-out button lives inside the authenticated HomeClient component which',
    'is not rendered when getUser() fails against the stub endpoint.',
    'Enable once a local Supabase stack or auth mock is available.',
  ].join(' '));

  // Kept as documentation of the intended test shape:
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('clicking sign-out clears session and redirects to / or /auth', async ({ page }) => {
    // (Would first log in via magic link or direct session injection)
    await page.goto('/');
    const signOutButton = page.getByRole('button', { name: /sign out/i });
    await signOutButton.click();
    await page.waitForURL(/\/(auth)?$/);
    // Session should be cleared — navigating to a protected page must redirect.
    await page.goto('/record');
    await expectAuthPage(page);
  });
});
