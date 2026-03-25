# TODOS — MedScribe

## Resident Self-Reflection Prompt

**What:** After recording, before showing the preceptor's assessment, prompt the resident to self-rate on each competency area. Show preceptor assessment side-by-side with self-assessment.

**Why:** Gaps between self-perception and preceptor perception are pedagogically powerful — this is what CBME literature says drives growth. Also produces unique data for PDs (e.g., "residents who overestimate physical exam skills by 2+ levels").

**Pros:** Differentiating feature no competitor has. Aligned with CBME literature. Produces actionable analytics.
**Cons:** Adds a step to the core flow. May reduce adoption if residents find it tedious after a long shift.

**Context:** Deferred from CEO review cherry-pick ceremony. The core flow must be validated first — if residents aren't using the tool consistently, adding friction won't help. Build this after pilot data shows consistent adoption (>70% completion rate).

**Effort:** M (human) → S with CC (~1-2 hours)
**Priority:** P2
**Depends on:** Validated pilot adoption

## University SSO (UBC CWL / Shibboleth)

**What:** Replace magic link auth with institutional Single Sign-On via UBC Campus-Wide Login (CWL) or Shibboleth for both residents and PDs.

**Why:** Magic links work for a pilot with 5-10 users, but program-wide adoption requires institutional auth for security, compliance, and user management. PDs will need SSO when the dashboard ships.

**Pros:** Institutional trust. No password management. Automatic user provisioning from university directory.
**Cons:** Shibboleth integration is non-trivial. Requires institutional IT cooperation. Each university has different IdP configuration.

**Context:** User explicitly requested this as a future requirement. Build when expanding beyond pilot to program-wide adoption at UBC. Will need to be repeated per-university for multi-school expansion.

**Effort:** M (human) → S with CC
**Priority:** P2
**Depends on:** Post-pilot expansion approval from PD

## iOS Safari PWA Offline Reliability

**What:** Investigate and address known issues with IndexedDB persistence in iOS Safari PWAs. Audio recordings queued for offline upload may be lost if Safari evicts IndexedDB data.

**Why:** Outside voice flagged that iOS Safari has known reliability issues with PWA offline storage. Many residents will be on iPhones.

**Pros:** Prevents lost recordings on the most common device in the target population.
**Cons:** May require a native app wrapper (Capacitor/Expo) or "use Chrome on iOS" guidance, both of which add complexity.

**Context:** For the pilot with 5-10 users, this can be mitigated with user guidance ("ensure WiFi before recording" or "use Chrome"). For scale, needs a real fix.

**Effort:** S with CC (investigation) → M if native wrapper needed
**Priority:** P3
**Depends on:** Pilot user feedback on device/browser distribution
