-- Append-only audit log for mutating actions on sensitive resources.
-- PHIPA expectation: who did what, when, from where, against which resource.
-- Never updated or deleted — if a row was wrong, append a correction row.

create table if not exists audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id) on delete set null,
  action        text not null,     -- 'preceptor.update', 'session.export', etc.
  target_type   text not null,     -- 'preceptor', 'recording_session', 'profile', ...
  target_id     text,              -- stringified id, nullable for account-level actions
  result        text not null,     -- 'ok', 'forbidden', 'error'
  ip            text,
  user_agent    text,
  metadata      jsonb,             -- anything small and non-PHI
  created_at    timestamptz not null default now()
);

create index if not exists idx_audit_log_actor on audit_log(actor_user_id, created_at desc);
create index if not exists idx_audit_log_target on audit_log(target_type, target_id, created_at desc);
create index if not exists idx_audit_log_action on audit_log(action, created_at desc);

-- Deliberately NO update/delete grants — enforce immutability at the app tier
-- (no query in queries.ts or audit.ts writes UPDATE/DELETE on audit_log).
comment on table audit_log is 'Append-only audit log. Do not UPDATE or DELETE rows.';
