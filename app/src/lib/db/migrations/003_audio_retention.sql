-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003 — Audio retention sweeper (90-day TTL)
--
-- Ported from Supabase migration 002. Clears `audio_path` on recordings older
-- than 90 days. Actual S3 object deletion is handled by a separate CDK-managed
-- lifecycle rule on the recordings bucket; this function exists so the DB
-- reference is also cleared (defense in depth).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function delete_expired_audio()
returns integer as $$
declare
  deleted_count integer;
begin
  with expired as (
    update recordings
    set audio_path = null
    where audio_path is not null
      and created_at < now() - interval '90 days'
    returning id, audio_path
  )
  select count(*) into deleted_count from expired;

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
