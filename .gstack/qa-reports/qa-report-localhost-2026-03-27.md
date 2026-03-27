# QA Report — MedScribe

**Date:** 2026-03-27
**URL:** http://localhost:3000
**Framework:** Next.js 16.2.1
**Tier:** Standard
**Duration:** ~30 min (across multiple sessions)
**Pages tested:** 8 (/demo flow x7 steps, /auth, /, /record, /metrics)

## Summary

| Category | Score |
|----------|-------|
| Console | 100 (0 errors) |
| Links | 100 (0 broken) |
| Visual | 95 |
| Functional | 90 |
| UX | 90 |
| Performance | 100 |
| Content | 100 |
| Accessibility | 85 |
| **Overall** | **94/100** |

**Issues found:** 5
**Issues fixed:** 4
**Deferred:** 1

## Issues

### ISSUE-001 — Protected routes don't redirect (FIXED)
- **Severity:** HIGH
- **Category:** Functional
- **Page:** /record, /metrics, /review
- **Description:** Middleware used deprecated `middleware.ts` convention. Next.js 16 requires `proxy.ts` with `proxy` export.
- **Fix:** Renamed `middleware.ts` → `proxy.ts`, changed export to `default export proxy`.
- **Commit:** `65125a0`, `dcd741f`
- **Status:** verified

### ISSUE-002 — Auth button disabled state invisible (FIXED)
- **Severity:** MEDIUM
- **Category:** Visual
- **Page:** /auth
- **Description:** Disabled button used `opacity-40` making white text on amber nearly invisible.
- **Fix:** Changed to `bg-border text-muted` for clear disabled state.
- **Commit:** `1c4410d`
- **Status:** verified
- **Evidence:** screenshots/auth-empty.png (before), screenshots/auth-fixed.png (after)

### ISSUE-003 — Demo page select dropdowns broken on mobile (FIXED)
- **Severity:** CRITICAL
- **Category:** Functional
- **Page:** /demo
- **Description:** `<select>` elements didn't trigger React's `onChange` reliably on mobile Safari. Form type remained greyed out after picking rotation. Continue button never enabled.
- **Fix:** Replaced entire setup flow with step-by-step button lists. No dropdowns, no select elements, no onChange. Every interaction is a button tap.
- **Commit:** `ace695c`
- **Status:** verified
- **Evidence:** screenshots/qa-demo-01-initial.png through qa-demo-10-mobile.png

### ISSUE-004 — Raw transcript (PHI) exposed to client (FIXED)
- **Severity:** HIGH (security)
- **Category:** Security
- **Page:** /review/[id]
- **Description:** `transcript_raw` (pre-PHI-scrub) was fetched and shown as fallback if `transcript_clean` was null.
- **Fix:** Removed `transcript_raw` from client query. Only shows scrubbed transcript.
- **Commit:** `7d4e839`
- **Status:** verified

### ISSUE-005 — Supabase email rate limit (2/hour)
- **Severity:** MEDIUM
- **Category:** Functional
- **Page:** /auth
- **Description:** Supabase free tier limits magic link emails to 2 per hour. Cannot increase without custom SMTP.
- **Fix:** Deferred — requires Resend SMTP integration or Supabase Pro upgrade.
- **Status:** deferred

## Test Matrix — Demo Page (/demo)

| Test Case | Path | Result | Evidence |
|-----------|------|--------|----------|
| Initial load — rotation list renders | / → /demo | PASS | qa-demo-01-initial.png |
| Non-EM: rotation → preceptor → consent | IM → Sharma | PASS | qa-demo-02, 03 |
| EM: rotation → preceptor → form type picker | EM → Kim | PASS | qa-demo-04, 05 |
| EM: form type → consent | Daily Shift Eval | PASS | qa-demo-06 |
| Consent shows correct details | All paths | PASS | qa-demo-03, 06 |
| Recording screen with mic button | After consent | PASS | qa-demo-07 |
| "Start Over" resets to rotation | From consent | PASS | qa-demo-08 |
| "Back to rotations" link | From preceptor | PASS | qa-demo-09 |
| "Back to preceptors" link | From form type | PASS | — |
| Mobile viewport (375x812) | All steps | PASS | qa-demo-10 |
| Console errors | Full flow | 0 | — |

## Test Matrix — Auth Page (/auth)

| Test Case | Result | Evidence |
|-----------|--------|----------|
| Page loads with email input + button | PASS | auth-empty.png |
| Button disabled when empty (gray style) | PASS | auth-fixed.png |
| Button enables when email typed | PASS | auth-fill-test.png |
| Magic link sends successfully | PASS | auth-after-click.png |
| "Check your inbox" success state | PASS | auth-after-click.png |
| Mobile viewport | PASS | auth-mobile.png |
| Encryption footer text accurate | PASS | Verified: ca-central-1 |

## Test Matrix — Protected Routes

| Test Case | Result | Evidence |
|-----------|--------|----------|
| /record redirects to /auth | PASS | URL check: ends at /auth |
| /metrics redirects to /auth | PASS | URL check: ends at /auth |
| /review/nonexistent redirects to /auth | PASS | URL check: ends at /auth |
| / shows unauthenticated state | PASS | home.png |

## Screenshots

All screenshots saved in `.gstack/qa-reports/screenshots/`:

### Auth Page
- `auth-empty.png` — initial state, button disabled
- `auth-fixed.png` — after fix, clear gray disabled state
- `auth-fill-test.png` — email entered, button enabled (amber)
- `auth-after-click.png` — "Check your inbox!" success state
- `auth-mobile.png` — mobile viewport

### Home Page
- `home.png` — unauthenticated state with record button
- `home-mobile.png` — mobile viewport

### Demo Page Flow
- `qa-demo-01-initial.png` — rotation list
- `qa-demo-02-preceptor.png` — preceptor list (Internal Medicine selected)
- `qa-demo-03-consent.png` — consent (non-EM, auto Field Note)
- `qa-demo-04-em-preceptor.png` — preceptor list (EM selected)
- `qa-demo-05-em-formtype.png` — form type picker (EM only)
- `qa-demo-06-em-consent.png` — consent (EM, Daily Shift Eval)
- `qa-demo-07-recording-ready.png` — recording screen with mic button
- `qa-demo-08-startover.png` — after "Start Over" (back to rotations)
- `qa-demo-09-back.png` — after "Back to rotations" link
- `qa-demo-10-mobile.png` — mobile viewport

## Baseline

Health score: 94/100
