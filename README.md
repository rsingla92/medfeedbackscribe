# MedScribe

AI-powered voice-to-assessment platform for medical trainee feedback.

## Problem

Preceptors give detailed verbal feedback after clinical encounters but rarely fill out the required assessment forms. They earn $200+/hr and won't spend 5-10 minutes on a form that returns zero value to them. The result: residents wait weeks to months for written feedback, often self-fill their own evaluations, and training programs end up with incomplete, low-quality competency data. The assessment record is, in many cases, fiction.

## How It Works

1. Resident hits record during or after verbal feedback from a preceptor
2. Audio is transcribed via Deepgram (English + French)
3. PHI is scrubbed (regex pass, then LLM contextual pass)
4. Claude extracts structured assessment data (CanMEDS competencies, EPA stages, milestones)
5. Resident reviews and edits the extracted assessment before export

The preceptor does nothing — they just talk. The resident is the user and the quality gate.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, PWA
- **Backend:** Supabase (Postgres, Auth, Storage) in `ca-central-1`
- **Speech-to-Text:** Deepgram
- **LLM:** Claude (Anthropic) for PHI scrubbing + assessment extraction
- **Email:** Resend (transactional)
- **Testing:** Vitest + Testing Library

## Getting Started

Prerequisites: [Bun](https://bun.sh), a Supabase project, API keys for Deepgram, Anthropic, and Resend.

```bash
git clone https://github.com/rsingla92/medfeedbackscribe.git
cd medfeedbackscribe/app
bun install
```

Set up Supabase:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase db seed
```

Configure environment variables:

```bash
cp .env.local.example .env.local
# Fill in your API keys
```

Run locally:

```bash
bun run dev
```

Production build:

```bash
bun run build && bun run start
```

## Project Structure

```
medfeedbackscribe/
├── app/                    # Next.js application
│   ├── src/
│   │   ├── app/            # App Router pages + API routes
│   │   │   ├── api/        # Backend API routes
│   │   │   ├── auth/       # Auth flows (magic link)
│   │   │   ├── demo/       # Demo page (no auth required)
│   │   │   ├── record/     # Audio recording UI
│   │   │   ├── review/     # Assessment review + editing
│   │   │   └── metrics/    # Analytics dashboard
│   │   └── lib/            # Shared utilities
│   │       ├── pipeline/   # STT → PHI scrub → LLM extraction
│   │       ├── supabase/   # Supabase client helpers
│   │       ├── templates/  # Assessment form templates
│   │       └── email.ts    # Resend integration
│   ├── supabase/
│   │   ├── migrations/     # Database schema migrations
│   │   └── seed.sql        # Seed data
│   └── tests/              # Vitest unit tests
├── docs/                   # Design docs, TODOs, pilot design
├── data/                   # Reference data
├── DESIGN.md               # Design system (read before touching UI)
└── specifications.md       # Original product spec
```

## Design System

See [DESIGN.md](./DESIGN.md) for the full design system. Key choices:

- **Instrument Serif** for headlines, **DM Sans** for body, **Geist Mono** for data
- Amber accent (`#D97706`) — warm, not clinical blue
- Mobile-first single-column layout, max 960px content width
- Minimal decoration — content is the visual focus

## Demo

The `/demo` page works without authentication. Use it for PD meetings and stakeholder demos.

## License

MIT. See [LICENSE.txt](./LICENSE.txt).
