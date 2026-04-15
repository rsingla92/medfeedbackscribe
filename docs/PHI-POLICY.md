# Debrief PHI Policy

**Effective:** 2026-04-14
**Classification:** Internal — Engineering + Privacy

---

## 1. Overview

Debrief processes spoken medical trainee feedback that may incidentally contain Protected Health Information (PHI). This document describes the technical controls, data flows, and audit trail mechanisms used to protect PHI in compliance with PHIPA (Ontario), PIPA (BC), and the federal PIPEDA.

All PHI processing runs exclusively on **Canadian infrastructure** (Supabase `ca-central-1` + Vertex AI `northamerica-northeast1` / Montreal). No PHI is sent to US-based services.

---

## 2. Threat Model

Preceptors give verbal feedback about a trainee's *clinical skills*, not about any specific patient. However, they sometimes accidentally include patient-identifying information — e.g., "remember patient Mr. Smith in room 214 last Tuesday."

**Goal:** Ensure that any incidentally disclosed PHI is scrubbed before the transcript is:
1. Stored as the `transcript_clean` field in Supabase
2. Used for assessment extraction
3. Included in email notifications

The `transcript_raw` field intentionally retains the original audio transcript and is protected by Row-Level Security (only accessible to the session owner).

---

## 3. PHI Scrubbing Architecture (Belt-and-Suspenders)

```
audio file (raw bytes, never logged)
    │
    ▼
Gemini STT — northamerica-northeast1 (Montreal)
    │   raw transcript
    ▼
[PASS 1] regexScrub()  — deterministic, synchronous, no external calls
    │   partially de-identified text
    ▼
[PASS 2] Gemini PHI scrub — contextual pass (names, implicit identifiers)
    │   contextually de-identified text
    ▼
[PASS 3] regexScrub()  — second deterministic pass
    │   If PASS 3 finds additional PHI → logged as WARNING (Gemini drift signal)
    ▼
transcript_clean (stored in Supabase)
    │
    ▼
Gemini extraction — structured assessment fields (no PHI expected at this point)
```

**Why two regex passes?**
- PASS 1 ensures Gemini never sees raw phone numbers, MRNs, dates, etc. in its context window.
- PASS 3 acts as a deterministic safety net in case Gemini hallucinated PHI back into the output or missed something. Any hits in PASS 3 are logged with `console.warn` tagged `[phi-belt-and-suspenders]` for monitoring.

---

## 4. PHI Categories Covered

### HIPAA 18 Identifiers (plus Canadian additions)

| # | Category | Regex Label | Notes |
|---|---|---|---|
| 1 | Names with titles | `[REDACTED-NAME]` | Dr., Mr., Mrs., Ms., Prof. + capitalized last name |
| 2 | Geographic sub-province | `[REDACTED-ADDRESS]`, `[REDACTED-LOCATION]`, `[REDACTED-POSTAL]` | Street addresses, postal codes, hospital identifiers |
| 3 | Dates (except year) | `[REDACTED-DATE]`, `[REDACTED-DOB]` | MM/DD/YYYY, YYYY-MM-DD, full month names (EN + FR) |
| 4 | Phone numbers | `[REDACTED-PHONE]` | NA format: (NNN) NNN-NNNN, NNN-NNN-NNNN, NNN.NNN.NNNN, +1... |
| 5 | Fax numbers | `[REDACTED-FAX]` | Same patterns as phones, optionally prefixed "Fax:" |
| 6 | Email addresses | `[REDACTED-EMAIL]` | Standard RFC 5321 pattern |
| 7 | SSN (US) | `[REDACTED-SSN]` | NNN-NN-NNNN (strict 3-2-4 grouping) |
| 7a | SIN (Canadian) | `[REDACTED-SIN]` | NNN-NNN-NNN or NNN NNN NNN (3-3-3 grouping) |
| 8 | MRN | `[REDACTED-MRN]` | "MRN:", "Chart #", "Patient #", BC-style letter+digits |
| 9 | Health plan numbers | `[REDACTED-POLICY]` | Keyword + alphanumeric ≥6 chars |
| 10 | Account numbers | `[REDACTED-ACCOUNT]` | "Account", "Acct", "Policy" + digits |
| 11 | Certificate / license numbers | `[REDACTED-LICENSE]` | Driver's license, professional license, medical license |
| 12 | Vehicle identifiers | `[REDACTED-VIN]`, `[REDACTED-LICENSE-PLATE]` | 17-char VIN; plate near keyword |
| 13 | Device identifiers | `[REDACTED-DEVICE-ID]` | "Device ID", "Serial Number", "Implant ID" near keyword |
| 14 | URLs | `[REDACTED-URL]` | https://, www., bare domains |
| 15 | IP addresses | `[REDACTED-IP]` | IPv4 and IPv6 |
| 16 | Biometric identifiers | N/A (regex) | Listed in Gemini prompt; not expected in audio transcripts |
| 17 | Photographic images | N/A | Not applicable to audio transcripts |
| 18 | Other unique identifiers | `[REDACTED-PHI]` | Catch-all in Gemini prompt |

### Canadian-Specific Additions

| Identifier | Regex Label | Pattern |
|---|---|---|
| BC PHN (10 digits) | `[REDACTED-PHN-BC]` | "PHN:" or "Health Card:" + 10 digits |
| OHIP (Ontario) | `[REDACTED-OHIP]` | NNNN-NNN-NNN-XX |
| Quebec RAMQ | `[REDACTED-RAMQ]` | LLLL NNNN NNNN |
| Alberta PHN | `[REDACTED-PHN-AB]` | "AB-PHN" / "Alberta Health" + 9 digits |
| Generic provincial health card | `[REDACTED-HEALTH-CARD]` | NNNN-NNN-NNN pattern |
| Canadian postal codes | `[REDACTED-POSTAL]` | A1A 1A1 or A1A1A1 |
| Major hospital identifiers | `[REDACTED-HOSPITAL]` | VGH, BCCH, RCH, TGH, SickKids, CHUM, MUHC, Foothills, Stollery, etc. |
| Room / bed numbers | `[REDACTED-ROOM]` | "Room", "Bed", "Ward" + number |

---

## 5. Gemini PHI Prompt Summary

The Gemini contextual PHI scrub pass is given an explicit system-level prompt that:

1. Lists all 18 HIPAA categories plus Canadian additions, each with its `[REDACTED-*]` tag.
2. Explicitly instructs NOT to redact: preceptor/trainee names, medical eponyms (Crohn disease, Down syndrome, Parkinson's), medical terminology, diagnoses, procedures, general "the patient" references, or year-only references.
3. Provides six few-shot examples (3 English, 3 French/Québécois) demonstrating correct input → output behaviour.
4. Demands ONLY the scrubbed transcript as output (no preamble, no commentary).

---

## 6. Audit Trail Format

Each redaction is visible in the stored `transcript_clean` field via inline `[REDACTED-CATEGORY]` markers. This provides:

- **Auditor visibility:** A human reviewer can see how many and what categories of PHI were detected.
- **Downstream safety:** Any downstream text (extraction prompt, email summary) that still contains `[REDACTED-*]` markers is safe to process.
- **Drift detection:** If PASS 3 (post-Gemini regex) finds markers, a `[phi-belt-and-suspenders]` warning is logged to the server console with the category breakdown. This signals Gemini prompt degradation and requires investigation.

Pipeline redaction counts are also logged to the `pipeline_logs` table:
```json
{ "step": "phi_scrub", "status": "completed", "metadata": { "redactions": 4, "provider": "gemini" } }
```

---

## 7. Residency Posture (All-Canadian Compute)

| Component | Service | Region |
|---|---|---|
| Database + Auth + Storage | Supabase | ca-central-1 (Montreal/Toronto) |
| STT (audio transcription) | Vertex AI Gemini 2.5 Flash | northamerica-northeast1 (Montreal) |
| PHI scrubbing | Vertex AI Gemini 2.5 Flash | northamerica-northeast1 (Montreal) |
| Assessment extraction | Vertex AI Gemini 2.5 Flash | northamerica-northeast1 (Montreal) |
| Email (assessment summaries) | Resend | US (summaries are PHI-scrubbed before sending) |
| Web hosting | Vercel | yul1 (Montreal) |

**Note on Resend:** Email notifications contain the `narrative_summary` and `coaching_*` fields extracted from the *already-scrubbed* transcript. These fields should not contain PHI. However, PHI in these fields is a residual risk that requires ongoing monitoring.

---

## 8. French / Québécois Handling

Gemini 2.5 Flash natively supports Canadian French (Québécois). The following controls are in place:

- **STT prompt:** Explicitly instructs Gemini to transcribe in "Canadian French (Quebec)" when `language = "fr"`.
- **PHI scrub prompt:** Includes three French few-shot examples demonstrating correct redaction of French names (M. Tremblay), French dates (5 janvier 2024), and RAMQ numbers.
- **Extraction prompt:** Notes that the transcript may be in English or Canadian French, and instructs Gemini to extract faithfully from either language.
- **Regex:** French month names (janvier through décembre) are included in the date pattern.

**Production cutover decision (2026-04-14):** French transcription and extraction are in full production. The user has explicitly accepted the residual quality risk of LLM translation/extraction for French medical terminology. No separate French spot-check gate is required. French quality should be monitored via normal assessment review workflow (resident reviews all output before export).

---

## 9. Not-Covered / Residual Risks

1. **Preceptor/trainee names** — The regex does not redact names without a title prefix. Gemini's contextual pass handles this. If Gemini misses a name, PASS 3 will not catch it (no deterministic pattern for arbitrary names). Resident review is the final gate.
2. **Novel PHI patterns** — New Canadian province health card formats or hospital codes not yet in the pattern list. These can be added to `phi-scrub.ts` without any Gemini prompt changes.
3. **Biometric identifiers** — Unlikely in audio feedback transcripts; covered by Gemini prompt only.
4. **Email summary PHI leakage** — If Gemini fails to extract a clean `narrative_summary` (unlikely but possible), the email may contain some PHI. Monitoring `pipeline_logs` and Resend delivery reports is recommended.

---

## 10. Updating This Policy

When adding new PHI patterns:
1. Add the regex to `app/src/lib/pipeline/phi-scrub.ts` in the `PATTERNS` array with a new `[REDACTED-CATEGORY]` label.
2. Add the category to the table in Section 4 of this document.
3. Add ≥3 test cases to `app/tests/unit/phi-scrub.test.ts` for the new category.
4. Update the Gemini PHI prompt in `app/src/lib/pipeline/gemini.ts` to list the new category.
