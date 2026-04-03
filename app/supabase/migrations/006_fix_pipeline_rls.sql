-- Fix: Pipeline operations fail because the API route uses the user's
-- authenticated session (anon key + cookies), not service_role.
-- The pipeline needs INSERT/UPDATE on assessments, recordings, and pipeline_logs
-- scoped to the user's own sessions.

-- Assessments: allow users to INSERT for their own sessions (pipeline creates these)
CREATE POLICY "Users insert own assessments"
  ON assessments FOR INSERT
  WITH CHECK (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
  );

-- Pipeline logs: allow users to INSERT for their own sessions (pipeline logs these)
CREATE POLICY "Users insert own pipeline_logs"
  ON pipeline_logs FOR INSERT
  WITH CHECK (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
  );

-- Pipeline logs: allow users to SELECT their own logs (for review page status)
CREATE POLICY "Users see own pipeline_logs"
  ON pipeline_logs FOR SELECT
  USING (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
  );

-- Recordings: allow users to UPDATE their own recordings (pipeline saves transcript)
CREATE POLICY "Users update own recordings"
  ON recordings FOR UPDATE
  USING (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
  )
  WITH CHECK (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
  );

-- Performance: add missing indexes on foreign keys
CREATE INDEX IF NOT EXISTS idx_sessions_preceptor ON sessions(preceptor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_rotation ON sessions(rotation_id);
CREATE INDEX IF NOT EXISTS idx_sessions_form_template ON sessions(form_template_id);
