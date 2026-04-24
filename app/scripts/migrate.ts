#!/usr/bin/env bun
/**
 * Tiny SQL migration runner for Debrief.
 *
 * Reads every *.sql file in src/lib/db/migrations (sorted lexicographically),
 * tracks applied migrations in a _migrations table, skips any already-applied
 * ones, and refuses to run if a previously-applied file's hash has drifted
 * (to prevent silent rewrites of production history).
 *
 * Invocation:
 *   bun run migrate
 *
 * Environment:
 *   DATABASE_URL (required) — postgres connection string
 *
 * Notes:
 *   - Each .sql file runs inside its own transaction.
 *   - CREATE EXTENSION requires superuser; these will work against local
 *     postgres or RDS with rds_superuser, but will fail on locked-down DBs.
 *   - Hashes are SHA-256 of the raw file contents.
 */

import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __scriptDir = dirname(__filename);

const MIGRATIONS_DIR = resolve(
  __scriptDir,
  "..",
  "src",
  "lib",
  "db",
  "migrations",
);

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const sql = postgres(url, {
    ssl: process.env.NODE_ENV === "production" ? "require" : "prefer",
    // Short idle timeout so the script exits promptly.
    idle_timeout: 5,
    max: 1,
  });

  try {
    // Ensure tracking table exists.
    await sql`
      create table if not exists _migrations (
        filename text primary key,
        hash text not null,
        applied_at timestamptz not null default now()
      )
    `;

    const entries = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (entries.length === 0) {
      console.log("No migrations found.");
      return;
    }

    const applied = await sql<{ filename: string; hash: string }[]>`
      select filename, hash from _migrations
    `;
    const appliedMap = new Map(applied.map((r) => [r.filename, r.hash]));

    let ranCount = 0;
    for (const filename of entries) {
      const path = join(MIGRATIONS_DIR, filename);
      const contents = await readFile(path, "utf8");
      const hash = createHash("sha256").update(contents).digest("hex");

      const existing = appliedMap.get(filename);
      if (existing) {
        if (existing !== hash) {
          console.error(
            `DRIFT: ${filename} has been modified after it was applied.\n` +
              `  expected hash ${existing.slice(0, 12)}…\n` +
              `  actual hash   ${hash.slice(0, 12)}…\n` +
              `Create a new migration file instead of editing this one.`
          );
          process.exit(2);
        }
        continue;
      }

      console.log(`Running ${filename}…`);
      await sql.begin(async (tx) => {
        // Run the whole file as a single statement. postgres.js's tagged
        // template doesn't support "run this arbitrary string", so use
        // sql.unsafe with a static interpolation.
        await tx.unsafe(contents);
        await tx`
          insert into _migrations (filename, hash) values (${filename}, ${hash})
        `;
      });
      ranCount += 1;
    }

    console.log(
      ranCount === 0
        ? "All migrations already applied."
        : `Applied ${ranCount} migration(s).`
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
