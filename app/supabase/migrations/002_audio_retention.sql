-- Audio retention policy: delete audio files older than 90 days
-- This function should be called by a Supabase cron job (pg_cron)
-- or an external scheduler.
--
-- To set up in Supabase Dashboard → SQL Editor:
--   SELECT cron.schedule(
--     'delete-old-audio',
--     '0 3 * * *',  -- daily at 3 AM UTC
--     $$SELECT delete_expired_audio()$$
--   );

create or replace function delete_expired_audio()
returns integer as $$
declare
  deleted_count integer;
begin
  -- Mark recordings older than 90 days for deletion
  -- Note: actual Storage file deletion must be done via the Supabase
  -- Storage API, not SQL. This function clears the audio_path reference
  -- and logs the deletion. A companion Edge Function or cron should
  -- call storage.remove() for each cleared path.

  with expired as (
    update recordings
    set audio_path = null
    where audio_path is not null
      and created_at < now() - interval '90 days'
    returning id, audio_path
  )
  select count(*) into deleted_count from expired;

  -- Log the deletion
  if deleted_count > 0 then
    insert into pipeline_logs (session_id, step, status, metadata)
    select
      r.session_id,
      'audio_retention',
      'completed',
      jsonb_build_object('deleted_audio_paths', deleted_count)
    from recordings r
    where r.audio_path is null
      and r.created_at < now() - interval '90 days'
    limit 1;
  end if;

  return deleted_count;
end;
$$ language plpgsql security definer;
