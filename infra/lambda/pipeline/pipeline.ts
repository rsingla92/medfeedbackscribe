/**
 * Debrief Processing Pipeline (async) — Gemini-only, Lambda edition
 *
 *   audio ──▶ STT ──▶ regex PHI ──▶ Gemini PHI+extract ──▶ regex PHI ──▶ save ──▶ email
 *     │         │          │               │                    │           │         │
 *     ▼         ▼          ▼               ▼                    ▼           ▼         ▼
 *   signed   Gemini     fast/local    contextual scrub     belt-and-    Postgres     SES
 *   S3 URL   multimodal patterns      + structured         suspenders   + update
 *            audio STT  (regex)       extraction           regex pass   status
 *
 * All PHI processing runs on Vertex AI northamerica-northeast1 (Montreal).
 * Defense-in-depth: regex PHI pass runs BEFORE and AFTER Gemini contextual pass.
 *
 * Error handling: failures re-throw from the Lambda handler so SQS retries.
 * On each failure path we still mark the session `processing_failed` and
 * insert a `pipeline_logs` row with structured error metadata.
 */

import {
  insertAssessments,
  insertPipelineLog,
  updateRecording,
  updateSessionStatus,
} from "./db.js";
import { sendAssessmentNotification } from "./email.js";
import {
  scrubAndExtractWithGemini,
  transcribeWithGemini,
} from "./gemini.js";
import type {
  ExtractionResult,
  PipelineConfig,
  PipelineInput,
  STTResult,
} from "./types.js";

async function logStep(
  sessionId: string,
  step: string,
  status: string,
  startTime: number,
  error?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await insertPipelineLog({
      session_id: sessionId,
      step,
      status,
      duration_ms: Date.now() - startTime,
      error_message: error,
      metadata: metadata ?? null,
    });
  } catch (logErr) {
    // Never let logging bury the original error.
    console.error(`[pipeline_logs] failed to insert ${step}/${status}:`, logErr);
  }
}

function timeRemaining(startTime: number, budgetMs: number): number {
  return budgetMs - (Date.now() - startTime);
}

export async function runPipeline(
  input: PipelineInput,
  config: PipelineConfig
): Promise<void> {
  const pipelineStart = Date.now();
  const projectId = config.gcpProjectId ?? process.env.GCP_PROJECT_ID ?? "";

  await updateSessionStatus(input.sessionId, "processing");

  try {
    // === Step 1: Speech-to-Text (Gemini multimodal) ===
    const sttStart = Date.now();
    let sttResult: STTResult;

    try {
      sttResult = await transcribeWithGemini(
        input.audioUrl,
        input.language,
        projectId
      );
      await logStep(
        input.sessionId,
        "stt",
        "completed",
        sttStart,
        undefined,
        {
          confidence: sttResult.confidence,
          duration_seconds: sttResult.duration_seconds,
          provider: "gemini",
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown STT error";
      await logStep(input.sessionId, "stt", "failed", sttStart, message);
      throw error;
    }

    // Save raw transcript
    await updateRecording(input.sessionId, {
      transcript_raw: sttResult.transcript,
      duration_seconds: sttResult.duration_seconds,
      stt_confidence: sttResult.confidence,
      language: sttResult.language,
    });

    // Timeout guard
    if (timeRemaining(pipelineStart, config.timeoutMs) < 30_000) {
      await logStep(input.sessionId, "timeout_guard", "triggered", pipelineStart);
      await updateSessionStatus(input.sessionId, "processing_failed");
      return;
    }

    // === Step 2+3: PHI scrub (regex→Gemini→regex) + extraction (Gemini) ===
    const phiStart = Date.now();
    let extraction: ExtractionResult;

    try {
      const result = await scrubAndExtractWithGemini(
        sttResult.transcript,
        input.formTemplate,
        projectId
      );

      await updateRecording(input.sessionId, {
        transcript_clean: result.clean,
      });

      await logStep(
        input.sessionId,
        "phi_scrub",
        "completed",
        phiStart,
        undefined,
        { redactions: result.totalRedactions, provider: "gemini" }
      );

      const extractStart = Date.now();
      extraction = result.extraction;
      await logStep(
        input.sessionId,
        "extract",
        "completed",
        extractStart,
        undefined,
        { outputs: extraction.outputs.length, model: extraction.model }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Gemini error";
      if (
        message.startsWith("EXTRACTION_") ||
        message === "EXTRACTION_EMPTY_RESPONSE"
      ) {
        await logStep(input.sessionId, "phi_scrub", "completed", phiStart);
        await logStep(input.sessionId, "extract", "failed", phiStart, message);
      } else {
        await logStep(input.sessionId, "phi_scrub", "failed", phiStart, message);
      }
      throw error;
    }

    // === Step 4: Save Assessments ===
    await insertAssessments(input.sessionId, extraction.outputs);

    await updateSessionStatus(input.sessionId, "ready");

    // === Step 5: Email (non-blocking) ===
    await _sendEmail(input, extraction);
  } catch (error) {
    await updateSessionStatus(input.sessionId, "processing_failed");
    const message = error instanceof Error ? error.message : "Unknown pipeline error";
    await logStep(input.sessionId, "pipeline", "failed", pipelineStart, message);
    // Re-throw so the Lambda handler returns a non-success to SQS → retry.
    throw error;
  }
}

/** Email step (non-blocking, failure does not mark session as failed). */
async function _sendEmail(
  input: PipelineInput,
  extraction: ExtractionResult
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

    if (!summary) {
      await logStep(
        input.sessionId,
        "email",
        "skipped",
        emailStart,
        "No narrative summary to send"
      );
      return;
    }

    const results: string[] = [];

    if (input.preceptorEmail) {
      const sent = await sendAssessmentNotification({
        to: input.preceptorEmail,
        recipientName: emailContext.preceptorName,
        role: "preceptor",
        ...emailContext,
      });
      results.push(`preceptor: ${sent ? "sent" : "failed"}`);
    }

    if (input.residentEmail) {
      const sent = await sendAssessmentNotification({
        to: input.residentEmail,
        recipientName: emailContext.residentName,
        role: "resident",
        ...emailContext,
      });
      results.push(`resident: ${sent ? "sent" : "failed"}`);
    }

    const adminEmail = process.env.PROGRAM_ADMIN_EMAIL;
    if (adminEmail) {
      const sent = await sendAssessmentNotification({
        to: adminEmail,
        recipientName: "Program Administrator",
        role: "preceptor",
        ...emailContext,
      });
      results.push(`admin: ${sent ? "sent" : "failed"}`);
    }

    const allSent = results.length > 0 && results.every((r) => r.includes("sent"));
    await logStep(
      input.sessionId,
      "email",
      allSent ? "completed" : results.length === 0 ? "skipped" : "failed",
      emailStart,
      allSent ? undefined : results.join(", ") || "No recipients configured",
      { recipients: results }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email error";
    await logStep(input.sessionId, "email", "failed", emailStart, message);
    // Non-fatal: email failure doesn't block assessment
  }
}
