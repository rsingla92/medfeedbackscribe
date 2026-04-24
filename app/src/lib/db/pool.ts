/**
 * node-postgres Pool — used ONLY by the Auth.js `@auth/pg-adapter`.
 * App-side queries should use `sql` from ./client.ts (postgres.js) so we
 * have a single SQL dialect throughout. This Pool exists because
 * @auth/pg-adapter explicitly requires a `pg` Pool.
 *
 * Lazy-initialized for the same reason as client.ts: `next build` must be
 * able to import this module without DATABASE_URL being set.
 */

import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __debrief_pg_pool__: Pool | undefined;
}

function build(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.local.example to .env.local and set it.",
    );
  }
  const isProd = process.env.NODE_ENV === "production";
  return new Pool({
    connectionString,
    ssl: isProd ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });
}

// Wrap in a Proxy so methods like `pool.query(...)` or `pool.connect(...)`
// lazy-init on first call.
const target = {} as Pool;

export const pool: Pool = new Proxy(target, {
  get(_t, prop) {
    if (!globalThis.__debrief_pg_pool__) {
      globalThis.__debrief_pg_pool__ = build();
    }
    const p = globalThis.__debrief_pg_pool__ as unknown as Record<
      string | symbol,
      unknown
    >;
    const value = p[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(p)
      : value;
  },
}) as Pool;
