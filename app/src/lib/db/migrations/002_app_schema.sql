-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002 — Debrief application schema
--
-- Ported from Supabase migrations 001, 003, 004, 005, 006 with RLS removed.
-- Authorization is now enforced at the application layer (see app/src/lib/
-- db/queries.ts). Every user-scoped query must filter by userId.
--
-- Schema changes from the Supabase version:
--   - `auth.users` FKs → `users` (Auth.js's users table, created in 001)
--   - `sessions` table → RENAMED to `recording_sessions` to avoid collision
--     with Auth.js's `sessions` table. All FKs updated.
--   - Added `email` column to `profiles` so the Lambda can notify residents
--     without joining to the Auth.js `users` table.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Preceptors ─────────────────────────────────────────────────────────────────
-- NOTE: Shared across all users (no user_id). See F-12 in the architecture
--       review — this may need tightening if the app grows beyond a single
--       program. For the pilot this is intentional: residents share a preceptor
--       roster.
create table if not exists preceptors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  specialty text,
  site text,
  created_at timestamptz default now()
);

-- ── Rotations ──────────────────────────────────────────────────────────────────
create table if not exists rotations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  program text not null default 'UBC Family Medicine',
  duration_weeks int,
  rotation_lead_id uuid references preceptors(id),
  created_at timestamptz default now()
);

-- ── Form templates ─────────────────────────────────────────────────────────────
create table if not exists form_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  program text not null,
  specialty text,
  extraction_mode text not null check (extraction_mode in ('multi', 'single')),
  max_outputs int default 5,
  fields jsonb not null,
  competency_framework text default 'CanMEDS',
  created_at timestamptz default now()
);

-- ── Profiles (resident-specific info; 1:1 with users) ──────────────────────────
create table if not exists profiles (
  id uuid primary key references users(id) on delete cascade,
  full_name text not null,
  email text,                  -- mirrored from users.email so Lambda can notify
  program text,
  specialty text,
  year_of_training int,
  site text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Recording sessions ─────────────────────────────────────────────────────────
-- Renamed from `sessions` (Supabase schema) to avoid collision with Auth.js's
-- own `sessions` table. Every downstream reference (app queries, Lambda db
-- helpers) has been updated.
create table if not exists recording_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  preceptor_id uuid not null references preceptors(id),
  rotation_id uuid references rotations(id),
  form_template_id uuid not null references form_templates(id),
  date date not null default current_date,
  consent_confirmed boolean not null default false,
  status text not null default 'created' check (
    status in ('created', 'uploading', 'processing', 'ready', 'exported', 'processing_failed')
  ),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Recordings (audio + transcript) ────────────────────────────────────────────
create table if not exists recordings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references recording_sessions(id) on delete cascade,
  audio_path text,
  duration_seconds int,
  transcript_raw text,
  transcript_clean text,
  language text default 'en',
  stt_confidence float,
  created_at timestamptz default now()
);

-- ── Assessments (LLM extraction output) ────────────────────────────────────────
create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references recording_sessions(id) on delete cascade,
  output_index int not null default 1,
  structured_fields jsonb not null,
  competency_tags text[],
  narrative_summary text,
  coaching_did_well text,
  coaching_consider text,
  llm_confidence jsonb,
  resident_reviewed boolean default false,
  resident_edited boolean default false,
  exported_at timestamptz,
  created_at timestamptz default now(),
  unique(session_id, output_index)
);

-- ── Pipeline logs (observability) ──────────────────────────────────────────────
create table if not exists pipeline_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references recording_sessions(id) on delete cascade,
  step text not null,
  status text not null,
  duration_ms int,
  error_message text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
create index if not exists idx_recording_sessions_user on recording_sessions(user_id);
create index if not exists idx_recording_sessions_status on recording_sessions(status);
create index if not exists idx_recording_sessions_preceptor on recording_sessions(preceptor_id);
create index if not exists idx_recording_sessions_rotation on recording_sessions(rotation_id);
create index if not exists idx_recording_sessions_form_template on recording_sessions(form_template_id);
create index if not exists idx_recordings_session on recordings(session_id);
create index if not exists idx_assessments_session on assessments(session_id);
create index if not exists idx_pipeline_logs_session on pipeline_logs(session_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists recording_sessions_updated_at on recording_sessions;
create trigger recording_sessions_updated_at
  before update on recording_sessions
  for each row execute function update_updated_at();

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();
