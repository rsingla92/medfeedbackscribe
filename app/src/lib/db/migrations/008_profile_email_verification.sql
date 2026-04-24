-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008 — Profile email verification (spoofing hardening)
--
-- Before this change, the onboarding form wrote arbitrary user-supplied
-- strings to profiles.email. The Lambda then used that address as the
-- assessment-ready notification target — so a resident could route their
-- own PHI emails to a supervisor's or attacker's inbox.
--
-- Fix: when the user-supplied email differs from the authenticated
-- users.email, stash it in pending_email with a random token + TTL, send a
-- confirmation link, and only promote pending_email → email after the token
-- is redeemed.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles
  add column if not exists pending_email text,
  add column if not exists pending_email_token text,
  add column if not exists pending_email_expires_at timestamptz;

create index if not exists idx_profiles_pending_email_token
  on profiles(pending_email_token)
  where pending_email_token is not null;
