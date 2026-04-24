-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006 — Consent event timestamp + copy version
--
-- For the UBC FM Coastal Site pilot, PHIPA requires that we record not just
-- *that* consent was given, but *when* and *against what copy*. The existing
-- `consent_confirmed` boolean says only "the resident ticked the box" — it
-- doesn't preserve a timestamp or the version of the disclosure the preceptor
-- agreed to.
--
-- We add two nullable columns so existing rows are unaffected; the recording
-- sessions API populates them on create going forward.
-- ─────────────────────────────────────────────────────────────────────────────

alter table recording_sessions
  add column if not exists consent_confirmed_at timestamptz,
  add column if not exists consent_copy_version text;

create index if not exists idx_recording_sessions_consent_confirmed_at
  on recording_sessions(consent_confirmed_at);
