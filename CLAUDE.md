# MedScribe

## Project
AI-powered voice-to-assessment platform for medical trainee feedback. Residents capture verbal preceptor feedback, which gets transcribed and auto-populates required assessment forms.

## Tech Stack
- Frontend: Next.js (App Router) PWA
- Backend: Supabase (Postgres, Auth, Storage, Edge Functions) — all in ca-central-1
- STT: Deepgram API (English + French)
- LLM: Claude (Anthropic) for PHI scrubbing + assessment extraction
- Email: Resend (transactional)

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
- PHI scrubbing: regex first (fast), then LLM pass (contextual)
- One recording per trainee (no multi-trainee splitting)
- Resident is the quality gate — reviews all LLM output before export

## Testing
- Vitest for unit tests
- Playwright for E2E
- Custom eval harness for LLM extraction accuracy
