/**
 * Typed query helpers.
 *
 * RULE: every user-scoped query takes `userId` and filters on it. This
 * replaces Supabase's RLS. Non-negotiable — PHIPA compliance depends on it.
 *
 * Tables (see migrations/002_app_schema.sql):
 *   - preceptors, rotations, form_templates      (shared; no user_id)
 *   - profiles                                    (1:1 with users)
 *   - recording_sessions                          (user_id FK, owner-scoped)
 *   - recordings, assessments, pipeline_logs      (via recording_sessions)
 */

import { sql } from "./client";

// ── Types ────────────────────────────────────────────────────────────────────

export type SessionStatus =
  | "created"
  | "uploading"
  | "processing"
  | "ready"
  | "exported"
  | "processing_failed";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  program: string | null;
  specialty: string | null;
  year_of_training: number | null;
  site: string | null;
  /** Unverified email awaiting confirmation (see migration 008). */
  pending_email?: string | null;
}

export interface Preceptor {
  id: string;
  name: string;
  email: string | null;
  specialty: string | null;
  site: string | null;
  /**
   * Ownership marker. Null means the row is shared/institutional (seeded) and
   * cannot be mutated by residents. Non-null means that user created the row
   * and is the only non-admin principal allowed to update/delete it.
   */
  created_by_user_id: string | null;
}

export interface Rotation {
  id: string;
  name: string;
  program: string;
  specialty: string | null;
  duration_weeks: number | null;
  rotation_lead_id: string | null;
}

export interface FormTemplate {
  id: string;
  name: string;
  program: string;
  specialty: string | null;
  extraction_mode: "multi" | "single";
  max_outputs: number;
  fields: Record<string, unknown>;
  competency_framework: string | null;
}

export interface RecordingSession {
  id: string;
  user_id: string;
  preceptor_id: string;
  rotation_id: string | null;
  form_template_id: string;
  date: string;
  consent_confirmed: boolean;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

export interface Recording {
  id: string;
  session_id: string;
  audio_path: string | null;
  duration_seconds: number | null;
  transcript_raw: string | null;
  transcript_clean: string | null;
  language: string;
  stt_confidence: number | null;
}

export interface Assessment {
  id: string;
  session_id: string;
  output_index: number;
  structured_fields: Record<string, unknown>;
  competency_tags: string[] | null;
  narrative_summary: string | null;
  coaching_did_well: string | null;
  coaching_consider: string | null;
  llm_confidence: Record<string, unknown> | null;
  resident_reviewed: boolean;
  resident_edited: boolean;
  exported_at: string | null;
  created_at: string;
}

export interface PipelineLog {
  id: string;
  session_id: string;
  step: string;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Profiles ─────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const rows = await sql<Profile[]>`
    select id, full_name, email, program, specialty, year_of_training, site,
           pending_email
    from profiles
    where id = ${userId}
    limit 1
  `;
  return rows[0] ?? null;
}

/**
 * Upsert a profile.
 *
 * SECURITY: the caller MUST gate `patch.email` before passing it in. The
 * onboarding route only includes `email` when it matches the authenticated
 * `users.email`; divergent addresses go through the pending-email flow
 * (upsertProfilePendingEmail + confirmProfileEmailByToken). If `patch.email`
 * is undefined/null, this query preserves the existing stored email.
 */
export async function upsertProfile(
  userId: string,
  patch: Partial<Omit<Profile, "id" | "pending_email">>,
): Promise<Profile> {
  const rows = await sql<Profile[]>`
    insert into profiles (id, full_name, email, program, specialty, year_of_training, site)
    values (
      ${userId},
      ${patch.full_name ?? ""},
      ${patch.email ?? null},
      ${patch.program ?? null},
      ${patch.specialty ?? null},
      ${patch.year_of_training ?? null},
      ${patch.site ?? null}
    )
    on conflict (id) do update set
      full_name = coalesce(excluded.full_name, profiles.full_name),
      email = coalesce(excluded.email, profiles.email),
      program = coalesce(excluded.program, profiles.program),
      specialty = coalesce(excluded.specialty, profiles.specialty),
      year_of_training = coalesce(excluded.year_of_training, profiles.year_of_training),
      site = coalesce(excluded.site, profiles.site),
      updated_at = now()
    returning id, full_name, email, program, specialty, year_of_training, site,
              pending_email
  `;
  return rows[0];
}

/**
 * Stage a pending email change. Caller generates the token and expiry; this
 * helper just persists them. Subsequent `confirmProfileEmailByToken` redeems
 * the token and promotes pending_email → email.
 *
 * If the profile row doesn't exist yet (first-time onboarding with a
 * divergent email), create a minimal one — `full_name` is NOT NULL, so we
 * stash a placeholder that the onboarding route's subsequent `upsertProfile`
 * call overwrites in the same request.
 */
export async function upsertProfilePendingEmail(
  userId: string,
  pendingEmail: string,
  token: string,
  expiresAt: Date,
): Promise<void> {
  await sql`
    insert into profiles
      (id, full_name, pending_email, pending_email_token, pending_email_expires_at)
    values (${userId}, ${""}, ${pendingEmail}, ${token}, ${expiresAt})
    on conflict (id) do update set
      pending_email = excluded.pending_email,
      pending_email_token = excluded.pending_email_token,
      pending_email_expires_at = excluded.pending_email_expires_at,
      updated_at = now()
  `;
}

/**
 * Redeem a pending-email token. Returns the user id on success (and promotes
 * pending_email → email, clearing the pending fields). Returns null if the
 * token is unknown, expired, or already used.
 */
export async function confirmProfileEmailByToken(
  token: string,
): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    update profiles set
      email = pending_email,
      pending_email = null,
      pending_email_token = null,
      pending_email_expires_at = null,
      updated_at = now()
    where pending_email_token = ${token}
      and pending_email is not null
      and pending_email_expires_at is not null
      and pending_email_expires_at > now()
    returning id
  `;
  return rows[0]?.id ?? null;
}

// ── Preceptors (per-user ownership; see migration 007) ──────────────────────
//
// Ownership model:
//   - `created_by_user_id` = NULL → shared / institutional row (seed data);
//     residents can read but not mutate.
//   - `created_by_user_id` = X    → only user X can update or delete.
// This is enforced in the UPDATE/DELETE WHERE clauses below, not at the route
// layer alone — defense in depth. The routes still return 403 on zero rows
// affected so the failure surfaces explicitly.

export async function listPreceptors(): Promise<Preceptor[]> {
  return sql<Preceptor[]>`
    select id, name, email, specialty, site, created_by_user_id
    from preceptors
    order by name
  `;
}

export async function getPreceptor(id: string): Promise<Preceptor | null> {
  const rows = await sql<Preceptor[]>`
    select id, name, email, specialty, site, created_by_user_id
    from preceptors where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function createPreceptor(
  patch: Omit<Preceptor, "id" | "created_by_user_id">,
  userId: string,
): Promise<Preceptor> {
  const rows = await sql<Preceptor[]>`
    insert into preceptors (name, email, specialty, site, created_by_user_id)
    values (
      ${patch.name},
      ${patch.email ?? null},
      ${patch.specialty ?? null},
      ${patch.site ?? null},
      ${userId}
    )
    returning id, name, email, specialty, site, created_by_user_id
  `;
  return rows[0];
}

/**
 * Update a preceptor row.
 *
 * Returns null when the row doesn't exist OR the caller doesn't own it.
 * Callers should surface a 403 in the "not owned" case rather than 404 so
 * the ownership boundary is visible (an attacker probing preceptor ids
 * would otherwise get a 404 either way).
 *
 * `coalesce($_ ?? null, column)` preserves the existing value when the
 * patch omits the field — preventing the silent-blank bug where a PATCH
 * body with `{ name: "New" }` would wipe email/specialty/site to NULL.
 */
export async function updatePreceptor(
  id: string,
  userId: string,
  patch: Partial<Omit<Preceptor, "id" | "created_by_user_id">>,
): Promise<Preceptor | null> {
  const rows = await sql<Preceptor[]>`
    update preceptors set
      name = coalesce(${patch.name ?? null}, name),
      email = coalesce(${patch.email ?? null}, email),
      specialty = coalesce(${patch.specialty ?? null}, specialty),
      site = coalesce(${patch.site ?? null}, site)
    where id = ${id}
      and created_by_user_id = ${userId}
    returning id, name, email, specialty, site, created_by_user_id
  `;
  return rows[0] ?? null;
}

/**
 * Delete a preceptor row owned by `userId`. Returns the number of rows
 * deleted (0 when the row is missing, owned by someone else, or shared).
 * Callers should surface 0 as 403.
 */
export async function deletePreceptor(
  id: string,
  userId: string,
): Promise<number> {
  const result = await sql`
    delete from preceptors
    where id = ${id}
      and created_by_user_id = ${userId}
  `;
  return result.count ?? 0;
}

// ── Rotations ────────────────────────────────────────────────────────────────

export async function listRotations(): Promise<Rotation[]> {
  return sql<Rotation[]>`
    select id, name, program, specialty, duration_weeks, rotation_lead_id
    from rotations order by name
  `;
}

export async function getRotation(id: string): Promise<Rotation | null> {
  const rows = await sql<Rotation[]>`
    select id, name, program, specialty, duration_weeks, rotation_lead_id
    from rotations where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

// ── Form templates ───────────────────────────────────────────────────────────

export async function listFormTemplates(): Promise<FormTemplate[]> {
  return sql<FormTemplate[]>`
    select id, name, program, specialty, extraction_mode, max_outputs,
           fields, competency_framework
    from form_templates order by name
  `;
}

export async function getFormTemplate(
  id: string,
): Promise<FormTemplate | null> {
  const rows = await sql<FormTemplate[]>`
    select id, name, program, specialty, extraction_mode, max_outputs,
           fields, competency_framework
    from form_templates where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

// ── Recording sessions (user-scoped) ─────────────────────────────────────────

export async function listRecordingSessions(
  userId: string,
): Promise<RecordingSession[]> {
  return sql<RecordingSession[]>`
    select id, user_id, preceptor_id, rotation_id, form_template_id,
           date, consent_confirmed, status, created_at, updated_at
    from recording_sessions
    where user_id = ${userId}
    order by created_at desc
  `;
}

export async function getRecordingSession(
  id: string,
  userId: string,
): Promise<RecordingSession | null> {
  const rows = await sql<RecordingSession[]>`
    select id, user_id, preceptor_id, rotation_id, form_template_id,
           date, consent_confirmed, status, created_at, updated_at
    from recording_sessions
    where id = ${id} and user_id = ${userId}
    limit 1
  `;
  return rows[0] ?? null;
}

export interface CreateRecordingSessionInput {
  userId: string;
  preceptorId: string;
  rotationId: string | null;
  formTemplateId: string;
  date: string;
  consentConfirmed: boolean;
}

export async function createRecordingSession(
  input: CreateRecordingSessionInput,
): Promise<RecordingSession> {
  const rows = await sql<RecordingSession[]>`
    insert into recording_sessions
      (user_id, preceptor_id, rotation_id, form_template_id, date, consent_confirmed)
    values (
      ${input.userId}, ${input.preceptorId}, ${input.rotationId},
      ${input.formTemplateId}, ${input.date}, ${input.consentConfirmed}
    )
    returning id, user_id, preceptor_id, rotation_id, form_template_id,
              date, consent_confirmed, status, created_at, updated_at
  `;
  return rows[0];
}

export async function updateRecordingSessionStatus(
  id: string,
  userId: string,
  status: SessionStatus,
): Promise<RecordingSession | null> {
  const rows = await sql<RecordingSession[]>`
    update recording_sessions
    set status = ${status}
    where id = ${id} and user_id = ${userId}
    returning id, user_id, preceptor_id, rotation_id, form_template_id,
              date, consent_confirmed, status, created_at, updated_at
  `;
  return rows[0] ?? null;
}

export interface RecordingSessionWithJoins extends RecordingSession {
  preceptor_name: string | null;
  preceptor_email: string | null;
  rotation_name: string | null;
  form_template_name: string | null;
  form_template_fields: Record<string, unknown> | null;
}

export async function getRecordingSessionWithJoins(
  id: string,
  userId: string,
): Promise<RecordingSessionWithJoins | null> {
  const rows = await sql<RecordingSessionWithJoins[]>`
    select
      rs.id, rs.user_id, rs.preceptor_id, rs.rotation_id, rs.form_template_id,
      rs.date, rs.consent_confirmed, rs.status, rs.created_at, rs.updated_at,
      p.name as preceptor_name, p.email as preceptor_email,
      r.name as rotation_name,
      ft.name as form_template_name, ft.fields as form_template_fields
    from recording_sessions rs
    left join preceptors p on p.id = rs.preceptor_id
    left join rotations r on r.id = rs.rotation_id
    left join form_templates ft on ft.id = rs.form_template_id
    where rs.id = ${id} and rs.user_id = ${userId}
    limit 1
  `;
  return rows[0] ?? null;
}

// ── Recordings (scope through session) ───────────────────────────────────────

export async function getRecordingBySession(
  sessionId: string,
  userId: string,
): Promise<Recording | null> {
  const rows = await sql<Recording[]>`
    select r.id, r.session_id, r.audio_path, r.duration_seconds,
           r.transcript_raw, r.transcript_clean, r.language, r.stt_confidence
    from recordings r
    join recording_sessions rs on rs.id = r.session_id
    where r.session_id = ${sessionId} and rs.user_id = ${userId}
    limit 1
  `;
  return rows[0] ?? null;
}

export interface CreateRecordingInput {
  sessionId: string;
  userId: string;
  audioPath: string;
  durationSeconds: number | null;
  language: string;
}

export async function createRecording(
  input: CreateRecordingInput,
): Promise<Recording> {
  // Ownership check — throw if the session isn't the user's.
  const owns = await sql<{ count: number }[]>`
    select count(*)::int as count
    from recording_sessions
    where id = ${input.sessionId} and user_id = ${input.userId}
  `;
  if (owns[0].count === 0) {
    throw new Error("Session not found or not owned by user");
  }
  const rows = await sql<Recording[]>`
    insert into recordings (session_id, audio_path, duration_seconds, language)
    values (${input.sessionId}, ${input.audioPath}, ${input.durationSeconds}, ${input.language})
    returning id, session_id, audio_path, duration_seconds,
              transcript_raw, transcript_clean, language, stt_confidence
  `;
  return rows[0];
}

export async function clearTranscriptClean(
  sessionId: string,
  userId: string,
): Promise<void> {
  await sql`
    update recordings r
    set transcript_clean = null
    from recording_sessions rs
    where r.session_id = rs.id
      and r.session_id = ${sessionId}
      and rs.user_id = ${userId}
  `;
}

// ── Assessments (scope through session) ──────────────────────────────────────

export async function listAssessmentsForSession(
  sessionId: string,
  userId: string,
): Promise<Assessment[]> {
  return sql<Assessment[]>`
    select a.id, a.session_id, a.output_index, a.structured_fields,
           a.competency_tags, a.narrative_summary, a.coaching_did_well,
           a.coaching_consider, a.llm_confidence, a.resident_reviewed,
           a.resident_edited, a.exported_at, a.created_at
    from assessments a
    join recording_sessions rs on rs.id = a.session_id
    where a.session_id = ${sessionId} and rs.user_id = ${userId}
    order by a.output_index
  `;
}

export async function updateAssessment(
  id: string,
  userId: string,
  patch: Partial<
    Pick<
      Assessment,
      | "structured_fields"
      | "competency_tags"
      | "narrative_summary"
      | "coaching_did_well"
      | "coaching_consider"
      | "resident_reviewed"
      | "resident_edited"
    >
  >,
): Promise<Assessment | null> {
  // Serialize JSON columns explicitly. `sql.json` needs a non-null value;
  // pass `null` as a literal when absent so coalesce preserves existing data.
  const structuredJson =
    patch.structured_fields !== undefined
      ? sql.json(patch.structured_fields as never)
      : null;
  const rows = await sql<Assessment[]>`
    update assessments a set
      structured_fields = coalesce(${structuredJson}, a.structured_fields),
      competency_tags = coalesce(${patch.competency_tags ?? null}, a.competency_tags),
      narrative_summary = coalesce(${patch.narrative_summary ?? null}, a.narrative_summary),
      coaching_did_well = coalesce(${patch.coaching_did_well ?? null}, a.coaching_did_well),
      coaching_consider = coalesce(${patch.coaching_consider ?? null}, a.coaching_consider),
      resident_reviewed = coalesce(${patch.resident_reviewed ?? null}, a.resident_reviewed),
      resident_edited = coalesce(${patch.resident_edited ?? null}, a.resident_edited)
    from recording_sessions rs
    where a.id = ${id}
      and a.session_id = rs.id
      and rs.user_id = ${userId}
    returning a.id, a.session_id, a.output_index, a.structured_fields,
              a.competency_tags, a.narrative_summary, a.coaching_did_well,
              a.coaching_consider, a.llm_confidence, a.resident_reviewed,
              a.resident_edited, a.exported_at, a.created_at
  `;
  return rows[0] ?? null;
}

export async function markAssessmentsExported(
  sessionId: string,
  userId: string,
): Promise<void> {
  await sql`
    update assessments a
    set exported_at = now()
    from recording_sessions rs
    where a.session_id = rs.id
      and a.session_id = ${sessionId}
      and rs.user_id = ${userId}
  `;
}

// ── Pipeline logs (observability — scoped through session) ───────────────────

export async function listPipelineLogs(
  sessionId: string,
  userId: string,
): Promise<PipelineLog[]> {
  return sql<PipelineLog[]>`
    select pl.id, pl.session_id, pl.step, pl.status, pl.duration_ms,
           pl.error_message, pl.metadata, pl.created_at
    from pipeline_logs pl
    join recording_sessions rs on rs.id = pl.session_id
    where pl.session_id = ${sessionId} and rs.user_id = ${userId}
    order by pl.created_at desc
  `;
}

// ── Metrics (user-scoped aggregates) ─────────────────────────────────────────

export interface SessionMetrics {
  total: number;
  ready: number;
  processing: number;
  processing_failed: number;
  exported: number;
}

export async function getSessionMetrics(
  userId: string,
): Promise<SessionMetrics> {
  const rows = await sql<SessionMetrics[]>`
    select
      count(*)::int as total,
      count(*) filter (where status = 'ready')::int as ready,
      count(*) filter (where status = 'processing')::int as processing,
      count(*) filter (where status = 'processing_failed')::int as processing_failed,
      count(*) filter (where status = 'exported')::int as exported
    from recording_sessions
    where user_id = ${userId}
  `;
  return rows[0];
}
