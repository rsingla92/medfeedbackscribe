-- Extend the stuck-session sweeper to also pick up 'uploading' sessions that
-- never received an audio_path (user closed the tab mid-upload). 30-minute
-- grace window is longer than the 10-minute presigned PUT TTL.

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
    select id, status
    from recording_sessions
    where (
      (status = 'processing' and updated_at < now() - interval '15 minutes')
      or
      (status = 'uploading' and updated_at < now() - interval '30 minutes')
    )
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
      case
        when stuck_session.status = 'uploading' then
          'Session stuck in uploading for >30 minutes — auto-failed by sweeper'
        else
          'Session stuck in processing for >15 minutes — auto-failed by sweeper'
      end
    );

    swept_count := swept_count + 1;
  end loop;

  if swept_count > 0 then
    raise log 'stuck_session_sweeper: flipped % session(s) to processing_failed', swept_count;
  end if;
end;
$$;

create index if not exists idx_recording_sessions_status_updated_uploading
  on recording_sessions(status, updated_at)
  where status = 'uploading';
