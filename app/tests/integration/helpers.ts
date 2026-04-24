/**
 * Integration-test helpers.
 *
 * Loads DATABASE_URL from .env.local (no dotenv dep), verifies the local
 * Postgres is reachable, and exposes small seed/cleanup utilities. Every
 * inserted row is tagged with a shared UUIDv4 PREFIX embedded into name/email
 * fields so `cleanupTestData` can remove only test rows — never the
 * dev-seeded data.
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { sql } from "@/lib/db/client";

// ── .env.local loader (no extra dep) ─────────────────────────────────────────

function loadEnvLocal(): void {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(__dirname, "..", "..", ".env.local");
  let raw: string;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

// ── Shared run-scoped tag ────────────────────────────────────────────────────
/**
 * Every test row gets this prefix baked into a text column so
 * `cleanupTestData()` can delete only test rows even if a test crashes.
 * Fresh per process.
 */
export const TEST_PREFIX = `phipa-test-${randomUUID()}`;

// ── Connection verification ──────────────────────────────────────────────────

export async function verifyConnection(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL not set — integration tests require a local Postgres. " +
        "Set it in app/.env.local.",
    );
  }
  try {
    await sql`select 1 as ok`;
  } catch (err) {
    throw new Error(
      `Cannot reach Postgres at ${process.env.DATABASE_URL}: ${
        (err as Error).message
      }`,
    );
  }
}

// ── Schema feature detection ─────────────────────────────────────────────────

let _hasPreceptorOwnership: boolean | null = null;

export async function hasPreceptorOwnership(): Promise<boolean> {
  if (_hasPreceptorOwnership !== null) return _hasPreceptorOwnership;
  const rows = await sql<{ exists: boolean }[]>`
    select exists (
      select 1 from information_schema.columns
      where table_name = 'preceptors'
        and column_name = 'created_by_user_id'
    ) as exists
  `;
  _hasPreceptorOwnership = rows[0]?.exists ?? false;
  return _hasPreceptorOwnership;
}

// ── Seed helpers ─────────────────────────────────────────────────────────────

export async function createTestUser(label: string): Promise<string> {
  const id = randomUUID();
  const email = `${TEST_PREFIX}-${label}-${id.slice(0, 8)}@test.invalid`;
  await sql`
    insert into users (id, email, name)
    values (${id}, ${email}, ${`${TEST_PREFIX} ${label}`})
  `;
  return id;
}

export async function createTestProfile(
  userId: string,
  patch: { full_name?: string; email?: string } = {},
): Promise<void> {
  await sql`
    insert into profiles (id, full_name, email)
    values (
      ${userId},
      ${patch.full_name ?? `${TEST_PREFIX}-profile`},
      ${patch.email ?? null}
    )
    on conflict (id) do nothing
  `;
}

export async function createTestPreceptor(
  createdBy?: string,
): Promise<string> {
  const id = randomUUID();
  const name = `${TEST_PREFIX}-preceptor-${id.slice(0, 8)}`;
  const email = `${TEST_PREFIX}-preceptor-${id.slice(0, 8)}@test.invalid`;

  if (await hasPreceptorOwnership()) {
    await sql`
      insert into preceptors (id, name, email, created_by_user_id)
      values (${id}, ${name}, ${email}, ${createdBy ?? null})
    `;
  } else {
    await sql`
      insert into preceptors (id, name, email)
      values (${id}, ${name}, ${email})
    `;
  }
  return id;
}

export async function createTestFormTemplate(): Promise<string> {
  const id = randomUUID();
  const name = `${TEST_PREFIX}-form-${id.slice(0, 8)}`;
  await sql`
    insert into form_templates (
      id, name, program, specialty, extraction_mode, max_outputs, fields
    ) values (
      ${id},
      ${name},
      ${"Test Program"},
      ${"Test Specialty"},
      ${"single"},
      ${1},
      ${sql.json({ test: true })}
    )
  `;
  return id;
}

export interface CreateTestRecordingSessionInput {
  userId: string;
  preceptorId: string;
  formTemplateId: string;
  rotationId?: string | null;
}

export async function createTestRecordingSession(
  input: CreateTestRecordingSessionInput,
): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into recording_sessions (
      user_id, preceptor_id, rotation_id, form_template_id,
      date, consent_confirmed
    ) values (
      ${input.userId},
      ${input.preceptorId},
      ${input.rotationId ?? null},
      ${input.formTemplateId},
      current_date,
      true
    )
    returning id
  `;
  return rows[0].id;
}

export async function createTestRecording(sessionId: string): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into recordings (
      session_id, audio_path, duration_seconds,
      transcript_raw, transcript_clean, language
    ) values (
      ${sessionId},
      ${`${TEST_PREFIX}/${sessionId}.webm`},
      ${60},
      ${`${TEST_PREFIX} raw transcript`},
      ${`${TEST_PREFIX} clean transcript`},
      ${"en"}
    )
    returning id
  `;
  return rows[0].id;
}

export async function createTestAssessment(
  sessionId: string,
  outputIndex = 1,
): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into assessments (
      session_id, output_index, structured_fields,
      narrative_summary, coaching_did_well, coaching_consider
    ) values (
      ${sessionId},
      ${outputIndex},
      ${sql.json({ marker: TEST_PREFIX })},
      ${`${TEST_PREFIX} narrative`},
      ${`${TEST_PREFIX} did well`},
      ${`${TEST_PREFIX} consider`}
    )
    returning id
  `;
  return rows[0].id;
}

export async function createTestPipelineLog(
  sessionId: string,
  step = "stt",
): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into pipeline_logs (
      session_id, step, status, duration_ms, metadata
    ) values (
      ${sessionId},
      ${step},
      ${"ok"},
      ${100},
      ${sql.json({ marker: TEST_PREFIX })}
    )
    returning id
  `;
  return rows[0].id;
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Delete everything tagged with this run's TEST_PREFIX, in FK-safe order.
 * Safe to call even after a crashed test — never touches rows without the
 * prefix (i.e. never touches the dev-seeded user or demo session).
 */
export async function cleanupTestData(): Promise<void> {
  // Children of recording_sessions first. Identify test sessions via the
  // owning users' email prefix to stay scoped even if a test forgot to
  // delete its session directly.
  await sql`
    delete from pipeline_logs
    where session_id in (
      select rs.id from recording_sessions rs
      join users u on u.id = rs.user_id
      where u.email like ${TEST_PREFIX + "%"}
    )
  `;
  await sql`
    delete from assessments
    where session_id in (
      select rs.id from recording_sessions rs
      join users u on u.id = rs.user_id
      where u.email like ${TEST_PREFIX + "%"}
    )
  `;
  await sql`
    delete from recordings
    where session_id in (
      select rs.id from recording_sessions rs
      join users u on u.id = rs.user_id
      where u.email like ${TEST_PREFIX + "%"}
    )
  `;
  await sql`
    delete from recording_sessions
    where user_id in (select id from users where email like ${TEST_PREFIX + "%"})
  `;
  await sql`
    delete from profiles
    where id in (select id from users where email like ${TEST_PREFIX + "%"})
  `;
  await sql`delete from preceptors where name like ${TEST_PREFIX + "%"}`;
  await sql`delete from form_templates where name like ${TEST_PREFIX + "%"}`;
  await sql`delete from users where email like ${TEST_PREFIX + "%"}`;
}

/** Close the pg connection so the test runner exits cleanly. */
export async function endConnection(): Promise<void> {
  // postgres.js exposes .end() on the client; go through the Proxy.
  const sqlAny = sql as unknown as { end?: (opts?: unknown) => Promise<void> };
  if (typeof sqlAny.end === "function") {
    await sqlAny.end({ timeout: 1 });
  }
}
