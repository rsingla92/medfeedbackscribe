/**
 * Postgres client wrapper for the Debrief pipeline Lambda.
 *
 * - Uses the `postgres` npm package (lightweight, no ORM).
 * - Reads credentials from AWS Secrets Manager (`DB_SECRET_ARN`) in Lambda.
 *   Falls back to `DATABASE_URL` env var for local development / tests.
 * - Pool size 1 — each Lambda invocation serves a single SQS record and
 *   should not hold more than one connection.
 * - Connection is lazily initialised and cached across warm invocations.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import postgres, { type Sql } from "postgres";
import type {
  AssessmentOutput,
  FormTemplateRow,
  PreceptorRow,
  ProfileRow,
  RecordingRow,
  RotationRow,
  SessionRow,
} from "./types.js";

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

let _sql: Sql | null = null;

interface RdsSecret {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname?: string;
  engine?: string;
}

async function buildConnectionString(): Promise<string> {
  // Local / test path — developer supplies a DATABASE_URL directly.
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const secretArn = process.env.DB_SECRET_ARN ?? process.env.RDS_SECRET_ARN;
  if (!secretArn) {
    throw new Error(
      "DB_CONFIG_MISSING: set DATABASE_URL or DB_SECRET_ARN (RDS_SECRET_ARN)"
    );
  }

  const client = new SecretsManagerClient({});
  const resp = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn })
  );
  const raw = resp.SecretString;
  if (!raw) throw new Error("DB_SECRET_EMPTY");

  const secret = JSON.parse(raw) as RdsSecret;
  const host =
    secret.host ?? process.env.RDS_ENDPOINT ?? "";
  const port = secret.port ?? 5432;
  const dbname = secret.dbname ?? process.env.DB_NAME ?? "debrief";
  const user = encodeURIComponent(secret.username);
  const pass = encodeURIComponent(secret.password);
  return `postgres://${user}:${pass}@${host}:${port}/${dbname}?sslmode=require`;
}

export async function getSql(): Promise<Sql> {
  if (_sql) return _sql;
  const connectionString = await buildConnectionString();
  _sql = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    ssl: connectionString.includes("sslmode=require") ? "require" : undefined,
  });
  return _sql;
}

/** Test hook — inject a fake sql client. */
export function _setSqlClientForTests(sql: Sql | null): void {
  _sql = sql;
}

/** Close the current pool (for graceful Lambda shutdown or tests). */
export async function closeSql(): Promise<void> {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
  }
}

// ---------------------------------------------------------------------------
// Typed query helpers
// ---------------------------------------------------------------------------

export async function getSession(id: string): Promise<SessionRow | null> {
  const sql = await getSql();
  const rows = await sql<SessionRow[]>`
    select id, user_id, preceptor_id, rotation_id, form_template_id, date::text as date, status
    from recording_sessions
    where id = ${id}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function getRecording(sessionId: string): Promise<RecordingRow | null> {
  const sql = await getSql();
  const rows = await sql<RecordingRow[]>`
    select session_id, audio_path, language
    from recordings
    where session_id = ${sessionId}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function getFormTemplate(
  id: string
): Promise<FormTemplateRow | null> {
  const sql = await getSql();
  const rows = await sql<FormTemplateRow[]>`
    select id, name, extraction_mode, max_outputs, fields, competency_framework
    from form_templates
    where id = ${id}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function getPreceptor(id: string): Promise<PreceptorRow | null> {
  const sql = await getSql();
  const rows = await sql<PreceptorRow[]>`
    select id, name, email from preceptors where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function getRotation(id: string): Promise<RotationRow | null> {
  const sql = await getSql();
  const rows = await sql<RotationRow[]>`
    select id, name from rotations where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function getProfile(id: string): Promise<ProfileRow | null> {
  const sql = await getSql();
  const rows = await sql<ProfileRow[]>`
    select id, full_name, email from profiles where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function updateSessionStatus(
  id: string,
  status: string
): Promise<void> {
  const sql = await getSql();
  await sql`update recording_sessions set status = ${status}, updated_at = now() where id = ${id}`;
}

export interface RecordingUpdate {
  transcript_raw?: string | null;
  transcript_clean?: string | null;
  duration_seconds?: number | null;
  stt_confidence?: number | null;
  language?: string | null;
  audio_path?: string | null;
}

export async function updateRecording(
  sessionId: string,
  patch: RecordingUpdate
): Promise<void> {
  const sql = await getSql();
  // Build a partial update — only set columns the caller provided.
  const keys = Object.keys(patch) as (keyof RecordingUpdate)[];
  if (keys.length === 0) return;

  // postgres.js tagged literal: use sql(updates, ...cols) pattern
  await sql`
    update recordings
    set ${sql(patch as Record<string, unknown>, ...keys as string[])}
    where session_id = ${sessionId}
  `;
}

export interface AssessmentInsert extends AssessmentOutput {
  session_id: string;
  llm_confidence: Record<string, number>;
}

export async function insertAssessments(
  sessionId: string,
  outputs: AssessmentOutput[]
): Promise<void> {
  if (outputs.length === 0) return;
  const sql = await getSql();

  const rows = outputs.map((o) => ({
    session_id: sessionId,
    output_index: o.output_index,
    // `sql.json` accepts any JSON-serialisable value; the TS signature is strict
    // so we narrow via `as any` locally. This is safe because the runtime only
    // requires JSON.stringify-able input, which both are.
    structured_fields: sql.json(o.structured_fields as never),
    competency_tags: o.competency_tags,
    narrative_summary: o.narrative_summary,
    coaching_did_well: o.coaching_did_well ?? null,
    coaching_consider: o.coaching_consider ?? null,
    llm_confidence: sql.json(o.confidence as never),
  }));

  await sql`insert into assessments ${sql(rows)}`;
}

export interface PipelineLogInsert {
  session_id: string;
  step: string;
  status: string;
  duration_ms?: number;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function insertPipelineLog(entry: PipelineLogInsert): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into pipeline_logs
      (session_id, step, status, duration_ms, error_message, metadata)
    values
      (${entry.session_id}, ${entry.step}, ${entry.status},
       ${entry.duration_ms ?? null}, ${entry.error_message ?? null},
       ${entry.metadata ? sql.json(entry.metadata as never) : null})
  `;
}
