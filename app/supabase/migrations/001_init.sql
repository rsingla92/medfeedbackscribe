-- Debrief Schema — Pilot
-- Matches data model from design doc

-- Preceptors (seeded from program roster, no auth)
create table preceptors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  specialty text,
  site text,
  created_at timestamptz default now()
);

-- Rotations
create table rotations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  program text not null default 'UBC Family Medicine',
  duration_weeks int,
  rotation_lead_id uuid references preceptors(id),
  created_at timestamptz default now()
);

-- Form templates (JSON schema driven)
create table form_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,               -- e.g. "T-Res Field Note", "One45 Daily Eval (EM)"
  program text not null,
  specialty text,
  extraction_mode text not null check (extraction_mode in ('multi', 'single')),
  max_outputs int default 5,        -- for multi mode
  fields jsonb not null,            -- JSON schema: field definitions, rating scales, tags
  competency_framework text default 'CanMEDS',
  created_at timestamptz default now()
);

-- Sessions (one recording session)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
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

-- Recordings (audio + transcript)
create table recordings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  audio_path text,                  -- Supabase Storage path
  duration_seconds int,
  transcript_raw text,              -- before PHI scrubbing
  transcript_clean text,            -- after PHI scrubbing
  language text default 'en',       -- 'en' or 'fr'
  stt_confidence float,
  created_at timestamptz default now()
);

-- Assessments (LLM extraction output — one per field note / eval)
-- For multi-mode forms, one session can have multiple assessments
create table assessments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  output_index int not null default 1,  -- 1-5 for multi mode, always 1 for single mode
  structured_fields jsonb not null,     -- matches form_template.fields schema
  competency_tags text[],               -- CanMEDS roles / domains
  narrative_summary text,
  coaching_did_well text,               -- T-Res: "something you did well"
  coaching_consider text,               -- T-Res: "consider next time"
  llm_confidence jsonb,                 -- per-field confidence scores
  resident_reviewed boolean default false,
  resident_edited boolean default false,
  exported_at timestamptz,
  created_at timestamptz default now(),
  unique(session_id, output_index)
);

-- Pipeline logs (observability)
create table pipeline_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  step text not null,                   -- 'upload', 'stt', 'phi_regex', 'phi_llm', 'extract', 'email'
  status text not null,                 -- 'started', 'completed', 'failed', 'skipped'
  duration_ms int,
  error_message text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Indexes
create index idx_sessions_user on sessions(user_id);
create index idx_sessions_status on sessions(status);
create index idx_assessments_session on assessments(session_id);
create index idx_pipeline_logs_session on pipeline_logs(session_id);

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();

-- Row Level Security
alter table sessions enable row level security;
alter table recordings enable row level security;
alter table assessments enable row level security;
alter table pipeline_logs enable row level security;

-- Residents can only see their own data
create policy "Users see own sessions"
  on sessions for select using (auth.uid() = user_id);
create policy "Users create own sessions"
  on sessions for insert with check (auth.uid() = user_id);
create policy "Users update own sessions"
  on sessions for update using (auth.uid() = user_id);

create policy "Users see own recordings"
  on recordings for select using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

create policy "Users see own assessments"
  on assessments for select using (
    session_id in (select id from sessions where user_id = auth.uid())
  );
create policy "Users update own assessments"
  on assessments for update using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

-- Preceptors and rotations are readable by all authenticated users
alter table preceptors enable row level security;
alter table rotations enable row level security;
alter table form_templates enable row level security;

create policy "Authenticated read preceptors"
  on preceptors for select using (auth.role() = 'authenticated');
create policy "Authenticated read rotations"
  on rotations for select using (auth.role() = 'authenticated');
create policy "Authenticated read form_templates"
  on form_templates for select using (auth.role() = 'authenticated');

-- Service role policies for pipeline (Edge Functions use service role)
create policy "Service role full access sessions"
  on sessions for all using (auth.role() = 'service_role');
create policy "Service role full access recordings"
  on recordings for all using (auth.role() = 'service_role');
create policy "Service role full access assessments"
  on assessments for all using (auth.role() = 'service_role');
create policy "Service role full access pipeline_logs"
  on pipeline_logs for all using (auth.role() = 'service_role');
