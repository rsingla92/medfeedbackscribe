-- Critical fix: lock down the `recordings` storage bucket.
--
-- Audio is uploaded at path `{user_id}/{session_uuid}.webm` (see
-- app/src/app/record/page.tsx). The bucket previously had no SQL policies on
-- storage.objects, so any authenticated user could enumerate or download any
-- other user's audio by guessing UUIDs and calling `createSignedUrl`.
--
-- These policies scope all object access to objects whose first path segment
-- equals the caller's auth.uid(). Service role bypasses RLS as usual, so the
-- background pipeline (which uses the user's session via SSR cookies) still
-- works because the user_id in the path is theirs.

-- Ensure the bucket exists and is private. (Idempotent.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop any pre-existing permissive policies on this bucket (defensive — earlier
-- environments may have had ad-hoc policies created via the dashboard).
DROP POLICY IF EXISTS "Users select own recordings audio" ON storage.objects;
DROP POLICY IF EXISTS "Users insert own recordings audio" ON storage.objects;
DROP POLICY IF EXISTS "Users update own recordings audio" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own recordings audio" ON storage.objects;

CREATE POLICY "Users select own recordings audio"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users insert own recordings audio"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update own recordings audio"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own recordings audio"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
