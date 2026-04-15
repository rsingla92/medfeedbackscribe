/**
 * Gemini 2.5 via Vertex AI (northamerica-northeast1 — Montreal)
 *
 * All PHI processing stays on Canadian infrastructure, satisfying
 * PHIPA/PIPEDA requirements identified in architecture-review-2026-04-14 F-02.
 *
 * Two functions mirror the existing Deepgram/Anthropic interface:
 *
 *   transcribeWithGemini  — audio → STTResult
 *   scrubAndExtractWithGemini — transcript + template → { clean, extraction }
 *
 * Region note: Gemini 2.5 Flash is used because Gemini 2.5 Pro was not yet
 * Generally Available in northamerica-northeast1 (Montreal) at the time this
 * was written (April 2026). Flash remains on Canadian infrastructure and is
 * preferred over routing PHI through a non-Canadian region.
 * Revisit when Pro GA lands in northamerica-northeast1.
 */

import { VertexAI, type GenerateContentRequest } from "@google-cloud/vertexai";
import type { STTResult } from "./stt";
import type { ExtractionResult } from "./extract";
import { regexScrub } from "./phi-scrub";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERTEX_REGION = "northamerica-northeast1";
const GEMINI_MODEL = "gemini-2.5-flash-preview-04-17";

// ---------------------------------------------------------------------------
// Client factory (lazy singleton so tests can mock before import)
// ---------------------------------------------------------------------------

let _vertexAI: VertexAI | null = null;

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
}

// ---------------------------------------------------------------------------
// Speech-to-Text via Gemini multimodal input
// ---------------------------------------------------------------------------

/**
 * Transcribe an audio file using Gemini's native audio understanding.
 *
 * Gemini accepts audio content via inline base64 data or a GCS URI.
 * Here we fetch the signed Supabase Storage URL and pass the raw bytes
 * as inline data so we avoid an intermediate GCS bucket.
 *
 * Returns the same STTResult shape as transcribeAudio (Deepgram) so the
 * pipeline orchestrator can call either interchangeably.
 */
export async function transcribeWithGemini(
  audioUrl: string,
  language: "en" | "fr" = "en",
  projectId: string
): Promise<STTResult> {
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
      ? "The audio is in Canadian French (Quebec). Transcribe in French."
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
- Use standard medical terminology spelling.
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
// PHI scrub + assessment extraction (combined Gemini call)
// ---------------------------------------------------------------------------

interface FormTemplate {
  name: string;
  extraction_mode: "multi" | "single";
  max_outputs: number;
  fields: Record<string, unknown>;
  competency_framework: string;
}

interface GeminiScrubExtractResult {
  clean: string;
  totalRedactions: number;
  extraction: ExtractionResult;
}

/**
 * Two-pass PHI scrubbing (regex then Gemini) followed by structured
 * assessment extraction — all in a single Vertex AI session.
 *
 * Separation rationale: we use TWO Gemini calls to maximise quality:
 *   1. PHI scrub call — focused context window, less hallucination risk.
 *   2. Extraction call — receives the already-scrubbed text.
 * The overhead is small vs. the safety benefit of a dedicated scrub pass.
 *
 * Defense in depth: regex pass always runs first (cheap, boundary layer).
 */
export async function scrubAndExtractWithGemini(
  rawTranscript: string,
  formTemplate: FormTemplate,
  projectId: string
): Promise<GeminiScrubExtractResult> {
  const vertex = getVertexClient(projectId);
  const model = vertex.preview.getGenerativeModel({ model: GEMINI_MODEL });

  // ── Pass 1: regex (boundary layer, always runs) ──────────────────────────
  const regexResult = regexScrub(rawTranscript);
  const afterRegex = regexResult.text;
  const regexRedactionCount = regexResult.redactions.reduce(
    (sum, r) => sum + r.count,
    0
  );

  // ── Pass 2: Gemini PHI scrub (contextual) ───────────────────────────────
  const scrubRequest: GenerateContentRequest = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are a PHI (Protected Health Information) scrubber for medical education transcripts.

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
${afterRegex}`,
          },
        ],
      },
    ],
  };

  let cleanTranscript = afterRegex;
  let llmRedactionCount = 0;

  try {
    const scrubResponse = await model.generateContent(scrubRequest);
    const scrubText =
      scrubResponse.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    if (scrubText) {
      cleanTranscript = scrubText;
      const redactionTags = scrubText.match(/\[(PATIENT|AGE|DATE|ROOM|PHI)\]/g);
      llmRedactionCount = redactionTags?.length ?? 0;
    }
  } catch (err) {
    // LLM scrub failure is non-fatal — regex pass already ran
    console.error("Gemini PHI scrub failed, falling back to regex-only:", err);
  }

  const totalRedactions = regexRedactionCount + llmRedactionCount;

  // ── Pass 3: Gemini extraction ─────────────────────────────────────────────
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
