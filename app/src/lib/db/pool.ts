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
import fs from "node:fs";
import path from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __debrief_pg_pool__: Pool | undefined;
}

function sslConfig(isProd: boolean) {
  if (!isProd) return undefined; // local dev, plain pg
  // Try pinned RDS CA bundle. Path resolution: RDS_CA_BUNDLE_PATH env var,
  // else a vendored `rds-ca-bundle.pem` next to this file (not included yet;
  // ship in next deploy). If neither exists, fall back to connection-level TLS
  // without verification and emit a loud warning.
  const envPath = process.env.RDS_CA_BUNDLE_PATH;
  const vendoredPath = path.resolve(__dirname, "rds-ca-bundle.pem");
  const caPath =
    envPath && fs.existsSync(envPath)
      ? envPath
      : fs.existsSync(vendoredPath)
        ? vendoredPath
        : null;
  if (caPath) {
    return { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  }
  console.warn(
    "[pg.Pool] WARNING: RDS CA bundle not found; falling back to " +
      "rejectUnauthorized:false. Connection is TLS but cert is not validated. " +
      "Set RDS_CA_BUNDLE_PATH or vendor rds-ca-bundle.pem next to pool.ts.",
  );
  return { rejectUnauthorized: false };
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
    ssl: sslConfig(isProd),
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
