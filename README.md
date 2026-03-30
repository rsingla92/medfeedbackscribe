# Debrief by Whitecoat Prep

**Talk first. Forms second.**

AI-powered voice-to-assessment platform for medical trainee feedback. Preceptors speak. Residents get structured feedback in minutes, not months.

## Problem

Supervising physicians give rich verbal feedback after clinical encounters but rarely fill out the required assessment forms. They earn $200+/hr and won't spend 5-10 minutes on a form that returns zero value to them. Residents wait weeks for written feedback, often self-fill their own evaluations, and training programs have incomplete, low-quality competency data. The assessment record is, in many cases, fiction.

## How It Works

1. **Record** — Resident taps record. Preceptor speaks for 1-2 minutes.
2. **Transcribe** — Audio transcribed via Deepgram (English + French).
3. **De-identify** — PHI scrubbed with regex pass, then Claude contextual pass.
4. **Extract** — Claude maps verbal feedback to structured assessment fields (CanMEDS competencies, domains of care, coaching notes).
5. **Review** — Resident reviews, edits, and exports as PDF or One45-compatible CSV.

The preceptor does nothing extra. They just talk, like they already do. The resident is the user and the quality gate.

## Features

- **Multi-form support** — T-Res Field Notes (1-5 per conversation) and One45 Daily Evaluations
- **PHI protection** — Dual-pass scrubbing (regex + LLM) before any data is stored
- **CanMEDS mapping** — Auto-tags skill dimensions, domains of care, priority topics
- **French language** — Full STT + extraction support
- **Preceptor email** — Auto-sends feedback summary to the preceptor after export
- **One45 CSV export** — Compatible with institutional reporting workflows
- **Pilot metrics** — Admin dashboard showing completion rates and turnaround times
- **Canadian data residency** — All data encrypted (AES-256) and stored in Canada (ca-central-1)

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, PWA
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions) in `ca-central-1`
- **Speech-to-Text:** Deepgram (nova-2-medical)
- **LLM:** Claude (Anthropic) for PHI scrubbing + assessment extraction
- **Email:** Resend (transactional)
- **Testing:** Vitest + Testing Library (14 unit tests)

## Getting Started

Prerequisites: [Bun](https://bun.sh), a [Supabase](https://supabase.com) project in ca-central-1, API keys for [Deepgram](https://deepgram.com), [Anthropic](https://console.anthropic.com), and optionally [Resend](https://resend.com).

```bash
git clone https://github.com/rsingla92/medfeedbackscribe.git
cd medfeedbackscribe/app
bun install
```

Set up Supabase:

```bash
supabase link --project-ref <your-project-ref>
supabase db push    # applies migrations
```

Seed the database with pilot data (preceptors, rotations, form templates):

```bash
# Run supabase/seed.sql via the Supabase Dashboard SQL Editor
# or via the Management API
```

Configure environment variables:

```bash
cp .env.local.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#          DEEPGRAM_API_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY (optional)
```

Run locally:

```bash
bun run dev           # development (hot reload)
bun run build && bun run start  # production
```

## Project Structure

```
medfeedbackscribe/
├── app/                        # Next.js application
│   ├── src/
│   │   ├── app/                # App Router pages + API routes
│   │   │   ├── api/process/    # Async pipeline trigger
│   │   │   ├── api/export/     # PDF + CSV export
│   │   │   ├── auth/           # Magic link login + callback
│   │   │   ├── demo/           # Demo page (no auth required)
│   │   │   ├── record/         # Audio recording flow
│   │   │   ├── review/[id]/    # Assessment review + audio player
│   │   │   └── metrics/        # Pilot stats dashboard
│   │   └── lib/
│   │       ├── pipeline/       # STT → PHI scrub → LLM extraction
│   │       ├── supabase/       # Client, server, middleware helpers
│   │       ├── templates/      # Form templates (T-Res, One45)
│   │       └── email.ts        # Resend integration
│   ├── supabase/
│   │   ├── migrations/         # Database schema (7 tables + RLS)
│   │   └── seed.sql            # Pilot seed data
│   └── tests/                  # Vitest unit tests
├── data/                       # Reference forms (T-Res, One45, Entrada, EPAs)
├── docs/
│   ├── designs/                # Design doc + CEO plan
│   ├── wireframes/             # Landing page + record flow HTML wireframes
│   ├── TODOS.md                # Tracked future work
│   ├── DEPLOY-VERCEL.md        # Deployment guide
│   ├── DEPLOYMENT-OPTIONS.md   # Hosting comparison
│   └── SETUP-RESEND.md         # Email setup guide
├── DESIGN.md                   # Design system (read before touching UI)
├── CLAUDE.md                   # AI assistant context
└── specifications.md           # Original spec (historical)
```

## Design System

See [DESIGN.md](./DESIGN.md). Key choices:

- **Instrument Serif** for headlines, **DM Sans** for body, **Geist Mono** for data
- Amber accent (`#D97706`) — warm and confident, not clinical blue
- Mobile-first, minimal decoration — content is the visual focus
- [Design system preview](./docs/wireframes/design-system-preview.html) with light/dark toggle

## Testing

```bash
bun run test        # 14 unit tests
```

Tests cover PHI regex scrubbing (8 tests) and LLM extraction prompt construction (6 tests). Prompt engineering spike verified 5/5 transcript types pass (brief, detailed, multi-encounter, vague, French).

## Demo

The `/demo` page works without authentication. Use it for PD meetings and stakeholder demos. It records real audio but uses simulated processing.

## Deployment

See [docs/DEPLOY-VERCEL.md](./docs/DEPLOY-VERCEL.md). Configured for Vercel Montreal region (`yul1`) with 120-second function timeout for the processing pipeline.

## Status

Piloting with UBC Family Medicine. Built by a resident who lived the problem.

## License

MIT. See [LICENSE.txt](./LICENSE.txt).
