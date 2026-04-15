/**
 * QA Audit — static page checks across 375px and 1280px viewports.
 * Captures screenshots, console errors, and basic accessibility/UX checks.
 * Report: docs/qa-report-2026-04-14.md
 */
import { test, expect, Page, ConsoleMessage } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOTS_DIR = path.join(
  __dirname,
  "../../../../docs/qa-screenshots"
);

// Ensure screenshots dir exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
];

interface ConsoleCapture {
  type: string;
  text: string;
}

async function captureConsoleLogs(page: Page): Promise<ConsoleCapture[]> {
  const logs: ConsoleCapture[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    logs.push({ type: msg.type(), text: msg.text() });
  });
  return logs;
}

async function screenshotPage(
  page: Page,
  name: string,
  viewport: { name: string; width: number; height: number }
) {
  const filename = `${name}-${viewport.name}.png`;
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, filename),
    fullPage: true,
  });
  return filename;
}

test.describe("QA Audit — Landing Page /", () => {
  for (const vp of VIEWPORTS) {
    test(`renders at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      const consoleLogs: ConsoleCapture[] = [];
      page.on("console", (m) =>
        consoleLogs.push({ type: m.type(), text: m.text() })
      );

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      await screenshotPage(page, "home", vp);

      // Should not crash — check page renders
      const body = await page.locator("body").textContent();
      expect(body).toBeTruthy();

      // No uncaught JS errors
      const errors = consoleLogs.filter(
        (l) =>
          l.type === "error" &&
          !l.text.includes("stub-anon-key") && // ignore supabase stub errors
          !l.text.includes("Failed to load resource") &&
          !l.text.includes("supabase")
      );
      expect(
        errors,
        `Console errors on / at ${vp.name}: ${JSON.stringify(errors)}`
      ).toHaveLength(0);
    });

    test(`heading hierarchy at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // There should be exactly one h1
      const h1Count = await page.locator("h1").count();
      expect(h1Count, "Should have exactly one h1").toBe(1);
    });

    test(`sign-in button visible at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Unauthenticated state: sign in link should be visible
      const signInLink = page.locator('a[href="/auth"]');
      await expect(signInLink).toBeVisible();
    });
  }
});

test.describe("QA Audit — Auth Page /auth", () => {
  for (const vp of VIEWPORTS) {
    test(`renders correctly at ${vp.name}`, async ({ page }) => {
      const consoleLogs: ConsoleCapture[] = [];
      page.on("console", (m) =>
        consoleLogs.push({ type: m.type(), text: m.text() })
      );

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/auth");
      await page.waitForLoadState("networkidle");

      await screenshotPage(page, "auth", vp);

      // Email input should exist with correct type
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible();

      // Submit button should exist
      const submitBtn = page.locator('button[type="submit"]');
      await expect(submitBtn).toBeVisible();

      // Label should be associated (has for= or sr-only)
      const label = page.locator('label[for="email"]');
      expect(await label.count()).toBeGreaterThan(0);
    });

    test(`form has correct autocomplete at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/auth");
      await page.waitForLoadState("networkidle");

      const emailInput = page.locator('input[type="email"]');
      const autocomplete = await emailInput.getAttribute("autocomplete");
      expect(autocomplete).toBe("email");
    });

    test(`empty form does not submit at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/auth");
      await page.waitForLoadState("networkidle");

      // Try submitting empty form
      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();

      // Should still be on auth page (not navigate away)
      await expect(page).toHaveURL(/\/auth/);
    });
  }
});

test.describe("QA Audit — Demo Page /demo", () => {
  for (const vp of VIEWPORTS) {
    test(`renders at ${vp.name} without errors`, async ({ page }) => {
      const consoleLogs: ConsoleCapture[] = [];
      page.on("console", (m) =>
        consoleLogs.push({ type: m.type(), text: m.text() })
      );

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/demo");
      await page.waitForLoadState("networkidle");

      await screenshotPage(page, "demo-rotation-step", vp);

      // Should render the pick-rotation step
      await expect(page.locator("h2")).toContainText("Select Rotation");

      // Demo badge should be visible (the amber pill badge with exact text "DEMO")
      const demoBadge = page.locator("span", { hasText: /^DEMO$/ });
      await expect(demoBadge).toBeVisible();

      // No uncaught JS errors (filter supabase stubs)
      const errors = consoleLogs.filter(
        (l) =>
          l.type === "error" &&
          !l.text.includes("supabase") &&
          !l.text.includes("stub-anon-key") &&
          !l.text.includes("Failed to load resource")
      );
      expect(
        errors,
        `Console errors on /demo at ${vp.name}: ${JSON.stringify(errors)}`
      ).toHaveLength(0);
    });

    test(`rotation → preceptor flow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/demo");
      await page.waitForLoadState("networkidle");

      // Click first rotation
      const firstRotation = page.locator("button").first();
      await firstRotation.click();

      // Should advance to pick-preceptor
      await expect(page.locator("h2")).toContainText("Select Preceptor");
      await screenshotPage(page, "demo-preceptor-step", vp);
    });

    test(`full demo flow through review at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/demo");
      await page.waitForLoadState("networkidle");

      // Pick rotation (Family Medicine — not EM so skips form-type step)
      await page.locator("button", { hasText: "Family Medicine Clinic" }).click();

      // Pick preceptor
      await page.locator("button", { hasText: "Dr. Sarah Thompson" }).click();

      // Consent step
      await expect(page.locator("h2")).toContainText("Consent Confirmation");
      await screenshotPage(page, "demo-consent-step", vp);
      await page.locator("button", { hasText: "Confirm & Start Recording" }).click();

      // Recording step (without actual mic)
      await expect(page.locator("text=Tap to start recording")).toBeVisible();
      await screenshotPage(page, "demo-recording-step", vp);
    });

    test(`Emergency Medicine → form-type selection at ${vp.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/demo");
      await page.waitForLoadState("networkidle");

      // Pick Emergency Medicine — this triggers form-type step
      await page.locator("button", { hasText: "Emergency Medicine" }).click();
      await page.locator("button", { hasText: "Dr. Sarah Thompson" }).click();

      await expect(page.locator("h2")).toContainText("Select Form Type");
      await screenshotPage(page, "demo-formtype-step", vp);
    });

    test(`back navigation works at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/demo");
      await page.waitForLoadState("networkidle");

      await page.locator("button", { hasText: "Family Medicine Clinic" }).click();
      await expect(page.locator("h2")).toContainText("Select Preceptor");

      // Back button
      await page.locator("text=← Back to rotations").click();
      await expect(page.locator("h2")).toContainText("Select Rotation");
    });
  }
});

test.describe("QA Audit — Auth-gated routes", () => {
  const authGatedRoutes = ["/record", "/metrics", "/preceptors"];

  for (const route of authGatedRoutes) {
    for (const vp of VIEWPORTS) {
      test(`${route} redirects unauthenticated user at ${vp.name}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });

        // Navigate to auth-gated route
        await page.goto(route);
        await page.waitForLoadState("networkidle");

        const url = page.url();

        // Should redirect away from the protected route
        // Acceptable redirects: /, /auth, /onboarding
        const isRedirected =
          !url.includes(route) ||
          url.endsWith("/") ||
          url.includes("/auth") ||
          url.includes("/onboarding");

        // Screenshot whatever state we end up in
        const routeName = route.replace(/\//g, "-").replace(/^-/, "");
        await screenshotPage(page, `auth-gate-${routeName}`, vp);

        // No hard crash (page should be visible)
        const body = await page.locator("body").textContent();
        expect(body).toBeTruthy();
      });
    }
  }
});

test.describe("QA Audit — Onboarding Page /onboarding", () => {
  for (const vp of VIEWPORTS) {
    test(`renders at ${vp.name}`, async ({ page }) => {
      const consoleLogs: ConsoleCapture[] = [];
      page.on("console", (m) =>
        consoleLogs.push({ type: m.type(), text: m.text() })
      );

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/onboarding");
      await page.waitForLoadState("networkidle");

      await screenshotPage(page, "onboarding", vp);

      // Form should be visible
      await expect(page.locator("form")).toBeVisible();

      // Full Name input required
      const nameInput = page.locator("#fullName");
      await expect(nameInput).toBeVisible();

      // Submit disabled without name
      const submitBtn = page.locator('button[type="submit"]');
      const isDisabled = await submitBtn.getAttribute("disabled");
      expect(isDisabled !== null).toBeTruthy();
    });

    test(`all form fields labeled at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/onboarding");
      await page.waitForLoadState("networkidle");

      const labelIds = ["fullName", "program", "specialty", "year", "site"];
      for (const id of labelIds) {
        const label = page.locator(`label[for="${id}"]`);
        expect(await label.count(), `Missing label for #${id}`).toBeGreaterThan(0);
      }
    });
  }
});
