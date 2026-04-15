# Debrief

## Project
AI-powered voice-to-assessment platform for medical trainee feedback. Residents capture verbal preceptor feedback, which gets transcribed and auto-populates required assessment forms.

## Tech Stack
- Frontend: Next.js 16 (App Router), React 19, Tailwind CSS 4, PWA
- Backend: Supabase (Postgres, Auth, Storage) — all in ca-central-1
- STT + LLM: Gemini 2.5 Flash via Vertex AI (northamerica-northeast1 — Montreal) for STT, PHI scrubbing + assessment extraction
- Email: Resend (transactional)
- Testing: Vitest + Testing Library (268 tests)

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Key Design Decisions
- Amber accent (#D97706), not blue — warm, personal, not clinical
- Instrument Serif for headlines, DM Sans for body, Geist Mono for data
- Minimal decoration — content is the visual focus
- Mobile-first single-column layout

## Architecture
- Async pipeline: recording → upload → background processing → toast notification when ready
- PHI scrubbing: belt-and-suspenders — regex first (26 pattern groups, all 18 HIPAA + Canadian), then Gemini contextual, then regex again. All on Canadian infrastructure.
- One recording per trainee (no multi-trainee splitting)
- Resident is the quality gate — reviews all LLM output before export
- French/Québécois: production cutover complete — Gemini handles both languages natively

## Testing
- Run tests: `bun run test`
- Vitest for unit tests (14 tests in app/tests/unit/)
- Tests cover PHI scrubbing and LLM extraction
- Playwright for E2E (planned)
- Custom eval harness for LLM extraction accuracy (planned)
