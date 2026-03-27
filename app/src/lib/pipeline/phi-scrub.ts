/**
 * PHI Scrubbing Pipeline
 *
 * Two-pass defense-in-depth:
 * 1. Regex pass (fast, cheap) — catches obvious patterns
 * 2. LLM pass (contextual) — catches names, implicit identifiers
 *
 *   transcript ──▶ regexScrub() ──▶ llmScrub() ──▶ clean transcript
 *       │              │                  │
 *       ▼              ▼                  ▼
 *     [raw]     [MRNs, phones,     [patient names,
 *               DOBs removed]       contextual PHI]
 */

import Anthropic from "@anthropic-ai/sdk";

// Common PHI patterns for Canadian healthcare
const PHI_PATTERNS = [
  // MRN formats (e.g., C123-4567, H12345678)
  /\b[A-Z]\d{3}[-\s]?\d{4,}\b/g,
  // Phone numbers (North American)
  /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  // Dates of birth (various formats)
  /\b(?:DOB|dob|date of birth|born)\s*:?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,
  // Health card numbers (BC: 9 digits, ON: 10 digits with version)
  /\b\d{4}[-\s]?\d{3}[-\s]?\d{3}\b/g,
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Social Insurance Numbers
  /\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/g,
  // Street addresses (basic: number + street name)
  /\b\d{1,5}\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Cres|Crescent|Way|Pl|Place)\b/gi,
];

const REDACTION_LABELS: Record<number, string> = {
  0: "[MRN]",
  1: "[PHONE]",
  2: "[DOB]",
  3: "[HEALTH_CARD]",
  4: "[EMAIL]",
  5: "[SIN]",
  6: "[ADDRESS]",
};

export interface ScrubResult {
  text: string;
  redactions: { pattern: string; count: number }[];
}

/**
 * Pass 1: Regex-based PHI scrubbing (fast, runs locally)
 */
export function regexScrub(transcript: string): ScrubResult {
  let scrubbed = transcript;
  const redactions: { pattern: string; count: number }[] = [];

  PHI_PATTERNS.forEach((pattern, index) => {
    const matches = scrubbed.match(pattern);
    if (matches && matches.length > 0) {
      const label = REDACTION_LABELS[index] || "[PHI]";
      redactions.push({ pattern: label, count: matches.length });
      scrubbed = scrubbed.replace(pattern, label);
    }
  });

  return { text: scrubbed, redactions };
}

/**
 * Pass 2: LLM-based PHI scrubbing (contextual, catches names and implicit identifiers)
 */
export async function llmScrub(
  transcript: string,
  apiKey: string
): Promise<ScrubResult> {
  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a PHI (Protected Health Information) scrubber for medical education transcripts.

This transcript is of a preceptor giving feedback to a medical trainee about their clinical performance. It should NOT contain patient-identifying information, but sometimes preceptors accidentally mention patient details.

Replace any patient-identifying information with appropriate tags:
- Patient names → [PATIENT]
- Patient ages (when identifying) → [AGE]
- Specific dates of patient encounters → [DATE]
- Room numbers or bed numbers → [ROOM]
- Any other information that could identify a specific patient → [PHI]

Do NOT redact:
- The preceptor's name or the trainee's name (these are NOT patients)
- Medical terminology, diagnoses, or procedures (these are educational content)
- General references like "the patient" or "your patient"

Return ONLY the scrubbed transcript with no explanation or preamble.

TRANSCRIPT:
${transcript}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return { text: transcript, redactions: [] };
    }

    // Count redactions by comparing
    const redactionTags = content.text.match(/\[(PATIENT|AGE|DATE|ROOM|PHI)\]/g);
    const redactions = redactionTags
      ? [{ pattern: "[LLM_PHI]", count: redactionTags.length }]
      : [];

    return { text: content.text, redactions };
  } catch (error) {
    // LLM scrub failure is non-fatal — regex pass already ran
    console.error("LLM PHI scrub failed, falling back to regex-only:", error);
    return { text: transcript, redactions: [] };
  }
}

/**
 * Full scrubbing pipeline: regex first, then LLM
 */
export async function scrubTranscript(
  transcript: string,
  apiKey: string
): Promise<{ clean: string; totalRedactions: number }> {
  // Pass 1: regex (fast)
  const regexResult = regexScrub(transcript);

  // Pass 2: LLM (contextual) — operates on regex-scrubbed text
  const llmResult = await llmScrub(regexResult.text, apiKey);

  const totalRedactions =
    regexResult.redactions.reduce((sum, r) => sum + r.count, 0) +
    llmResult.redactions.reduce((sum, r) => sum + r.count, 0);

  return { clean: llmResult.text, totalRedactions };
}
