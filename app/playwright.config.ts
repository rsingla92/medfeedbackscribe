import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT ? parseInt(process.env.E2E_PORT, 10) : 3099;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/e2e/**/*.spec.ts', '**/qa-audit/**/*.spec.ts'],
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `bun run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Provide stub Supabase credentials so the middleware client can be
      // instantiated without crashing. The /demo route is public and makes no
      // real Supabase calls, so these values only need to be non-empty strings.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'stub-anon-key-for-e2e',
    },
  },
});
