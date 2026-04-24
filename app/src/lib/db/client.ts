/**
 * Postgres client (Porsager's `postgres` package) — matches the Lambda's
 * DB client for a single SQL dialect across the codebase.
 *
 * Lazy-initialized: we don't touch DATABASE_URL until a query is actually
 * executed, so `next build` page-data collection doesn't fail when env
 * vars aren't populated at build time.
 */

import postgres, { type Sql } from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __debrief_sql__: Sql | undefined;
}

function getClient(): Sql {
  if (globalThis.__debrief_sql__) return globalThis.__debrief_sql__;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.local.example to .env.local and set it.",
    );
  }
  const isProd = process.env.NODE_ENV === "production";
  globalThis.__debrief_sql__ = postgres(url, {
    ssl: isProd ? "require" : "prefer",
  });
  return globalThis.__debrief_sql__;
}

// `sql` is a function (tagged-template literal). We wrap it in a Proxy around
// a function target so the `apply` trap fires for `sql\`...\`` calls, and the
// `get` trap fires for member access like `sql.json(...)`.
const target = function () {
  /* placeholder — never invoked directly */
} as unknown as Sql;

export const sql: Sql = new Proxy(target, {
  apply(_t, _thisArg, argArray) {
    const client = getClient() as unknown as (...args: unknown[]) => unknown;
    return client(...argArray);
  },
  get(_t, prop) {
    const client = getClient() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
}) as unknown as Sql;

/** Test hook — inject a fake sql client. */
export function _setSqlClientForTests(client: Sql | null): void {
  if (client === null) {
    delete globalThis.__debrief_sql__;
  } else {
    globalThis.__debrief_sql__ = client;
  }
}
