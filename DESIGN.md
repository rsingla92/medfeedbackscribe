# Design System — Debrief

## Product Context
- **What this is:** Voice-to-assessment platform that captures verbal preceptor feedback and auto-populates medical trainee assessment forms
- **Who it's for:** Medical residents (primary user), preceptors (data source), program directors (buyer)
- **Space/industry:** Medical education, health-tech, competency-based assessment
- **Project type:** Mobile-first web app (PWA)

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian — function-first, calm, data-dense but readable. A beautifully designed clipboard.
- **Decoration level:** Minimal — typography does the heavy lifting. No decorative elements, no gradients, no blobs.
- **Mood:** Warm, confident, professional. Feels like YOUR tool — not the institution's. Trustworthy without being clinical.
- **Reference sites:** Abridge (editorial warmth, serif headlines, restrained palette). NOT: One45/Acuity Insights (corporate, dated, institutional blue).

## Typography
- **Display/Hero:** Instrument Serif — warm, editorial feel. Sets Debrief apart from every sans-serif-only medical tool. Use for screen titles, hero text, stat values.
- **Body/UI:** DM Sans — clean, excellent readability at small sizes, medical-grade clarity. Use for all body text, labels, buttons.
- **Data/Tables:** Geist Mono — for timestamps, session IDs, confidence scores, durations. Use with `font-feature-settings: 'tnum'` for tabular numbers.
- **Code:** Geist Mono
- **Loading:** Google Fonts `family=DM+Sans:wght@300..700&family=Instrument+Serif:ital@0;1`
- **Scale:**
  - display-xl: 48px / 1.1 line-height (Instrument Serif)
  - display-lg: 36px / 1.2 (Instrument Serif)
  - display-md: 24px / 1.3 (Instrument Serif)
  - body-lg: 18px / 1.6 (DM Sans)
  - body-md: 15px / 1.6 (DM Sans)
  - body-sm: 13px / 1.5 (DM Sans)
  - mono: 13px / 1.5 (Geist Mono)
  - label: 11px / 1.4, uppercase, 1.5px letter-spacing (DM Sans)

## Color
- **Approach:** Restrained — one warm accent + neutrals. Color is rare and meaningful.
- **Primary accent:** #D97706 (Amber/Gold) — warm, confident, NOT clinical blue. Used sparingly: record button, status badges, CTAs, focus rings.
- **Accent light:** #FEF3C7 — hover backgrounds, focus rings, subtle highlights
- **Accent hover:** #B45309 — darkened accent for hover/active states
- **Background:** #FAFAF9 (Stone-50) — warm off-white, not sterile
- **Surface:** #FFFFFF — cards, modals, input backgrounds
- **Text primary:** #1C1917 (Stone-900) — warm near-black
- **Text muted:** #78716C (Stone-500) — secondary text, labels
- **Text subtle:** #78716C (Stone-500) — timestamps, placeholders, helper labels. Same value as muted because the original Stone-400 (#A8A29E) was 2.4:1 on background and failed WCAG AA. The lighter #A8A29E is preserved as `--text-subtle-decorative` for non-text uses only (dot indicators, dividers).
- **Border:** #E7E5E4 (Stone-200) — card borders, dividers
- **Border light:** #F5F5F4 (Stone-100) — subtle separators within cards
- **Semantic:**
  - Success: #16A34A (bg: #F0FDF4)
  - Warning: #D97706 (bg: #FFFBEB) — same as accent, contextual meaning. Reserved for *genuine* warnings: low-confidence fields, stuck pipeline, unsaved-changes banner.
  - Processing: #2563EB (bg: #DBEAFE) — async work in progress (uploading, transcribing, extracting). Visually distinct from warning amber so a resident can tell "still processing" from "your edits didn't save."
  - Error: #DC2626 (bg: #FEF2F2)
  - Info: #2563EB (bg: #EFF6FF)
- **Dark mode:** Invert surfaces (bg: #1C1917, surface: #292524). Reduce accent saturation 10%. Text flips to #FAFAF9. Use CSS custom properties for seamless toggle.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — mobile-first, needs breathing room for touch targets
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout
- **Approach:** Grid-disciplined — single column on mobile (primary), wider grid on tablet/desktop for metrics
- **Grid:** 1 column (mobile), 2 columns (metrics on tablet+)
- **Max content width:** 960px
- **Border radius:**
  - sm: 4px (tags, small badges)
  - md: 8px (buttons, inputs, alerts, toasts)
  - lg: 12px (cards, modals)
  - full: 9999px (pills, status badges, record button)

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms)
- **Usage:**
  - Button hover: background-color 150ms ease
  - Focus ring: box-shadow 150ms ease
  - Toast enter: slide-up + fade 250ms ease-out
  - Processing steps: sequential reveal 250ms ease-out (staggered 100ms)
  - Page transitions: none (instant navigation, mobile feel)

## Component Patterns

### Record Button
96px circle, amber accent (#D97706), white microphone icon. Centered. Box-shadow for depth: `0 4px 24px rgba(217, 119, 6, 0.3)`. Hover: scale 1.05 + deeper shadow. This is the most important element in the app.

### Session Cards
Compact card (surface background, 1px border, lg radius). Left: preceptor name (15px, 500 weight) + rotation/date (13px, muted). Right: status badge (pill shape, colored dot + label). Tap entire card to navigate.

### Status Badges
Pill shape (full radius). Colored dot (6px) + label text (12px, 500 weight).
- Processing: blue on light-blue bg (#DBEAFE) — uses `--processing` token
- Ready: green on green bg (#F0FDF4)
- Exported: muted on stone bg (#F5F5F4)

### Audio Player Bar
Sticky bottom bar. Dark play button (36px circle, accent), scrub bar (4px height, accent progress), mono timestamp. Always accessible during review scroll.

### Toast Notifications
Bottom-center. Dark background (#1C1917), white text, md radius. 5-second auto-dismiss. "View" action button right-aligned.

### Assessment Fields
Row layout: label (muted, left) + value (500 weight, right). 1px border-bottom between rows. Low-confidence fields: warning-bg highlight (#FFFBEB) + warning text color.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-26 | Initial design system created | Created by /design-consultation based on product context + competitive research (Abridge, Freed.ai, One45) |
| 2026-03-26 | Amber accent over blue | Blue disappears in clinical environments (scrubs, walls, EHR). Amber signals 'your tool, not the institution's.' |
| 2026-03-26 | Instrument Serif for display | Editorial warmth differentiates from every sans-serif medical SaaS. Pairs with DM Sans body for clear hierarchy. |
| 2026-03-26 | Minimal decoration | Lets feedback content be the visual focus. Residents are busy — don't waste their attention on decoration. |
