/**
 * Debrief Processing Pipeline (async) — Gemini-only
 *
 * Orchestrates the full flow from audio to structured assessment:
 *
 *   audio ──▶ STT ──▶ regex PHI ──▶ Gemini PHI+extract ──▶ regex PHI ──▶ save ──▶ email
 *     │         │          │               │                    │           │         │
 *     ▼         ▼          ▼               ▼                    ▼           ▼         ▼
 *   upload  Gemini      fast/local    contextual scrub     belt-and-    Postgres   Resend
 *           multimodal  patterns      + structured         suspenders   + update   (optional)
 *           audio STT   (regex)       extraction           regex pass   status
 *
 * All PHI processing runs on Vertex AI northamerica-northeast1 (Montreal).
 * Defense-in-depth: regex PHI pass runs BEFORE and AFTER Gemini contextual pass.
 *
 * Timeout guard: saves partial progress if approaching Edge Function limit.
 * Each step is logged to pipeline_logs for observability.
 */

import { scrubAndExtractWithGemini, transcribeWithGemini } from "./gemini";
import type { STTResult } from "./gemini";
import type { ExtractionResult } from "./extract";
import { sendAssessmentNotification } from "@/lib/email";
import type { SupabaseClient } from "@supabase/supabase-js";

interface PipelineConfig {
  timeoutMs: number; // Edge Function budget
  gcpProjectId?: string;
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
  preceptorName?: string;
  residentName?: string;
  residentEmail?: string;
  rotationName?: string | null;
  sessionDate?: string;
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
  const projectId = config.gcpProjectId ?? process.env.GCP_PROJECT_ID ?? "";

  // Update session status to processing
  await supabase
    .from("sessions")
    .update({ status: "processing" })
    .eq("id", input.sessionId);

  try {
    // ======================================================================
    // GEMINI PATH (Vertex AI northamerica-northeast1 — all PHI stays in CA)
    // ======================================================================

    // === Step 1: Speech-to-Text (Gemini multimodal) ===
    const sttStart = Date.now();
    let sttResult: STTResult;

    try {
      sttResult = await transcribeWithGemini(
        input.audioUrl,
        input.language,
        projectId
      );
      await logStep(supabase, input.sessionId, "stt", "completed", sttStart, undefined, {
        confidence: sttResult.confidence,
        duration_seconds: sttResult.duration_seconds,
        provider: "gemini",
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

    // Timeout guard
    if (timeRemaining(pipelineStart, config.timeoutMs) < 30_000) {
      await logStep(supabase, input.sessionId, "timeout_guard", "triggered", pipelineStart);
      await supabase
        .from("sessions")
        .update({ status: "processing_failed" })
        .eq("id", input.sessionId);
      return;
    }

    // === Step 2+3: PHI scrub (regex→Gemini→regex) + extraction (Gemini) ===
    // scrubAndExtractWithGemini runs the full belt-and-suspenders pipeline:
    //   regexScrub → Gemini contextual scrub → regexScrub again → Gemini extract
    const phiStart = Date.now();
    let extraction: ExtractionResult;

    try {
      const result = await scrubAndExtractWithGemini(
        sttResult.transcript,
        input.formTemplate,
        projectId
      );

      await supabase
        .from("recordings")
        .update({ transcript_clean: result.clean })
        .eq("session_id", input.sessionId);

      await logStep(supabase, input.sessionId, "phi_scrub", "completed", phiStart, undefined, {
        redactions: result.totalRedactions,
        provider: "gemini",
      });

      const extractStart = Date.now();
      extraction = result.extraction;
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
      const message = error instanceof Error ? error.message : "Unknown Gemini error";

      // Determine which step failed based on error message
      if (
        message.startsWith("EXTRACTION_") ||
        message === "EXTRACTION_EMPTY_RESPONSE"
      ) {
        await logStep(supabase, input.sessionId, "phi_scrub", "completed", phiStart);
        await logStep(supabase, input.sessionId, "extract", "failed", phiStart, message);
      } else {
        await logStep(supabase, input.sessionId, "phi_scrub", "failed", phiStart, message);
      }
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

    await supabase
      .from("sessions")
      .update({ status: "ready" })
      .eq("id", input.sessionId);

    // === Step 5: Email (non-blocking) ===
    await _sendEmail(supabase, input, extraction, pipelineStart);

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

/** Email step (non-blocking, failure does not mark session as failed). */
async function _sendEmail(
  supabase: SupabaseClient,
  input: PipelineInput,
  extraction: ExtractionResult,
  pipelineStart: number
): Promise<void> {
  const emailStart = Date.now();
  try {
    const summary = extraction.outputs
      .map((o) => o.narrative_summary)
      .filter(Boolean)
      .join(" ");

    const firstOutput = extraction.outputs[0];
    const emailContext = {
      preceptorName: input.preceptorName ?? "Preceptor",
      residentName: input.residentName ?? "Resident",
      rotation: input.rotationName ?? null,
      date: input.sessionDate ?? new Date().toLocaleDateString("en-CA"),
      narrativeSummary: summary,
      coachingDidWell: firstOutput?.coaching_did_well ?? null,
      coachingConsider: firstOutput?.coaching_consider ?? null,
    };

    if (!process.env.RESEND_API_KEY) {
      await logStep(supabase, input.sessionId, "email", "skipped", emailStart, "RESEND_API_KEY not configured");
    } else if (summary) {
      const results: string[] = [];

      // Email preceptor
      if (input.preceptorEmail) {
        const sent = await sendAssessmentNotification({
          to: input.preceptorEmail,
          recipientName: emailContext.preceptorName,
          role: "preceptor",
          ...emailContext,
        });
        results.push(`preceptor: ${sent ? "sent" : "failed"}`);
      }

      // Email resident
      if (input.residentEmail) {
        const sent = await sendAssessmentNotification({
          to: input.residentEmail,
          recipientName: emailContext.residentName,
          role: "resident",
          ...emailContext,
        });
        results.push(`resident: ${sent ? "sent" : "failed"}`);
      }

      // Email program admin (if configured via env var)
      const adminEmail = process.env.PROGRAM_ADMIN_EMAIL;
      if (adminEmail) {
        const sent = await sendAssessmentNotification({
          to: adminEmail,
          recipientName: "Program Administrator",
          role: "preceptor", // admin sees preceptor perspective
          ...emailContext,
        });
        results.push(`admin: ${sent ? "sent" : "failed"}`);
      }

      const allSent = results.every((r) => r.includes("sent"));
      await logStep(
        supabase,
        input.sessionId,
        "email",
        allSent ? "completed" : "failed",
        emailStart,
        allSent ? undefined : results.join(", "),
        { recipients: results }
      );
    } else {
      await logStep(supabase, input.sessionId, "email", "skipped", emailStart, "No narrative summary to send");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email error";
    await logStep(supabase, input.sessionId, "email", "failed", emailStart, message);
    // Non-fatal: email failure doesn't block assessment
  }
  void pipelineStart;
}
