/**
 * Gemini 2.5 Flash via Vertex AI (northamerica-northeast1 — Montreal)
 *
 * All PHI processing stays on Canadian infrastructure, satisfying
 * PHIPA/PIPEDA requirements identified in architecture-review-2026-04-14 F-02.
 *
 * Functions:
 *   transcribeWithGemini        — audio → STTResult
 *   scrubAndExtractWithGemini   — transcript + template → { clean, extraction }
 *
 * PHI defense-in-depth (belt-and-suspenders):
 *   1. regexScrub()  — fast deterministic pass BEFORE Gemini sees any text
 *   2. Gemini PHI scrub — contextual pass (names, implicit identifiers)
 *   3. regexScrub()  — second deterministic pass AFTER Gemini output
 *      (catches drift / hallucinated PHI leakage)
 *
 * Lambda credentials strategy:
 *   - If GOOGLE_APPLICATION_CREDENTIALS is already set (local dev), use it.
 *   - Otherwise, on cold start, read the JSON SA key from Secrets Manager
 *     (ARN from GCP_SA_SECRET_ARN), write it to /tmp/gcp-sa.json, and set
 *     GOOGLE_APPLICATION_CREDENTIALS to that path. google-auth-library (used
 *     internally by @google-cloud/vertexai) will pick it up automatically.
 */

import { writeFileSync, existsSync } from "node:fs";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { VertexAI, type GenerateContentRequest } from "@google-cloud/vertexai";
import type { ExtractionResult, FormTemplate, GeminiScrubExtractResult, STTResult } from "./types.js";
import { regexScrub } from "./phi-scrub.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERTEX_REGION = "northamerica-northeast1";
const GEMINI_MODEL = "gemini-2.5-flash-preview-04-17";
const GCP_SA_PATH = "/tmp/gcp-sa.json";

// ---------------------------------------------------------------------------
// Client factory (lazy singleton so tests can mock before import)
// ---------------------------------------------------------------------------

let _vertexAI: VertexAI | null = null;
let _credentialsBootstrapped = false;

/**
 * Ensure GOOGLE_APPLICATION_CREDENTIALS points at a readable service-account
 * JSON. In Lambda we fetch from Secrets Manager on cold start.
 */
async function ensureGcpCredentials(): Promise<void> {
  if (_credentialsBootstrapped) return;

  // Local / already-configured path.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    _credentialsBootstrapped = true;
    return;
  }

  const secretArn = process.env.GCP_SA_SECRET_ARN;
  if (!secretArn) {
    // No secret ARN and no local creds — let VertexAI throw a clear error
    // rather than masking it here. This lets mock tests (which inject their
    // own VertexAI) continue to work.
    _credentialsBootstrapped = true;
    return;
  }

  if (!existsSync(GCP_SA_PATH)) {
    const client = new SecretsManagerClient({});
    const resp = await client.send(
      new GetSecretValueCommand({ SecretId: secretArn })
    );
    const secret = resp.SecretString;
    if (!secret) {
      throw new Error("GCP_SA_SECRET_EMPTY");
    }
    writeFileSync(GCP_SA_PATH, secret, { mode: 0o600 });
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = GCP_SA_PATH;
  _credentialsBootstrapped = true;
}

function getVertexClient(projectId: string): VertexAI {
  if (!_vertexAI) {
    _vertexAI = new VertexAI({
      project: projectId,
      location: VERTEX_REGION,
    });
  }
  return _vertexAI;
}

/** Reset the singleton — used in tests to inject fresh mocks. */
export function _resetVertexClient(): void {
  _vertexAI = null;
  _credentialsBootstrapped = false;
}

// ---------------------------------------------------------------------------
// PHI Scrub prompt — all 18 HIPAA categories + Canadian additions
// ---------------------------------------------------------------------------

const PHI_SCRUB_PROMPT = `You are a strict PHI (Protected Health Information) scrubber for Canadian medical education transcripts.

This transcript is of a preceptor giving feedback to a medical trainee about their clinical performance. Preceptors occasionally mention patient details accidentally. Your job is to detect and redact ALL patient-identifying information.

REPLACE each instance with the corresponding tag (use this exact format):

| PHI Category | Tag |
|---|---|
| Patient names (first, last, full) | [REDACTED-NAME] |
| Geographic locations smaller than province: addresses, neighbourhoods, specific hospital units | [REDACTED-LOCATION] |
| Dates other than year alone (encounter dates, DOB, admission dates) | [REDACTED-DATE] |
| Phone numbers | [REDACTED-PHONE] |
| Fax numbers | [REDACTED-FAX] |
| Email addresses | [REDACTED-EMAIL] |
| US Social Security Numbers | [REDACTED-SSN] |
| Canadian Social Insurance Numbers (SIN) | [REDACTED-SIN] |
| Medical Record Numbers (MRN, Chart #, Patient #) | [REDACTED-MRN] |
| Health plan / insurance policy numbers | [REDACTED-POLICY] |
| Account numbers | [REDACTED-ACCOUNT] |
| Driver's license, professional license numbers | [REDACTED-LICENSE] |
| Vehicle Identification Numbers (VIN), license plates | [REDACTED-VEHICLE] |
| Device identifiers (pacemaker IDs, implant serials) | [REDACTED-DEVICE-ID] |
| URLs or IP addresses | [REDACTED-URL] |
| Biometric identifiers (fingerprints, retinal data) | [REDACTED-BIOMETRIC] |
| Provincial health card numbers (OHIP, BC PHN, RAMQ, AB PHN) | [REDACTED-HEALTH-CARD] |
| Canadian postal codes (PHI for areas < 20,000 population) | [REDACTED-POSTAL] |
| Any other unique identifier that could identify a specific patient | [REDACTED-PHI] |

DO NOT redact:
- The preceptor's name or the trainee's name (these are educators/learners, NOT patients)
- Medical eponyms (Crohn disease, Down syndrome, Parkinson's, etc.)
- Medical terminology, diagnoses, procedures, medications (educational content)
- General references like "the patient", "your patient", "a patient"
- The current year alone (e.g., "2026" by itself is NOT a date — only redact full dates)
- Institution names used generically (e.g., "the hospital", "emergency department")

FEW-SHOT EXAMPLES (English):
Input:  "Good work with Mrs. Patterson in room 214 last Tuesday the 8th."
Output: "Good work with [REDACTED-NAME] in [REDACTED-ROOM] [REDACTED-DATE]."

Input:  "The patient's MRN is H987-6543 and they were born on March 15, 1990."
Output: "The patient's [REDACTED-MRN] and they were born on [REDACTED-DATE]."

Input:  "Call the family at (604) 777-8899 or email smith@gmail.com."
Output: "Call the family at [REDACTED-PHONE] or email [REDACTED-EMAIL]."

FEW-SHOT EXAMPLES (French / Québécois):
Input:  "Bon travail avec M. Tremblay dans la salle 3B le 12 mars."
Output: "Bon travail avec [REDACTED-NAME] dans [REDACTED-ROOM] [REDACTED-DATE]."

Input:  "Le patient, né le 5 janvier 1985, a un numéro RAMQ TREM 8501 0512."
Output: "Le patient, né le [REDACTED-DATE], a un numéro RAMQ [REDACTED-HEALTH-CARD]."

Input:  "Contactez la famille au (514) 555-9876 ou à info@example.ca."
Output: "Contactez la famille au [REDACTED-PHONE] ou à [REDACTED-EMAIL]."

Return ONLY the scrubbed transcript with no explanation, preamble, or trailing comment.`;

// ---------------------------------------------------------------------------
// Speech-to-Text via Gemini multimodal input
// ---------------------------------------------------------------------------

/**
 * Transcribe an audio file using Gemini's native audio understanding.
 *
 * Gemini accepts audio content via inline base64 data or a GCS URI.
 * Here we fetch the signed URL and pass the raw bytes as inline data.
 *
 * Returns an STTResult shape compatible with the pipeline orchestrator.
 */
export async function transcribeWithGemini(
  audioUrl: string,
  language: "en" | "fr" = "en",
  projectId: string
): Promise<STTResult> {
  await ensureGcpCredentials();

  // Fetch the audio bytes from the signed URL
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`STT_FETCH_ERROR: ${audioResponse.status} ${audioResponse.statusText}`);
  }

  const audioBuffer = await audioResponse.arrayBuffer();
  if (audioBuffer.byteLength === 0) {
    throw new Error("STT_EMPTY_TRANSCRIPT");
  }

  const audioBase64 = Buffer.from(audioBuffer).toString("base64");

  // Detect MIME type from URL extension (default webm)
  const mimeType = audioUrl.includes(".mp4")
    ? "audio/mp4"
    : audioUrl.includes(".mp3")
    ? "audio/mpeg"
    : audioUrl.includes(".ogg")
    ? "audio/ogg"
    : "audio/webm";

  const vertex = getVertexClient(projectId);
  const model = vertex.preview.getGenerativeModel({ model: GEMINI_MODEL });

  const languageInstruction =
    language === "fr"
      ? "L'audio est en français canadien (québécois). Transcrivez en français. / The audio is in Canadian French (Quebec). Transcribe in French."
      : "The audio is in Canadian English. Transcribe in English.";

  const request: GenerateContentRequest = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
          {
            text: `${languageInstruction}

Transcribe the spoken audio exactly as said. This is a medical preceptor giving verbal feedback to a medical trainee about their clinical performance.

Rules:
- Transcribe verbatim. Do not summarize or paraphrase.
- Preserve hesitations, fillers (um, uh) if medically relevant context might be lost otherwise.
- Use standard medical terminology spelling (English or French as appropriate).
- For Quebec French: use standard Canadian French spelling and medical terminology.
- Return ONLY the transcript text. No preamble, no explanation.`,
          },
        ],
      },
    ],
  };

  const response = await model.generateContent(request);
  const candidate = response.response.candidates?.[0];
  const transcript = candidate?.content?.parts?.[0]?.text?.trim() ?? "";

  if (!transcript || transcript.length === 0) {
    throw new Error("STT_EMPTY_TRANSCRIPT");
  }

  return {
    transcript,
    confidence: 0.9, // Gemini does not return per-token confidence; use fixed high value
    duration_seconds: 0, // Gemini does not expose duration; pipeline still logs it
    language,
  };
}

// ---------------------------------------------------------------------------
// PHI scrub + assessment extraction (combined Gemini session)
// ---------------------------------------------------------------------------

export type { GeminiScrubExtractResult } from "./types.js";

/**
 * Three-pass PHI scrubbing followed by structured assessment extraction.
 *
 * Pass 1 (regex)   — fast, deterministic, runs before Gemini sees any text
 * Pass 2 (Gemini)  — contextual PHI scrub (names, implicit identifiers)
 * Pass 3 (regex)   — belt-and-suspenders after Gemini; logs if extra PHI found
 *
 * Then a separate Gemini call performs structured assessment extraction on the
 * double-scrubbed text.
 */
export async function scrubAndExtractWithGemini(
  rawTranscript: string,
  formTemplate: FormTemplate,
  projectId: string
): Promise<GeminiScrubExtractResult> {
  await ensureGcpCredentials();

  const vertex = getVertexClient(projectId);
  const model = vertex.preview.getGenerativeModel({ model: GEMINI_MODEL });

  // ── Pass 1: regex (deterministic boundary layer) ─────────────────────────
  const regexResult1 = regexScrub(rawTranscript);
  const afterRegex1 = regexResult1.text;
  const regexRedactionCount1 = regexResult1.redactions.reduce(
    (sum, r) => sum + r.count,
    0
  );

  // ── Pass 2: Gemini contextual PHI scrub ──────────────────────────────────
  const scrubRequest: GenerateContentRequest = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${PHI_SCRUB_PROMPT}

TRANSCRIPT:
${afterRegex1}`,
          },
        ],
      },
    ],
  };

  let cleanTranscript = afterRegex1;
  let llmRedactionCount = 0;

  try {
    const scrubResponse = await model.generateContent(scrubRequest);
    const scrubText =
      scrubResponse.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    if (scrubText) {
      cleanTranscript = scrubText;
      // Count all [REDACTED-*] tags from Gemini output
      const redactionTags = scrubText.match(/\[REDACTED-[A-Z_-]+\]/g);
      llmRedactionCount = redactionTags?.length ?? 0;
    }
  } catch (err) {
    // LLM scrub failure is non-fatal — regex pass already ran
    console.error("Gemini PHI scrub failed, falling back to regex-only:", err);
  }

  // ── Pass 3: regex again (belt-and-suspenders) ────────────────────────────
  const regexResult2 = regexScrub(cleanTranscript);
  const afterRegex2 = regexResult2.text;
  const regexRedactionCount2 = regexResult2.redactions.reduce(
    (sum, r) => sum + r.count,
    0
  );

  if (regexRedactionCount2 > 0) {
    // Signal Gemini drift — helpful for monitoring prompt degradation
    console.warn(
      `[phi-belt-and-suspenders] Second regex pass found ${regexRedactionCount2} additional PHI items that Gemini missed:`,
      regexResult2.redactions
    );
  }

  cleanTranscript = afterRegex2;
  const totalRedactions = regexRedactionCount1 + llmRedactionCount + regexRedactionCount2;

  // ── Gemini extraction ─────────────────────────────────────────────────────
  const modeInstruction =
    formTemplate.extraction_mode === "multi"
      ? `This transcript may contain feedback on MULTIPLE distinct activities or patient encounters.
Generate between 1 and ${formTemplate.max_outputs} separate field notes, one per distinct activity discussed.
Signals for splitting: explicit patient transitions, distinct skill areas, topic shifts.
Shorter transcripts (under 1 minute) → likely 1 output.
Longer transcripts (3-5 minutes) with distinct topics → 2-5 outputs.
Do NOT split artificially — only when the preceptor clearly moves to a different activity or encounter.`
      : `Generate exactly ONE evaluation form from this transcript. Synthesize all feedback into a single holistic assessment.`;

  const extractRequest: GenerateContentRequest = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an expert medical education assessment extractor. A preceptor just gave verbal feedback to a medical trainee. Your job is to extract structured assessment data from their spoken feedback.

This transcript may be in English or Canadian French (Québécois). Extract faithfully from either language and populate the fields in English unless the field value is a direct quote.

FORM TYPE: ${formTemplate.name}
COMPETENCY FRAMEWORK: ${formTemplate.competency_framework}

${modeInstruction}

FORM FIELDS (fill each from the transcript):
${JSON.stringify(formTemplate.fields, null, 2)}

RULES:
- Extract ONLY what the preceptor actually said. Never invent or hallucinate feedback.
- If the transcript doesn't contain enough information for a field, set its confidence to 0 and value to null.
- For rating scales, map the preceptor's language to the closest rating level.
- For text fields, paraphrase the preceptor's words into professional assessment language.
- For tag fields (skill dimension, domain of care, priority topics), select from the provided options only.
- Include a confidence score (0.0-1.0) for each field based on how clearly the preceptor addressed it.

FEW-SHOT EXAMPLE (French input → English output):
Transcript: "Le résident a fait un excellent travail avec l'intubation. Technique fluide, bonne communication."
→ narrative_summary: "Resident demonstrated excellent intubation technique with smooth execution and good communication."

OUTPUT FORMAT (JSON):
{
  "outputs": [
    {
      "output_index": 1,
      "structured_fields": { /* matches template fields */ },
      "competency_tags": ["Medical Expert", "Communicator"],
      "narrative_summary": "Brief 2-3 sentence summary of this assessment",
      "coaching_did_well": "What the trainee did well (if T-Res field note)",
      "coaching_consider": "What to consider next time (if T-Res field note)",
      "confidence": { "field_name": 0.85, ... }
    }
  ]
}

TRANSCRIPT:
${cleanTranscript}`,
          },
        ],
      },
    ],
  };

  const extractResponse = await model.generateContent(extractRequest);
  const extractText =
    extractResponse.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

  if (!extractText) {
    throw new Error("EXTRACTION_EMPTY_RESPONSE");
  }

  const jsonMatch = extractText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(
      `EXTRACTION_PARSE_ERROR: no JSON found in Gemini response (response length: ${extractText.length})`
    );
    throw new Error("EXTRACTION_PARSE_ERROR: no JSON found in response");
  }

  let parsed: { outputs: Record<string, unknown>[] };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.error(
      `EXTRACTION_PARSE_ERROR: invalid JSON from Gemini (fragment length: ${jsonMatch[0].length})`
    );
    throw new Error("EXTRACTION_PARSE_ERROR: invalid JSON");
  }

  if (!parsed.outputs || !Array.isArray(parsed.outputs)) {
    throw new Error("EXTRACTION_INVALID_FORMAT");
  }

  const outputs = parsed.outputs.slice(0, formTemplate.max_outputs);

  const extraction: ExtractionResult = {
    outputs: outputs.map((o, i) => ({
      output_index: i + 1,
      structured_fields: (o.structured_fields as Record<string, unknown>) ?? {},
      competency_tags: (o.competency_tags as string[]) ?? [],
      narrative_summary: (o.narrative_summary as string) ?? "",
      coaching_did_well: o.coaching_did_well as string | undefined,
      coaching_consider: o.coaching_consider as string | undefined,
      confidence: (o.confidence as Record<string, number>) ?? {},
    })),
    model: GEMINI_MODEL,
  };

  return { clean: cleanTranscript, totalRedactions, extraction };
}
