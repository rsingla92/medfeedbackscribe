/**
 * Handler tests — verify SQS event → runPipeline wiring.
 *
 * Mocks out runPipeline + db + S3 presigner so we can assert purely on the
 * sessionId derivation and DB context assembly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../pipeline.js", () => ({
  runPipeline: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.example/presigned"),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    async send() {
      return {};
    }
  }
  class GetObjectCommand {
    constructor(public input: unknown) {}
  }
  return { S3Client, GetObjectCommand };
});

vi.mock("../db.js", () => ({
  getSession: vi.fn(),
  getFormTemplate: vi.fn(),
  getPreceptor: vi.fn(),
  getRotation: vi.fn(),
  getProfile: vi.fn(),
  getRecording: vi.fn(),
  updateSessionStatus: vi.fn(),
  insertPipelineLog: vi.fn(),
}));

import { handler } from "../handler.js";
import { runPipeline } from "../pipeline.js";
import {
  getSession,
  getFormTemplate,
  getPreceptor,
  getRotation,
  getProfile,
  insertPipelineLog,
  updateSessionStatus,
} from "../db.js";

const mockRunPipeline = vi.mocked(runPipeline);
const mockGetSession = vi.mocked(getSession);
const mockGetFormTemplate = vi.mocked(getFormTemplate);
const mockGetPreceptor = vi.mocked(getPreceptor);
const mockGetRotation = vi.mocked(getRotation);
const mockGetProfile = vi.mocked(getProfile);
const mockInsertPipelineLog = vi.mocked(insertPipelineLog);
const mockUpdateSessionStatus = vi.mocked(updateSessionStatus);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSqsEvent(bucket: string, key: string) {
  const s3Event = {
    Records: [
      {
        s3: {
          bucket: { name: bucket },
          object: { key },
        },
      },
    ],
  };
  return {
    Records: [
      {
        messageId: "msg-1",
        receiptHandle: "r1",
        body: JSON.stringify(s3Event),
        attributes: {},
        messageAttributes: {},
        md5OfBody: "",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs:ca-central-1:000:debrief-pipeline-queue",
        awsRegion: "ca-central-1",
      },
    ],
  } as unknown as Parameters<typeof handler>[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handler (SQS → runPipeline)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunPipeline.mockResolvedValue(undefined);
    mockGetSession.mockResolvedValue({
      id: "session-abc",
      user_id: "user-123",
      preceptor_id: "preceptor-1",
      rotation_id: "rotation-1",
      form_template_id: "template-1",
      date: "2026-04-14",
      status: "created",
    });
    mockGetFormTemplate.mockResolvedValue({
      id: "template-1",
      name: "T-Res Field Note",
      extraction_mode: "multi",
      max_outputs: 5,
      fields: { skill_dimension: { type: "select" } },
      competency_framework: "CanMEDS",
    });
    mockGetPreceptor.mockResolvedValue({
      id: "preceptor-1",
      name: "Dr. Alice",
      email: "alice@hospital.ca",
    });
    mockGetRotation.mockResolvedValue({ id: "rotation-1", name: "EM" });
    mockGetProfile.mockResolvedValue({ id: "user-123", full_name: "Dr. Bob" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("derives sessionId from the object key and invokes runPipeline", async () => {
    const event = makeSqsEvent(
      "debrief-recordings-000-ca-central-1",
      "user-123/session-abc.webm"
    );

    await handler(event, {} as never, (() => {}) as never);

    expect(mockRunPipeline).toHaveBeenCalledTimes(1);
    const [input, config] = mockRunPipeline.mock.calls[0];
    expect(input.sessionId).toBe("session-abc");
    expect(input.audioUrl).toBe("https://s3.example/presigned");
    expect(input.formTemplate.name).toBe("T-Res Field Note");
    expect(input.preceptorEmail).toBe("alice@hospital.ca");
    expect(input.preceptorName).toBe("Dr. Alice");
    expect(input.rotationName).toBe("EM");
    expect(input.residentName).toBe("Dr. Bob");
    expect(config.gcpProjectId).toBeUndefined(); // env not set in test
    expect(config.timeoutMs).toBeGreaterThan(60_000);
  });

  it("decodes URL-encoded S3 keys", async () => {
    const event = makeSqsEvent(
      "bucket",
      "user-123/session%2Dabc.webm"
    );

    await handler(event, {} as never, (() => {}) as never);

    const [input] = mockRunPipeline.mock.calls[0];
    expect(input.sessionId).toBe("session-abc");
  });

  it("handles keys without extension gracefully", async () => {
    const event = makeSqsEvent("bucket", "user-123/session-noext");

    await handler(event, {} as never, (() => {}) as never);

    const [input] = mockRunPipeline.mock.calls[0];
    expect(input.sessionId).toBe("session-noext");
  });

  it("throws and marks session failed when runPipeline errors", async () => {
    mockRunPipeline.mockRejectedValue(new Error("pipeline exploded"));

    const event = makeSqsEvent("bucket", "user-123/session-fail.webm");

    await expect(
      handler(event, {} as never, (() => {}) as never)
    ).rejects.toThrow("pipeline exploded");

    expect(mockUpdateSessionStatus).toHaveBeenCalledWith("session-fail", "processing_failed");
    expect(mockInsertPipelineLog).toHaveBeenCalled();
    const logArg = mockInsertPipelineLog.mock.calls[0][0];
    expect(logArg).toMatchObject({
      session_id: "session-fail",
      step: "pipeline",
      status: "failed",
    });
  });

  it("throws when session is not found in DB", async () => {
    mockGetSession.mockResolvedValue(null);

    const event = makeSqsEvent("bucket", "user-123/session-missing.webm");

    await expect(
      handler(event, {} as never, (() => {}) as never)
    ).rejects.toThrow(/SESSION_NOT_FOUND/);
  });

  it("throws on malformed object key (no slash)", async () => {
    const event = makeSqsEvent("bucket", "no-slash-key.webm");

    await expect(
      handler(event, {} as never, (() => {}) as never)
    ).rejects.toThrow(/INVALID_OBJECT_KEY/);
  });
});
