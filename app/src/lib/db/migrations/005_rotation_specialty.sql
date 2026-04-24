-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005 — Specialty on rotations
--
-- Preceptors have a `specialty` column; rotations didn't. Adding one lets the
-- record UI filter preceptor picks by the rotation the resident is currently
-- on (a preceptor on a Family Med rotation shouldn't see the Cardiothoracic
-- surgery roster).
--
-- Backfill: existing rotations get NULL; the re-seed script populates them.
-- ─────────────────────────────────────────────────────────────────────────────

alter table rotations
  add column if not exists specialty text;

create index if not exists idx_rotations_specialty on rotations(specialty);
