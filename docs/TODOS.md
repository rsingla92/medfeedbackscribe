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

## Bias Detection in Feedback

**What:** Flag potentially biased language in preceptor feedback (gendered language, loaded terms, culturally-insensitive phrasing). Surface bias flags to PDs in aggregate analytics.

**Why:** Medical education literature documents bias in trainee assessment. Detecting it programmatically is a differentiator and aligns with EDI initiatives at Canadian medical schools. Original specifications.md included this as a core feature.

**Pros:** Unique feature no competitor offers. Aligns with institutional EDI priorities. Could be a selling point for PDs.
**Cons:** Bias detection is hard to get right. False positives erode trust. Requires careful calibration and potentially a review/appeal workflow. Sensitive topic — needs buy-in from program leadership.

**Context:** Deferred from pilot. Build after core feedback capture is validated and there's enough data to calibrate detection thresholds. The LLM extraction pipeline already processes the transcript — adding a bias analysis pass is architecturally cheap. The hard part is the UX: how to surface findings without creating defensiveness in preceptors.

**Effort:** M (human) → S with CC (~2-3 hours for detection; M for review/appeal UX)
**Priority:** P3
**Depends on:** Validated pilot adoption, PD buy-in on EDI integration

## Stripe Subscription / Payment

**What:** Add Stripe-based payment for program-level subscriptions. Per-program or per-resident SaaS pricing.

**Why:** The pilot is free (direct invoicing to UBC FM PD). For multi-program / multi-school expansion, need self-serve payment. Original specifications.md included Stripe integration.

**Pros:** Enables scalable revenue. Self-serve onboarding for new programs without manual invoicing.
**Cons:** Adds billing complexity. Healthcare procurement often prefers purchase orders / invoicing over credit card billing. May need both Stripe AND manual invoicing.

**Context:** For pilot: free. For post-pilot UBC-wide: direct invoice to the program. Stripe makes sense only when expanding beyond UBC to other schools where you don't have a direct PD relationship. Build when there are 3+ paying programs.

**Effort:** M (human) → S with CC
**Priority:** P3
**Depends on:** Multi-program expansion beyond UBC FM
