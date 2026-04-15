-- ──────────────────────────────────────────────────────────────────────────────
-- Migration 008: Stuck-session sweeper via pg_cron
--
-- Addresses architecture-review-2026-04-14.md finding F-03 (no failure recovery).
--
-- Problem: sessions can get stuck in 'processing' status if the Edge Function
-- crashes, times out hard, or the server is restarted mid-pipeline. Without a
-- sweeper these sessions stay "processing" forever, showing a spinner to the user
-- with no way to recover.
--
-- Solution:
--   1. A PL/pgSQL function mark_stuck_sessions_failed() that flips sessions
--      stuck in 'processing' for more than 15 minutes to 'processing_failed'.
--   2. An observability log row in pipeline_logs for each session flipped so
--      engineers can diagnose root causes.
--   3. A pg_cron schedule that runs the function every 5 minutes.
--
-- Compute constraint: pg_cron runs inside the Supabase project (ca-central-1).
-- No Vercel cron, no external scheduler.
-- ──────────────────────────────────────────────────────────────────────────────

-- Enable pg_cron extension (idempotent; Supabase enables this in the postgres schema)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── Sweeper function ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_stuck_sessions_failed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stuck_session RECORD;
  swept_count   INTEGER := 0;
BEGIN
  -- Find all sessions stuck in 'processing' for more than 15 minutes.
  -- 15 min is intentionally conservative: the pipeline has a 2-min Edge Function
  -- budget, so anything beyond that is definitively stuck.
  FOR stuck_session IN
    SELECT id
    FROM sessions
    WHERE status = 'processing'
      AND updated_at < NOW() - INTERVAL '15 minutes'
  LOOP
    -- Flip status
    UPDATE sessions
    SET status = 'processing_failed'
    WHERE id = stuck_session.id;

    -- Log for observability (mirrors the pattern in index.ts logStep)
    INSERT INTO pipeline_logs (session_id, step, status, duration_ms, error_message)
    VALUES (
      stuck_session.id,
      'sweeper',
      'failed',
      0,
      'Session was stuck in processing for >15 minutes and was auto-failed by pg_cron sweeper'
    );

    swept_count := swept_count + 1;
  END LOOP;

  -- Surface count in Postgres logs for easy monitoring
  IF swept_count > 0 THEN
    RAISE LOG 'stuck_session_sweeper: flipped % session(s) to processing_failed', swept_count;
  END IF;
END;
$$;

-- ── Schedule: every 5 minutes ─────────────────────────────────────────────────
-- Unschedule first to make the migration idempotent (re-runnable without dupes)
SELECT cron.unschedule('mark-stuck-sessions-failed')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'mark-stuck-sessions-failed'
);

SELECT cron.schedule(
  'mark-stuck-sessions-failed',   -- job name
  '*/5 * * * *',                  -- every 5 minutes
  'SELECT mark_stuck_sessions_failed()'
);

-- ── Index: speed up the sweeper's WHERE clause ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_status_updated_at
  ON sessions (status, updated_at)
  WHERE status = 'processing';

-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON FUNCTION mark_stuck_sessions_failed() IS
  'pg_cron sweeper: flips sessions stuck in processing (>15 min) to processing_failed. '
  'Scheduled every 5 minutes. Logs each flip to pipeline_logs for observability.';
