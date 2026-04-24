import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Integration test config.
 *
 * Runs against the real local Postgres (DATABASE_URL from .env.local).
 * Uses node environment (no jsdom), disables parallelism so the shared
 * seed fixtures don't race, and exercises ONLY tests/integration/**.
 *
 * Run with: `bun run test:integration`
 *
 * NOTE: the `test` block is cast through `unknown` because Vitest 4's
 * `InlineConfig` type surface is narrower than what `defineConfig` accepts
 * at runtime. The underlying runtime still honours `poolOptions.forks`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const testConfig: any = {
  environment: 'node',
  include: ['tests/integration/**/*.test.ts'],
  exclude: ['tests/unit/**', 'tests/e2e/**', 'node_modules/**'],
  // One worker so the shared seeded users/sessions aren't racing.
  fileParallelism: false,
  pool: 'forks',
  poolOptions: {
    forks: {
      singleFork: true,
    },
  },
  // Longer default — DB round-trips can be slow on first connect.
  testTimeout: 30_000,
  hookTimeout: 30_000,
}

export default defineConfig({
  test: testConfig,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
