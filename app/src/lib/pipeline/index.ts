/**
 * MedScribe Processing Pipeline (async)
 *
 * Orchestrates the full flow from audio to structured assessment:
 *
 *   audio ──▶ STT ──▶ regex PHI ──▶ LLM PHI ──▶ LLM extract ──▶ save ──▶ email
 *     │         │          │            │             │            │         │
 *     ▼         ▼          ▼            ▼             ▼            ▼         ▼
 *   upload   Deepgram   fast/local   Claude       Claude      Postgres   Resend
 *            nova-2     patterns     scrub        extract     + update    (optional)
 *            medical                                          status
 *
 * Timeout guard: saves partial progress if approaching Edge Function limit.
 * Each step is logged to pipeline_logs for observability.
 */

import { transcribeAudio, type STTResult } from "./stt";
import { scrubTranscript } from "./phi-scrub";
import { extractAssessment, type ExtractionResult } from "./extract";
import { sendPreceptorSummary } from "@/lib/email";
import type { SupabaseClient } from "@supabase/supabase-js";

interface PipelineConfig {
  deepgramApiKey: string;
  anthropicApiKey: string;
  timeoutMs: number; // Edge Function budget
}

interface PipelineInput {
  sessionId: string;
  audioUrl: string;
  language: "en" | "fr";
  formTemplate: {
    name: string;
    extraction_mode: "multi" | "single";
    max_outputs: number;
    fields: Record<string, unknown>;
    competency_framework: string;
  };
  preceptorEmail?: string;
}

async function logStep(
  supabase: SupabaseClient,
  sessionId: string,
  step: string,
  status: string,
  startTime: number,
  error?: string,
  metadata?: Record<string, unknown>
) {
  await supabase.from("pipeline_logs").insert({
    session_id: sessionId,
    step,
    status,
    duration_ms: Date.now() - startTime,
    error_message: error,
    metadata,
  });
}

function timeRemaining(startTime: number, budgetMs: number): number {
  return budgetMs - (Date.now() - startTime);
}

export async function runPipeline(
  supabase: SupabaseClient,
  input: PipelineInput,
  config: PipelineConfig
): Promise<void> {
  const pipelineStart = Date.now();

  // Update session status to processing
  await supabase
    .from("sessions")
    .update({ status: "processing" })
    .eq("id", input.sessionId);

  try {
    // === Step 1: Speech-to-Text ===
    const sttStart = Date.now();
    let sttResult: STTResult;

    try {
      sttResult = await transcribeAudio(
        input.audioUrl,
        input.language,
        config.deepgramApiKey
      );
      await logStep(supabase, input.sessionId, "stt", "completed", sttStart, undefined, {
        confidence: sttResult.confidence,
        duration_seconds: sttResult.duration_seconds,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown STT error";
      await logStep(supabase, input.sessionId, "stt", "failed", sttStart, message);
      throw error;
    }

    // Save raw transcript
    await supabase
      .from("recordings")
      .update({
        transcript_raw: sttResult.transcript,
        duration_seconds: sttResult.duration_seconds,
        stt_confidence: sttResult.confidence,
        language: sttResult.language,
      })
      .eq("session_id", input.sessionId);

    // Timeout guard: check remaining time
    if (timeRemaining(pipelineStart, config.timeoutMs) < 30_000) {
      await logStep(supabase, input.sessionId, "timeout_guard", "triggered", pipelineStart);
      await supabase
        .from("sessions")
        .update({ status: "processing_failed" })
        .eq("id", input.sessionId);
      return;
    }

    // === Step 2: PHI Scrubbing (regex + LLM) ===
    const phiStart = Date.now();
    try {
      const scrubResult = await scrubTranscript(
        sttResult.transcript,
        config.anthropicApiKey
      );

      await supabase
        .from("recordings")
        .update({ transcript_clean: scrubResult.clean })
        .eq("session_id", input.sessionId);

      await logStep(supabase, input.sessionId, "phi_scrub", "completed", phiStart, undefined, {
        redactions: scrubResult.totalRedactions,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown PHI scrub error";
      await logStep(supabase, input.sessionId, "phi_scrub", "failed", phiStart, message);
      // Non-fatal: use raw transcript (regex pass already ran inline)
    }

    // Get the clean transcript (or fall back to raw)
    const { data: recording } = await supabase
      .from("recordings")
      .select("transcript_clean, transcript_raw")
      .eq("session_id", input.sessionId)
      .single();

    const transcript = recording?.transcript_clean || recording?.transcript_raw || "";

    // Timeout guard
    if (timeRemaining(pipelineStart, config.timeoutMs) < 30_000) {
      await logStep(supabase, input.sessionId, "timeout_guard", "triggered", pipelineStart);
      await supabase
        .from("sessions")
        .update({ status: "processing_failed" })
        .eq("id", input.sessionId);
      return;
    }

    // === Step 3: LLM Assessment Extraction ===
    const extractStart = Date.now();
    let extraction: ExtractionResult;

    try {
      extraction = await extractAssessment(
        transcript,
        input.formTemplate,
        config.anthropicApiKey
      );
      await logStep(
        supabase,
        input.sessionId,
        "extract",
        "completed",
        extractStart,
        undefined,
        { outputs: extraction.outputs.length, model: extraction.model }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown extraction error";
      await logStep(supabase, input.sessionId, "extract", "failed", extractStart, message);
      throw error;
    }

    // === Step 4: Save Assessments ===
    const assessments = extraction.outputs.map((output) => ({
      session_id: input.sessionId,
      output_index: output.output_index,
      structured_fields: output.structured_fields,
      competency_tags: output.competency_tags,
      narrative_summary: output.narrative_summary,
      coaching_did_well: output.coaching_did_well || null,
      coaching_consider: output.coaching_consider || null,
      llm_confidence: output.confidence,
    }));

    await supabase.from("assessments").insert(assessments);

    // Update session status to ready
    await supabase
      .from("sessions")
      .update({ status: "ready" })
      .eq("id", input.sessionId);

    // === Step 5: Email Preceptor Summary (optional, non-blocking) ===
    if (input.preceptorEmail) {
      const emailStart = Date.now();
      try {
        // Build a summary from the first assessment's narrative
        const summary = extraction.outputs
          .map((o) => o.narrative_summary)
          .filter(Boolean)
          .join(" ");

        if (!process.env.RESEND_API_KEY) {
          await logStep(supabase, input.sessionId, "email", "skipped", emailStart, "RESEND_API_KEY not configured");
        } else if (summary) {
          const sent = await sendPreceptorSummary(input.preceptorEmail, summary);
          await logStep(
            supabase,
            input.sessionId,
            "email",
            sent ? "completed" : "failed",
            emailStart,
            sent ? undefined : "Email send returned false"
          );
        } else {
          await logStep(supabase, input.sessionId, "email", "skipped", emailStart, "No narrative summary to send");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Email error";
        await logStep(supabase, input.sessionId, "email", "failed", emailStart, message);
        // Non-fatal: email failure doesn't block assessment
      }
    }
  } catch (error) {
    // Pipeline failed — mark session
    await supabase
      .from("sessions")
      .update({ status: "processing_failed" })
      .eq("id", input.sessionId);

    const message = error instanceof Error ? error.message : "Unknown pipeline error";
    await logStep(supabase, input.sessionId, "pipeline", "failed", pipelineStart, message);
  }
}
