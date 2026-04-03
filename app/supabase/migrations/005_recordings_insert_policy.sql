-- Allow authenticated users to insert recordings for their own sessions
CREATE POLICY "Users create own recordings"
ON recordings FOR INSERT
WITH CHECK (
  session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
);
