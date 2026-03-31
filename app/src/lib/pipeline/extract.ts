/**
 * LLM Assessment Extraction
 *
 * Takes a clean transcript + form template → structured assessment(s)
 *
 * Two modes:
 *   MULTI (T-Res Field Notes): 1-5 outputs per transcript
 *   SINGLE (One45 Daily Eval): 1 output per transcript
 *
 *   transcript ──▶ Claude ──▶ Assessment[]
 *       │                         │
 *   template                  1-5 structured
 *   (JSON schema)             field notes or
 *                             1 evaluation form
 */

import Anthropic from "@anthropic-ai/sdk";

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

export async function extractAssessment(
  transcript: string,
  template: FormTemplate,
  apiKey: string
): Promise<ExtractionResult> {
  const client = new Anthropic({ apiKey });
  const prompt = buildExtractionPrompt(transcript, template);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("EXTRACTION_EMPTY_RESPONSE");
  }

  // Extract JSON from response (may be wrapped in markdown code block)
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `EXTRACTION_PARSE_ERROR: no JSON found in response — preview: ${content.text.slice(0, 200)}`
    );
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.outputs || !Array.isArray(parsed.outputs)) {
      throw new Error("EXTRACTION_INVALID_FORMAT");
    }

    // Enforce max outputs
    const outputs = parsed.outputs.slice(0, template.max_outputs);

    return {
      outputs: outputs.map(
        (o: Record<string, unknown>, i: number) => ({
          output_index: i + 1,
          structured_fields: (o.structured_fields as Record<string, unknown>) ?? {},
          competency_tags: (o.competency_tags as string[]) ?? [],
          narrative_summary: (o.narrative_summary as string) ?? "",
          coaching_did_well: o.coaching_did_well as string | undefined,
          coaching_consider: o.coaching_consider as string | undefined,
          confidence: (o.confidence as Record<string, number>) ?? {},
        })
      ),
      model: response.model,
    };
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error("EXTRACTION_PARSE_ERROR");
    }
    throw e;
  }
}
