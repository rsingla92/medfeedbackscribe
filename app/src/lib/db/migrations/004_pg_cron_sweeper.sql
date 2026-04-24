-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004 — Stuck-session sweeper via pg_cron
--
-- Ported from Supabase migration 008. References the renamed
-- `recording_sessions` table.
--
-- Flips sessions stuck in 'processing' for >15 minutes to 'processing_failed'
-- and logs to pipeline_logs. Runs every 5 minutes via pg_cron.
--
-- RDS: pg_cron must be enabled in the DB parameter group (shared_preload_
-- libraries += 'pg_cron'). For local dev, pg_cron is usually unavailable —
-- the DO block below catches that and skips scheduling.
-- ─────────────────────────────────────────────────────────────────────────────

-- Function is always defined so callers can invoke it manually / via
-- EventBridge / whatever, regardless of whether pg_cron is present.
create or replace function mark_stuck_sessions_failed()
returns void
language plpgsql
security definer
as $$
declare
  stuck_session record;
  swept_count   integer := 0;
begin
  for stuck_session in
    select id
    from recording_sessions
    where status = 'processing'
      and updated_at < now() - interval '15 minutes'
  loop
    update recording_sessions
    set status = 'processing_failed'
    where id = stuck_session.id;

    insert into pipeline_logs (session_id, step, status, duration_ms, error_message)
    values (
      stuck_session.id,
      'sweeper',
      'failed',
      0,
      'Session was stuck in processing for >15 minutes and was auto-failed by pg_cron sweeper'
    );

    swept_count := swept_count + 1;
  end loop;

  if swept_count > 0 then
    raise log 'stuck_session_sweeper: flipped % session(s) to processing_failed', swept_count;
  end if;
end;
$$;

-- Partial index to speed up the sweeper's WHERE clause
create index if not exists idx_recording_sessions_status_updated_at
  on recording_sessions (status, updated_at)
  where status = 'processing';

comment on function mark_stuck_sessions_failed() is
  'Sweeper: flips recording_sessions stuck in processing (>15 min) to processing_failed. '
  'Scheduled via pg_cron every 5 minutes in production; callable manually.';

-- Try to schedule via pg_cron. Swallow errors so local/dev Postgres (where
-- pg_cron isn't installed) can still run this migration.
do $$
declare
  pg_cron_available boolean;
begin
  select exists (
    select 1 from pg_available_extensions where name = 'pg_cron'
  ) into pg_cron_available;

  if not pg_cron_available then
    raise notice 'pg_cron not available on this instance — skipping sweeper schedule. Run manually or enable the extension for prod.';
    return;
  end if;

  execute 'create extension if not exists pg_cron';

  -- Idempotent reschedule
  begin
    perform cron.unschedule('mark-stuck-sessions-failed');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'mark-stuck-sessions-failed',
    '*/5 * * * *',
    'select mark_stuck_sessions_failed()'
  );
end $$;
