/**
 * LLM Assessment Extraction — Gemini-only
 *
 * This module now serves as a thin type + prompt helper layer.
 * Actual extraction is performed by scrubAndExtractWithGemini() in gemini.ts,
 * which combines PHI scrubbing + extraction in a single Vertex AI session.
 *
 * buildExtractionPrompt() is exported for unit-test coverage and for
 * constructing the extraction prompt text that is embedded in the Gemini call.
 */

export interface ExtractionResult {
  outputs: AssessmentOutput[];
  model: string;
}

export interface AssessmentOutput {
  output_index: number;
  structured_fields: Record<string, unknown>;
  competency_tags: string[];
  narrative_summary: string;
  coaching_did_well?: string;
  coaching_consider?: string;
  confidence: Record<string, number>;
}

interface FormTemplate {
  name: string;
  extraction_mode: "multi" | "single";
  max_outputs: number;
  fields: Record<string, unknown>;
  competency_framework: string;
}

/**
 * Build the extraction prompt used by Gemini (and covered by unit tests).
 * Pure function — no side effects.
 */
export function buildExtractionPrompt(
  transcript: string,
  template: FormTemplate
): string {
  const modeInstruction =
    template.extraction_mode === "multi"
      ? `This transcript may contain feedback on MULTIPLE distinct activities or patient encounters.
Generate between 1 and ${template.max_outputs} separate field notes, one per distinct activity discussed.
Signals for splitting: explicit patient transitions, distinct skill areas, topic shifts.
Shorter transcripts (under 1 minute) → likely 1 output.
Longer transcripts (3-5 minutes) with distinct topics → 2-5 outputs.
Do NOT split artificially — only when the preceptor clearly moves to a different activity or encounter.`
      : `Generate exactly ONE evaluation form from this transcript. Synthesize all feedback into a single holistic assessment.`;

  return `You are an expert medical education assessment extractor. A preceptor just gave verbal feedback to a medical trainee. Your job is to extract structured assessment data from their spoken feedback.

FORM TYPE: ${template.name}
COMPETENCY FRAMEWORK: ${template.competency_framework}

${modeInstruction}

FORM FIELDS (fill each from the transcript):
${JSON.stringify(template.fields, null, 2)}

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
${transcript}`;
}

/**
 * Stub kept for backward compatibility — actual extraction now runs inside
 * scrubAndExtractWithGemini(). This function should not be called in
 * production; it throws to surface accidental legacy call sites.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function extractAssessment(..._args: unknown[]): Promise<ExtractionResult> {
  throw new Error(
    "extractAssessment() is deprecated. Use scrubAndExtractWithGemini() from gemini.ts instead."
  );
}
