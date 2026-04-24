/**
 * Unit tests for the Lambda pipeline orchestrator (pipeline.ts).
 *
 * Mock strategy:
 * - vi.mock() external modules: gemini, email, db
 * - Use mocked db helpers as call-record targets (similar spirit to the
 *   Supabase fake in the Next.js app tests).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../email.js", () => ({
  sendAssessmentNotification: vi.fn(),
}));

vi.mock("../gemini.js", () => ({
  transcribeWithGemini: vi.fn(),
  scrubAndExtractWithGemini: vi.fn(),
  _resetVertexClient: vi.fn(),
}));

vi.mock("../db.js", () => ({
  updateSessionStatus: vi.fn(),
  updateRecording: vi.fn(),
  insertAssessments: vi.fn(),
  insertPipelineLog: vi.fn(),
  getSession: vi.fn(),
  getFormTemplate: vi.fn(),
  getPreceptor: vi.fn(),
  getRotation: vi.fn(),
  getProfile: vi.fn(),
  getRecording: vi.fn(),
  getSql: vi.fn(),
  closeSql: vi.fn(),
  _setSqlClientForTests: vi.fn(),
}));

import { runPipeline } from "../pipeline.js";
import { sendAssessmentNotification } from "../email.js";
import { transcribeWithGemini, scrubAndExtractWithGemini } from "../gemini.js";
import {
  getSession,
  insertAssessments,
  insertPipelineLog,
  updateRecording,
  updateSessionStatus,
} from "../db.js";

const mockSendAssessmentNotification = vi.mocked(sendAssessmentNotification);
const mockTranscribeWithGemini = vi.mocked(transcribeWithGemini);
const mockScrubAndExtractWithGemini = vi.mocked(scrubAndExtractWithGemini);
const mockGetSession = vi.mocked(getSession);
const mockInsertAssessments = vi.mocked(insertAssessments);
const mockInsertPipelineLog = vi.mocked(insertPipelineLog);
const mockUpdateRecording = vi.mocked(updateRecording);
const mockUpdateSessionStatus = vi.mocked(updateSessionStatus);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusUpdates(): string[] {
  return mockUpdateSessionStatus.mock.calls.map((c) => c[1]);
}

function recordingUpdates(): Array<Record<string, unknown>> {
  return mockUpdateRecording.mock.calls.map((c) => c[1] as Record<string, unknown>);
}

function logCalls(): Array<Record<string, unknown>> {
  return mockInsertPipelineLog.mock.calls.map(
    (c) => c[0] as unknown as Record<string, unknown>
  );
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseInput = {
  sessionId: "session-123",
  audioUrl: "https://storage.example.com/audio.webm",
  language: "en" as const,
  formTemplate: {
    name: "T-Res Field Note",
    extraction_mode: "multi" as const,
    max_outputs: 5,
    fields: { skill_dimension: { type: "select", options: ["Medical Expert"] } },
    competency_framework: "CanMEDS",
  },
  preceptorEmail: "preceptor@hospital.ca",
  preceptorName: "Dr. Smith",
  residentName: "Dr. Jones",
  residentEmail: "jones@hospital.ca",
  rotationName: "Internal Medicine",
  sessionDate: "2026-04-14",
};

const baseConfig = {
  timeoutMs: 300_000,
  gcpProjectId: "test-gcp-project",
};

const goodSTTResult = {
  transcript: "The resident performed an excellent intubation.",
  confidence: 0.9,
  duration_seconds: 0,
  language: "en",
};

const goodScrubExtractResult = {
  clean: "The resident performed an excellent intubation.",
  totalRedactions: 0,
  extraction: {
    outputs: [
      {
        output_index: 1,
        structured_fields: { skill_dimension: "Medical Expert", rating: 4 },
        competency_tags: ["Medical Expert"],
        narrative_summary: "Resident performed an excellent intubation.",
        coaching_did_well: "Smooth technique.",
        coaching_consider: "Communicate steps aloud.",
        confidence: { skill_dimension: 0.9, rating: 0.85 },
      },
    ],
    model: "gemini-2.5-flash-preview-04-17",
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runPipeline", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    mockSendAssessmentNotification.mockResolvedValue(true);
    vi.stubEnv("GCP_PROJECT_ID", "test-project");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("happy path", () => {
    it("sets session status to processing at the start", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);

      await runPipeline(baseInput, baseConfig);

      expect(statusUpdates()[0]).toBe("processing");
    });

    it("calls transcribeWithGemini with correct arguments", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);

      await runPipeline(baseInput, baseConfig);

      expect(mockTranscribeWithGemini).toHaveBeenCalledWith(
        baseInput.audioUrl,
        baseInput.language,
        baseConfig.gcpProjectId
      );
    });

    it("saves raw transcript to recordings after STT", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);

      await runPipeline(baseInput, baseConfig);

      const rawUpdate = recordingUpdates().find(
        (u) => u.transcript_raw !== undefined
      );
      expect(rawUpdate).toBeDefined();
      expect(rawUpdate!).toMatchObject({
        transcript_raw: goodSTTResult.transcript,
        duration_seconds: goodSTTResult.duration_seconds,
        stt_confidence: goodSTTResult.confidence,
        language: goodSTTResult.language,
      });
    });

    it("calls scrubAndExtractWithGemini with STT transcript", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);

      await runPipeline(baseInput, baseConfig);

      expect(mockScrubAndExtractWithGemini).toHaveBeenCalledWith(
        goodSTTResult.transcript,
        baseInput.formTemplate,
        baseConfig.gcpProjectId
      );
    });

    it("saves clean transcript to recordings after PHI scrub", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);

      await runPipeline(baseInput, baseConfig);

      const cleanUpdate = recordingUpdates().find(
        (u) => u.transcript_clean !== undefined
      );
      expect(cleanUpdate).toBeDefined();
      expect(cleanUpdate!).toMatchObject({
        transcript_clean: goodScrubExtractResult.clean,
      });
    });

    it("inserts assessments with correct shape", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);

      await runPipeline(baseInput, baseConfig);

      expect(mockInsertAssessments).toHaveBeenCalledTimes(1);
      const [sessionId, outputs] = mockInsertAssessments.mock.calls[0];
      expect(sessionId).toBe(baseInput.sessionId);
      expect(outputs).toHaveLength(1);
      expect(outputs[0]).toMatchObject({
        output_index: 1,
        structured_fields: goodScrubExtractResult.extraction.outputs[0].structured_fields,
        competency_tags: goodScrubExtractResult.extraction.outputs[0].competency_tags,
        narrative_summary: goodScrubExtractResult.extraction.outputs[0].narrative_summary,
        coaching_did_well: goodScrubExtractResult.extraction.outputs[0].coaching_did_well,
        coaching_consider: goodScrubExtractResult.extraction.outputs[0].coaching_consider,
      });
    });

    it("sets session status to ready at the end", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);

      await runPipeline(baseInput, baseConfig);

      const updates = statusUpdates();
      expect(updates[updates.length - 1]).toBe("ready");
    });

    it("logs stt and phi_scrub and extract steps as completed", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);

      await runPipeline(baseInput, baseConfig);

      const logs = logCalls();
      const steps = logs.map((l) => l.step);
      expect(steps).toContain("stt");
      expect(steps).toContain("phi_scrub");
      expect(steps).toContain("extract");
      expect(steps).toContain("email");

      const sttLog = logs.find((l) => l.step === "stt");
      expect(sttLog).toMatchObject({ step: "stt", status: "completed" });
    });
  });

  describe("STT failure", () => {
    it("logs stt step as failed", async () => {
      mockTranscribeWithGemini.mockRejectedValue(new Error("STT_FETCH_ERROR: 500 Internal Server Error"));

      await expect(runPipeline(baseInput, baseConfig)).rejects.toThrow();

      const sttLog = logCalls().find((l) => l.step === "stt");
      expect(sttLog).toBeDefined();
      expect(sttLog).toMatchObject({ step: "stt", status: "failed" });
    });

    it("sets session status to processing_failed", async () => {
      mockTranscribeWithGemini.mockRejectedValue(new Error("STT_EMPTY_TRANSCRIPT"));

      await expect(runPipeline(baseInput, baseConfig)).rejects.toThrow();

      expect(statusUpdates()).toContain("processing_failed");
    });

    it("does not call scrubAndExtractWithGemini after STT failure", async () => {
      mockTranscribeWithGemini.mockRejectedValue(new Error("STT_ERROR"));

      await expect(runPipeline(baseInput, baseConfig)).rejects.toThrow();
      expect(mockScrubAndExtractWithGemini).not.toHaveBeenCalled();
    });
  });

  describe("PHI scrub / extract failure", () => {
    it("does NOT reach assessment insert when scrubAndExtract fails", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockRejectedValue(new Error("Gemini 503"));

      await expect(runPipeline(baseInput, baseConfig)).rejects.toThrow();
      expect(mockInsertAssessments).not.toHaveBeenCalled();
    });

    it("sets session status to processing_failed when PHI scrub fails", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockRejectedValue(new Error("Gemini 503"));

      await expect(runPipeline(baseInput, baseConfig)).rejects.toThrow();
      expect(statusUpdates()).toContain("processing_failed");
    });

    it("logs phi_scrub step as failed on non-extraction error", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockRejectedValue(new Error("Gemini quota"));

      await expect(runPipeline(baseInput, baseConfig)).rejects.toThrow();

      const phiLog = logCalls().find((l) => l.step === "phi_scrub");
      expect(phiLog).toBeDefined();
      expect(phiLog).toMatchObject({ step: "phi_scrub", status: "failed" });
    });

    it("logs extract step as failed on EXTRACTION_ error", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockRejectedValue(
        new Error("EXTRACTION_PARSE_ERROR: no JSON")
      );

      await expect(runPipeline(baseInput, baseConfig)).rejects.toThrow();

      const extractLog = logCalls().find((l) => l.step === "extract");
      expect(extractLog).toBeDefined();
      expect(extractLog).toMatchObject({ step: "extract", status: "failed" });
    });
  });

  describe("timeout guard after STT", () => {
    it("sets processing_failed and does not proceed to PHI/extract when time is low", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);

      const tightConfig = { ...baseConfig, timeoutMs: 0 };

      await runPipeline(baseInput, tightConfig);

      expect(statusUpdates()).toContain("processing_failed");
      expect(mockScrubAndExtractWithGemini).not.toHaveBeenCalled();
    });

    it("logs timeout_guard step as triggered", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);

      const tightConfig = { ...baseConfig, timeoutMs: 0 };
      await runPipeline(baseInput, tightConfig);

      const timeoutLog = logCalls().find((l) => l.step === "timeout_guard");
      expect(timeoutLog).toBeDefined();
      expect(timeoutLog).toMatchObject({ step: "timeout_guard", status: "triggered" });
    });
  });

  describe("assessment insert shape", () => {
    it("handles multiple outputs preserving coaching fields", async () => {
      const multiOutput = {
        clean: "The resident did well.",
        totalRedactions: 0,
        extraction: {
          outputs: [
            {
              output_index: 1,
              structured_fields: { rating: 4 },
              competency_tags: ["Medical Expert"],
              narrative_summary: "First encounter summary.",
              coaching_did_well: "Good airway management.",
              coaching_consider: "Document in chart.",
              confidence: { rating: 0.9 },
            },
            {
              output_index: 2,
              structured_fields: { rating: 3 },
              competency_tags: ["Communicator"],
              narrative_summary: "Second encounter summary.",
              coaching_did_well: undefined,
              coaching_consider: undefined,
              confidence: { rating: 0.7 },
            },
          ],
          model: "gemini-2.5-flash-preview-04-17",
        },
      };

      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(multiOutput);

      await runPipeline(baseInput, baseConfig);

      expect(mockInsertAssessments).toHaveBeenCalledTimes(1);
      const [, outputs] = mockInsertAssessments.mock.calls[0];
      expect(outputs).toHaveLength(2);
      expect(outputs[0]).toMatchObject({
        output_index: 1,
        structured_fields: { rating: 4 },
        competency_tags: ["Medical Expert"],
        coaching_did_well: "Good airway management.",
        coaching_consider: "Document in chart.",
      });
      expect(outputs[1]).toMatchObject({
        output_index: 2,
        competency_tags: ["Communicator"],
      });
    });
  });

  describe("email step", () => {
    it("skips email when narrative summary is empty", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue({
        clean: "text",
        totalRedactions: 0,
        extraction: {
          outputs: [
            {
              output_index: 1,
              structured_fields: {},
              competency_tags: [],
              narrative_summary: "",
              coaching_did_well: undefined,
              coaching_consider: undefined,
              confidence: {},
            },
          ],
          model: "gemini-2.5-flash-preview-04-17",
        },
      });

      await runPipeline(baseInput, baseConfig);

      expect(mockSendAssessmentNotification).not.toHaveBeenCalled();

      const emailLog = logCalls().find((l) => l.step === "email");
      expect(emailLog).toMatchObject({ step: "email", status: "skipped" });
    });

    it("sends to preceptor and resident when both are set", async () => {
      delete process.env.PROGRAM_ADMIN_EMAIL;

      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);

      await runPipeline(baseInput, baseConfig);

      expect(mockSendAssessmentNotification).toHaveBeenCalledTimes(2);

      const calls = mockSendAssessmentNotification.mock.calls;
      const toAddresses = calls.map((c) => c[0].to);
      expect(toAddresses).toContain(baseInput.preceptorEmail);
      expect(toAddresses).toContain(baseInput.residentEmail);

      const preceptorCall = calls.find((c) => c[0].to === baseInput.preceptorEmail);
      expect(preceptorCall![0].role).toBe("preceptor");

      const residentCall = calls.find((c) => c[0].to === baseInput.residentEmail);
      expect(residentCall![0].role).toBe("resident");
    });

    it("also sends to admin when PROGRAM_ADMIN_EMAIL is set", async () => {
      vi.stubEnv("PROGRAM_ADMIN_EMAIL", "admin@hospital.ca");

      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);

      await runPipeline(baseInput, baseConfig);

      expect(mockSendAssessmentNotification).toHaveBeenCalledTimes(3);
      const toAddresses = mockSendAssessmentNotification.mock.calls.map((c) => c[0].to);
      expect(toAddresses).toContain("admin@hospital.ca");
    });
  });

  describe("email failure (non-fatal)", () => {
    it("session still reaches ready when email throws", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);
      mockSendAssessmentNotification.mockRejectedValue(new Error("SES 429"));

      await runPipeline(baseInput, baseConfig);

      expect(statusUpdates()).toContain("ready");
    });

    it("logs email step as failed when email throws", async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);
      mockSendAssessmentNotification.mockRejectedValue(new Error("SES 429"));

      await runPipeline(baseInput, baseConfig);

      const emailLog = logCalls().find((l) => l.step === "email");
      expect(emailLog).toBeDefined();
      expect(emailLog).toMatchObject({ step: "email", status: "failed" });
    });

    it("logs email step as failed when sendAssessmentNotification returns false", async () => {
      delete process.env.PROGRAM_ADMIN_EMAIL;
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);
      mockSendAssessmentNotification.mockResolvedValue(false);

      await runPipeline(baseInput, baseConfig);

      const emailLog = logCalls().find((l) => l.step === "email");
      expect(emailLog).toMatchObject({ step: "email", status: "failed" });

      expect(statusUpdates()).toContain("ready");
    });
  });

  describe("SQS retry guard (skip-if-ready)", () => {
    it("returns early without calling STT when session is already 'ready'", async () => {
      mockGetSession.mockResolvedValue({
        id: baseInput.sessionId,
        user_id: "user-1",
        preceptor_id: "preceptor-1",
        rotation_id: null,
        form_template_id: "ft-1",
        date: "2026-04-14",
        status: "ready",
      });

      await runPipeline(baseInput, baseConfig);

      expect(mockTranscribeWithGemini).not.toHaveBeenCalled();
      expect(mockScrubAndExtractWithGemini).not.toHaveBeenCalled();
      expect(mockInsertAssessments).not.toHaveBeenCalled();
      expect(mockUpdateSessionStatus).not.toHaveBeenCalled();
    });

    it("returns early without calling STT when session is already 'exported'", async () => {
      mockGetSession.mockResolvedValue({
        id: baseInput.sessionId,
        user_id: "user-1",
        preceptor_id: "preceptor-1",
        rotation_id: null,
        form_template_id: "ft-1",
        date: "2026-04-14",
        status: "exported",
      });

      await runPipeline(baseInput, baseConfig);

      expect(mockTranscribeWithGemini).not.toHaveBeenCalled();
      expect(mockUpdateSessionStatus).not.toHaveBeenCalled();
    });

    it("proceeds normally when session status is 'processing' (in-flight retry)", async () => {
      mockGetSession.mockResolvedValue({
        id: baseInput.sessionId,
        user_id: "user-1",
        preceptor_id: "preceptor-1",
        rotation_id: null,
        form_template_id: "ft-1",
        date: "2026-04-14",
        status: "processing",
      });
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult);
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult);

      await runPipeline(baseInput, baseConfig);

      expect(mockTranscribeWithGemini).toHaveBeenCalled();
      expect(statusUpdates()).toContain("ready");
    });
  });
});
