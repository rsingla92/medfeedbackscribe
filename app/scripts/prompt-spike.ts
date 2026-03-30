/**
 * Prompt engineering spike -- test extraction quality
 * Run: cd app && bunx tsx scripts/prompt-spike.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

// Read API key from .env.local
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
const apiKeyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
if (!apiKeyMatch) throw new Error("ANTHROPIC_API_KEY not found in .env.local");
const ANTHROPIC_API_KEY = apiKeyMatch[1].trim();

// Read template
const template = JSON.parse(
  readFileSync(resolve(__dirname, "../src/lib/templates/ubc-fm-tres-field-note.json"), "utf-8")
);

// Import the prompt builder
// We inline it to avoid TS module resolution issues in a standalone script
function buildExtractionPrompt(transcript: string, tmpl: typeof template): string {
  const modeInstruction =
    tmpl.extraction_mode === "multi"
      ? `This transcript may contain feedback on MULTIPLE distinct activities or patient encounters.
Generate between 1 and ${tmpl.max_outputs} separate field notes, one per distinct activity discussed.
Signals for splitting: explicit patient transitions, distinct skill areas, topic shifts.
Shorter transcripts (under 1 minute) -> likely 1 output.
Longer transcripts (3-5 minutes) with distinct topics -> 2-5 outputs.
Do NOT split artificially -- only when the preceptor clearly moves to a different activity or encounter.`
      : `Generate exactly ONE evaluation form from this transcript. Synthesize all feedback into a single holistic assessment.`;

  return `You are an expert medical education assessment extractor. A preceptor just gave verbal feedback to a medical trainee. Your job is to extract structured assessment data from their spoken feedback.

FORM TYPE: ${tmpl.name}
COMPETENCY FRAMEWORK: ${tmpl.competency_framework}

${modeInstruction}

FORM FIELDS (fill each from the transcript):
${JSON.stringify(tmpl.fields, null, 2)}

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

// 5 synthetic transcripts of varying quality
const TRANSCRIPTS = [
  {
    name: "Brief positive",
    text: "Yeah you did a good job today. Keep it up.",
    expected:
      "Should produce 1 field note with mostly 'insufficient detail' fields (low confidence, null values)",
  },
  {
    name: "Detailed single encounter",
    text: "Overall you did a good job today. Your history was thorough -- you caught the family history of colon cancer which was important for this patient. Your physical exam technique needs work, especially abdominal palpation -- you were too superficial. Your plan was reasonable but you should have considered imaging earlier. You communicated well with the patient and they seemed comfortable with you.",
    expected:
      "Should produce 1 field note with clear coaching, domain: Care of Adults, skills: Clinical Reasoning + Communication",
  },
  {
    name: "Multi-encounter (3 patients)",
    text: "So today we saw three patients together. The first one, the elderly gentleman with chest pain -- your approach was excellent. You did a thorough cardiac workup, ordered the right tests, and your differential was spot on. Good job there. The second patient, the young woman with anxiety -- I noticed you jumped straight to prescribing rather than exploring the psychosocial context. Take more time with mental health presentations. And the third, the pediatric case -- you were a bit nervous with the toddler but your developmental assessment was actually quite good. You just need more confidence with kids.",
    expected:
      "Should produce 3 separate field notes, one per patient encounter",
  },
  {
    name: "Vague/unhelpful",
    text: "Fine. Everything was fine today. See you tomorrow.",
    expected:
      "Should produce 1 field note with all fields marked insufficient/low confidence",
  },
  {
    name: "French feedback",
    text: "Aujourd'hui tu as bien fait avec le patient diabetique. Ton examen physique etait complet, surtout l'examen des pieds. Par contre, tu aurais du verifier la tension arterielle en position debout aussi. Ta communication avec le patient etait excellente, il avait l'air de bien comprendre son plan de traitement.",
    expected:
      "Should produce 1 field note, correctly identified skills and domain despite French",
  },
];

interface AssessmentOutput {
  output_index: number;
  structured_fields: Record<string, unknown>;
  competency_tags: string[];
  narrative_summary: string;
  coaching_did_well?: string;
  coaching_consider?: string;
  confidence: Record<string, number>;
}

interface ExtractionResult {
  outputs: AssessmentOutput[];
  model: string;
}

async function callExtraction(transcript: string): Promise<ExtractionResult> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
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

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("EXTRACTION_PARSE_ERROR");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.outputs || !Array.isArray(parsed.outputs)) {
    throw new Error("EXTRACTION_INVALID_FORMAT");
  }

  const outputs = parsed.outputs.slice(0, template.max_outputs);

  return {
    outputs: outputs.map((o: Record<string, unknown>, i: number) => ({
      output_index: i + 1,
      structured_fields: (o.structured_fields as Record<string, unknown>) ?? {},
      competency_tags: (o.competency_tags as string[]) ?? [],
      narrative_summary: (o.narrative_summary as string) ?? "",
      coaching_did_well: o.coaching_did_well as string | undefined,
      coaching_consider: o.coaching_consider as string | undefined,
      confidence: (o.confidence as Record<string, number>) ?? {},
    })),
    model: response.model,
  };
}

function evaluateResult(
  name: string,
  expected: string,
  result: ExtractionResult
): { pass: boolean; notes: string[] } {
  const notes: string[] = [];
  let pass = true;

  // Check output count
  const outputCount = result.outputs.length;

  if (name === "Multi-encounter (3 patients)") {
    if (outputCount === 3) {
      notes.push(`PASS: Correctly produced ${outputCount} field notes`);
    } else {
      notes.push(`FAIL: Expected 3 field notes, got ${outputCount}`);
      pass = false;
    }
  } else {
    if (outputCount === 1) {
      notes.push(`PASS: Correctly produced 1 field note`);
    } else {
      notes.push(`FAIL: Expected 1 field note, got ${outputCount}`);
      pass = false;
    }
  }

  for (const output of result.outputs) {
    // Check confidence scores exist
    const confKeys = Object.keys(output.confidence);
    if (confKeys.length === 0) {
      notes.push(`WARN: No confidence scores returned for output ${output.output_index}`);
    }

    // Check coaching fields
    if (output.coaching_did_well) {
      notes.push(
        `  Output ${output.output_index} - Did well: "${output.coaching_did_well.substring(0, 80)}..."`
      );
    } else {
      notes.push(`  Output ${output.output_index} - Did well: (empty)`);
    }
    if (output.coaching_consider) {
      notes.push(
        `  Output ${output.output_index} - Consider: "${output.coaching_consider.substring(0, 80)}..."`
      );
    } else {
      notes.push(`  Output ${output.output_index} - Consider: (empty)`);
    }

    // Check tags
    notes.push(
      `  Output ${output.output_index} - Competency tags: [${output.competency_tags.join(", ")}]`
    );

    const sf = output.structured_fields;
    if (sf.skill_dimension) {
      notes.push(
        `  Output ${output.output_index} - Skill dimensions: ${JSON.stringify(sf.skill_dimension)}`
      );
    }
    if (sf.domain_of_care) {
      notes.push(
        `  Output ${output.output_index} - Domain of care: ${sf.domain_of_care}`
      );
    }
    if (sf.priority_topics) {
      notes.push(
        `  Output ${output.output_index} - Priority topics: ${JSON.stringify(sf.priority_topics)}`
      );
    }

    // Specific checks per transcript
    if (name === "Brief positive" || name === "Vague/unhelpful") {
      const avgConf =
        confKeys.length > 0
          ? confKeys.reduce((sum, k) => sum + (output.confidence[k] || 0), 0) / confKeys.length
          : 0;
      if (avgConf < 0.5) {
        notes.push(`  PASS: Low average confidence (${avgConf.toFixed(2)}) -- appropriate for vague input`);
      } else {
        notes.push(
          `  WARN: Average confidence (${avgConf.toFixed(2)}) seems high for vague input`
        );
      }
    }

    if (name === "Detailed single encounter") {
      const skills = sf.skill_dimension as string[] | undefined;
      if (skills && skills.includes("Clinical Reasoning/Skills")) {
        notes.push(`  PASS: Correctly tagged Clinical Reasoning/Skills`);
      } else {
        notes.push(`  WARN: Missing Clinical Reasoning/Skills tag`);
      }
      if (skills && skills.includes("Communication")) {
        notes.push(`  PASS: Correctly tagged Communication`);
      } else {
        notes.push(`  WARN: Missing Communication tag`);
      }
    }

    if (name === "French feedback") {
      if (sf.domain_of_care) {
        notes.push(`  PASS: Domain extracted despite French input`);
      } else {
        notes.push(`  FAIL: No domain extracted from French input`);
        pass = false;
      }
      const topics = sf.priority_topics as string[] | undefined;
      if (topics && topics.includes("Diabetes")) {
        notes.push(`  PASS: Correctly identified Diabetes topic from French`);
      } else {
        notes.push(`  WARN: Did not identify Diabetes topic from French input`);
      }
    }
  }

  return { pass, notes };
}

async function main() {
  console.log("=== Debrief Prompt Engineering Spike ===\n");
  console.log(`Template: ${template.name}`);
  console.log(`Mode: ${template.extraction_mode}, max_outputs: ${template.max_outputs}`);
  console.log(`Framework: ${template.competency_framework}\n`);
  console.log("---\n");

  const allResults: {
    name: string;
    expected: string;
    result: ExtractionResult;
    evaluation: { pass: boolean; notes: string[] };
    error?: string;
  }[] = [];

  for (const t of TRANSCRIPTS) {
    console.log(`\n## Transcript: "${t.name}"`);
    console.log(`Input: "${t.text.substring(0, 80)}..."`);
    console.log(`Expected: ${t.expected}\n`);

    try {
      const result = await callExtraction(t.text);
      console.log(`Model: ${result.model}`);
      console.log(`Outputs: ${result.outputs.length}`);

      const evaluation = evaluateResult(t.name, t.expected, result);

      for (const note of evaluation.notes) {
        console.log(note);
      }

      console.log(`\nVerdict: ${evaluation.pass ? "PASS" : "NEEDS REVIEW"}`);

      allResults.push({
        name: t.name,
        expected: t.expected,
        result,
        evaluation,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`ERROR: ${errMsg}`);
      allResults.push({
        name: t.name,
        expected: t.expected,
        result: { outputs: [], model: "error" },
        evaluation: { pass: false, notes: [`ERROR: ${errMsg}`] },
        error: errMsg,
      });
    }

    console.log("\n---");
  }

  // Generate markdown report
  const passCount = allResults.filter((r) => r.evaluation.pass).length;
  const totalCount = allResults.length;

  let md = `# Prompt Spike Results -- T-Res Field Note Extraction

**Date**: ${new Date().toISOString().split("T")[0]}
**Template**: ${template.name}
**Model**: claude-sonnet-4-20250514
**Framework**: ${template.competency_framework}

## Summary

**${passCount}/${totalCount} transcripts passed** basic extraction checks.

| Transcript | Outputs | Pass | Key Finding |
|---|---|---|---|
`;

  for (const r of allResults) {
    const keyFinding =
      r.error ||
      r.evaluation.notes.find((n) => n.startsWith("FAIL:") || n.startsWith("WARN:")) ||
      r.evaluation.notes[0] ||
      "-";
    md += `| ${r.name} | ${r.result.outputs.length} | ${r.evaluation.pass ? "Yes" : "No"} | ${keyFinding.replace(/\|/g, "/")} |\n`;
  }

  md += `\n## Detailed Results\n\n`;

  for (const r of allResults) {
    md += `### ${r.name}\n\n`;
    md += `**Input**: "${r.result.model !== "error" ? TRANSCRIPTS.find((t) => t.name === r.name)!.text : "(error)"}"\n\n`;
    md += `**Expected**: ${r.expected}\n\n`;
    md += `**Outputs**: ${r.result.outputs.length}\n\n`;

    if (r.error) {
      md += `**Error**: ${r.error}\n\n`;
    }

    for (const note of r.evaluation.notes) {
      md += `- ${note.trim()}\n`;
    }

    // Include raw structured fields for inspection
    if (r.result.outputs.length > 0) {
      md += `\n<details><summary>Raw output</summary>\n\n\`\`\`json\n${JSON.stringify(r.result.outputs, null, 2)}\n\`\`\`\n\n</details>\n`;
    }

    md += `\n---\n\n`;
  }

  md += `## Observations & Recommendations\n\n`;
  md += `### What works well\n`;
  md += `- (To be filled after reviewing results)\n\n`;
  md += `### What needs improvement\n`;
  md += `- (To be filled after reviewing results)\n\n`;
  md += `### Prompt changes to try next\n`;
  md += `- (To be filled after reviewing results)\n`;

  // Write report
  const docsDir = resolve(__dirname, "../../docs");
  try {
    mkdirSync(docsDir, { recursive: true });
  } catch {}
  const reportPath = resolve(docsDir, "prompt-spike-results.md");
  writeFileSync(reportPath, md);
  console.log(`\n\nReport saved to: ${reportPath}`);
  console.log(`\nOverall: ${passCount}/${totalCount} passed`);
}

main().catch(console.error);
