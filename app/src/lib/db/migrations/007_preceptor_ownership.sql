-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007 — Preceptor ownership (IDOR hardening)
--
-- Before this change, any authenticated resident could PATCH any preceptor
-- row — including rewriting the `email` field. Because future
-- assessment-ready notifications to preceptors use that email, this was an
-- account-takeover / PHI-redirection vector.
--
-- Fix: add `created_by_user_id`. New rows carry the creator's id; only the
-- creator can mutate their own rows. Existing rows (seeded institutional
-- preceptors) stay as shared (NULL) and become read-only from the app tier.
-- ─────────────────────────────────────────────────────────────────────────────

alter table preceptors
  add column if not exists created_by_user_id uuid null
    references users(id) on delete set null;

create index if not exists idx_preceptors_created_by
  on preceptors(created_by_user_id);
