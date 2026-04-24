/**
 * PHI Scrubbing — Regex Pass (defense-in-depth layer 1)
 *
 * Covers all 18 HIPAA identifiers plus Canadian-specific additions
 * (SIN, provincial health card numbers, postal codes, hospital identifiers).
 *
 * Architecture: regex always runs BEFORE and AFTER the Gemini contextual pass.
 *   raw transcript
 *       │
 *       ▼
 *   regexScrub()   ← fast, deterministic, catches structured patterns
 *       │
 *       ▼
 *   Gemini PHI scrub  ← contextual (names, implicit identifiers)
 *       │
 *       ▼
 *   regexScrub()   ← belt-and-suspenders: catches anything Gemini missed
 *       │
 *       ▼
 *   clean transcript
 *
 * Each pattern replaces with [REDACTED-CATEGORY] for audit trail visibility.
 * Return value includes per-category redaction counts.
 */

export interface RedactionEntry {
  pattern: string; // e.g. "[REDACTED-PHONE]"
  count: number;
}

export interface ScrubResult {
  text: string;
  redactions: RedactionEntry[];
}

// ---------------------------------------------------------------------------
// Pattern registry
// Each entry: [regex, label]
// Order matters — more specific patterns before generic catch-alls
// ---------------------------------------------------------------------------

type PatternEntry = [RegExp, string];

const PATTERNS: PatternEntry[] = [
  // ── 1. Names with titles (Mr., Mrs., Ms., Dr.) ──────────────────────────
  // Catches "Dr. Smith", "Mr. Jones", "Mrs. O'Brien"
  [
    /\b(?:Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s+[A-Z][a-zA-Z''-]{1,30}(?:\s+[A-Z][a-zA-Z''-]{1,30})?\b/g,
    "[REDACTED-NAME]",
  ],

  // ── 2. Phone numbers (North American) ────────────────────────────────────
  // (NNN) NNN-NNNN, NNN-NNN-NNNN, NNN.NNN.NNNN, +1NNNNNNNNNN, 1-NNN-NNN-NNNN
  [
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]\d{4}\b/g,
    "[REDACTED-PHONE]",
  ],

  // ── 3. Fax numbers (same patterns, often prefixed) ───────────────────────
  [
    /\b[Ff]ax\s*:?\s*(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]\d{4}\b/g,
    "[REDACTED-FAX]",
  ],

  // ── 4. Email addresses ───────────────────────────────────────────────────
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED-EMAIL]"],

  // ── 5. US Social Security Numbers ────────────────────────────────────────
  // NNN-NN-NNNN (strict format — 3-2-4)
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED-SSN]"],

  // ── 6. Canadian Social Insurance Number (SIN) ────────────────────────────
  // NNN-NNN-NNN or NNN NNN NNN (but not SSN above — different grouping)
  [/\b\d{3}[-\s]\d{3}[-\s]\d{3}\b/g, "[REDACTED-SIN]"],

  // ── 7. Medical Record Numbers (MRN) ──────────────────────────────────────
  // MRN: digits, Chart #digits, letter+digits patterns common in BC/ON
  [
    /\b(?:MRN|M\.R\.N\.?|Chart\s*#|Patient\s*#|File\s*#)\s*:?\s*[A-Z0-9][-\s]?[0-9]{4,10}\b/gi,
    "[REDACTED-MRN]",
  ],
  // BC-style: letter + 3 digits + optional dash + 4+ digits (e.g. C123-4567)
  [/\b[A-Z]\d{3}[-\s]?\d{4,}\b/g, "[REDACTED-MRN]"],

  // ── 8. Dates (except year-only) ──────────────────────────────────────────
  // DOB / date of birth keyword variants first
  [
    /\b(?:DOB|D\.O\.B\.?|[Dd]ate\s+of\s+[Bb]irth|[Bb]orn)\s*:?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,
    "[REDACTED-DOB]",
  ],
  // Full dates: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
  [
    /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g,
    "[REDACTED-DATE]",
  ],
  // Month name dates (English + French): "Jan 15, 2024", "15 January 2024", "5 janvier 2024"
  [
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre)\.?\s+\d{1,2},?\s+\d{4}\b/gi,
    "[REDACTED-DATE]",
  ],
  [
    /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre)\.?\s+\d{4}\b/gi,
    "[REDACTED-DATE]",
  ],

  // ── 9. BC Personal Health Number (PHN) — 10 digits ───────────────────────
  [/\b(?:PHN|[Hh]ealth\s+[Cc]ard)\s*:?\s*\d{10}\b/g, "[REDACTED-PHN-BC]"],

  // ── 10. OHIP (Ontario) — NNNN-NNN-NNN-XX ────────────────────────────────
  [/\b\d{4}-\d{3}-\d{3}-[A-Z]{2}\b/g, "[REDACTED-OHIP]"],

  // ── 11. Quebec RAMQ — LLLL NNNN NNNN (4 letters + 8 digits) ─────────────
  [/\b[A-Z]{4}\s?\d{4}\s?\d{4}\b/g, "[REDACTED-RAMQ]"],

  // ── 12. Alberta / Manitoba PHN (9 digits) ────────────────────────────────
  [/\b(?:AB-?PHN|[Aa]lberta\s+[Hh]ealth|AHCIP)\s*:?\s*\d{9}\b/gi, "[REDACTED-PHN-AB]"],

  // ── 13. Generic provincial health card (NNNN-NNN-NNN or 10 digit block) ──
  // This is a catch-all for health card patterns not covered above
  [/\b\d{4}[-\s]?\d{3}[-\s]?\d{3}\b/g, "[REDACTED-HEALTH-CARD]"],

  // ── 14. Canadian postal codes ────────────────────────────────────────────
  // A1A 1A1 or A1A1A1 — small postal code areas (<20k pop) are PHI per PHIPA
  [/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/g, "[REDACTED-POSTAL]"],

  // ── 15. Street addresses ─────────────────────────────────────────────────
  [
    /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+)?(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Dr(?:ive)?|Rd|Road|Cres(?:cent)?|Way|Pl(?:ace)?|Lane|Ln|Court|Ct|Terrace|Terr|Circle|Cir|Trail|Trl)\b\.?/gi,
    "[REDACTED-ADDRESS]",
  ],

  // ── 16. URLs ─────────────────────────────────────────────────────────────
  [/https?:\/\/[^\s\]"'>]+/g, "[REDACTED-URL]"],
  [/www\.[a-zA-Z0-9-]{2,}\.[a-zA-Z]{2,}[^\s]*/g, "[REDACTED-URL]"],

  // ── 17. IP addresses (IPv4) ───────────────────────────────────────────────
  [
    /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    "[REDACTED-IP]",
  ],

  // ── 18. IPv6 addresses ───────────────────────────────────────────────────
  [/\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g, "[REDACTED-IP]"],

  // ── 19. Account numbers (keyword + digits) ────────────────────────────────
  [
    /\b(?:[Aa]ccount|[Aa]cct|[Pp]olicy|[Pp]lan)\s*(?:#|number|no\.?)?\s*:?\s*[A-Z0-9]{6,20}\b/g,
    "[REDACTED-ACCOUNT]",
  ],

  // ── 20. Health plan / policy numbers ────────────────────────────────────
  [
    /\b(?:[Hh]ealth\s+[Pp]lan|[Ii]nsurance\s+[Pp]olicy|[Bb]eneficiary)\s*(?:#|number|no\.?)?\s*:?\s*[A-Z0-9]{6,20}\b/g,
    "[REDACTED-POLICY]",
  ],

  // ── 21. Vehicle Identification Numbers (VIN) — 17 alphanumeric ──────────
  [/\b[A-HJ-NPR-Z\d]{17}\b/g, "[REDACTED-VIN]"],

  // ── 22. License plates (near keyword) ────────────────────────────────────
  [
    /\b(?:[Ll]icense\s+[Pp]late|[Ll]icence\s+[Pp]late|[Pp]late)\s*:?\s*[A-Z0-9]{4,8}\b/g,
    "[REDACTED-LICENSE-PLATE]",
  ],

  // ── 23. Driver's / professional license numbers ───────────────────────────
  [
    /\b(?:[Dd]river'?s?\s+[Ll]icen[cs]e|[Pp]rofessional\s+[Ll]icen[cs]e|[Mm]edical\s+[Ll]icen[cs]e)\s*(?:#|number|no\.?)?\s*:?\s*[A-Z0-9]{5,20}\b/g,
    "[REDACTED-LICENSE]",
  ],

  // ── 24. Device identifiers (near keyword) ────────────────────────────────
  [
    /\b(?:[Dd]evice\s+[Ii][Dd]|[Ss]erial\s+[Nn]umber|[Ii]mplant\s+[Ii][Dd])\s*:?\s*[A-Z0-9]{6,20}\b/g,
    "[REDACTED-DEVICE-ID]",
  ],

  // ── 25. Hospital identifiers (major Canadian hospitals) ──────────────────
  // Note: keep "hospital" as a generic word — only redact specific named ones
  [
    /\b(?:VGH|BCCH|RCH|SPH|MSJ|Mount\s+Saint\s+Joseph|BC\s+Children'?s|BC\s+Women'?s|St\.\s+Paul'?s|TGH|Toronto\s+General|SickKids|Mt\.\s+Sinai|Mount\s+Sinai|Sunnybrook|CHUM|Sainte-Justine|MUHC|Royal\s+Victoria|Foothills|Stollery|QEII|Victoria\s+General|Civic\s+Hospital|Ottawa\s+Civic)\b/g,
    "[REDACTED-HOSPITAL]",
  ],

  // ── 26. Room / bed numbers ───────────────────────────────────────────────
  [
    /\b(?:[Rr]oom|[Bb]ed|[Ww]ard)\s*(?:#|number|no\.?)?\s*:?\s*\d{1,5}[A-Z]?\b/g,
    "[REDACTED-ROOM]",
  ],
];

/**
 * Regex-based PHI scrubbing pass (synchronous, no external calls).
 *
 * @returns ScrubResult with the cleaned text and a per-category redaction log.
 */
export function regexScrub(transcript: string): ScrubResult {
  let scrubbed = transcript;
  // Aggregate by label so duplicate patterns (e.g. two MRN entries) merge cleanly
  const countByLabel: Map<string, number> = new Map();

  for (const [pattern, label] of PATTERNS) {
    // Reset lastIndex for global regexes (safety for reuse across calls)
    pattern.lastIndex = 0;
    const matches = scrubbed.match(pattern);
    if (matches && matches.length > 0) {
      countByLabel.set(label, (countByLabel.get(label) ?? 0) + matches.length);
      scrubbed = scrubbed.replace(pattern, label);
    }
    pattern.lastIndex = 0;
  }

  const redactions: RedactionEntry[] = Array.from(countByLabel.entries()).map(
    ([pattern, count]) => ({ pattern, count })
  );

  return { text: scrubbed, redactions };
}
