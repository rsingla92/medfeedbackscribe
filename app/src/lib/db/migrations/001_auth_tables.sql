-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001 — Auth.js tables
--
-- Replaces Supabase's `auth.users` schema. The shape here matches what
-- @auth/pg-adapter expects:
--   - users(id uuid pk, name, email unique, "emailVerified", image)
--   - accounts(... compound pk (provider, providerAccountId))
--   - sessions(sessionToken unique, userId, expires)
--   - verification_tokens(... compound pk (identifier, token))
--
-- Note: the app's own "sessions" concept (one recording session) is renamed
-- to `recording_sessions` in migration 002 to avoid collision with Auth.js's
-- `sessions` table.
-- ─────────────────────────────────────────────────────────────────────────────

-- Required for gen_random_uuid() / uuid PKs.
create extension if not exists "pgcrypto";

-- ── users ──
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text unique,
  "emailVerified" timestamptz,
  image text
);

-- ── accounts (OAuth providers — Google, etc.) ──
create table if not exists accounts (
  "userId" uuid not null references users(id) on delete cascade,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  primary key (provider, "providerAccountId")
);

create index if not exists idx_accounts_userId on accounts("userId");

-- ── sessions (Auth.js database sessions — NOT our app's recording sessions) ──
create table if not exists sessions (
  "sessionToken" text primary key,
  "userId" uuid not null references users(id) on delete cascade,
  expires timestamptz not null
);

create index if not exists idx_sessions_userId on sessions("userId");

-- ── verification_tokens (email magic links) ──
create table if not exists verification_tokens (
  identifier text not null,
  token text not null,
  expires timestamptz not null,
  primary key (identifier, token)
);
