/**
 * Debrief pipeline Lambda — SQS entrypoint.
 *
 * Flow per SQS record:
 *   1. Parse S3 event (S3 → SQS notification).
 *   2. Extract bucket + key; key format: `{userId}/{sessionId}.webm`.
 *   3. Look up the session row in Postgres to get user_id, form_template_id,
 *      language, preceptor_id, rotation_id, date.
 *   4. Generate a presigned GET URL (10 min) for Gemini.
 *   5. Invoke runPipeline().
 *   6. On exception: log to pipeline_logs + mark session processing_failed,
 *      then re-throw so SQS retries (3x before DLQ).
 *
 * All logs are emitted as structured JSON for CloudWatch Insights.
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { S3Event, S3EventRecord, SQSEvent, SQSHandler, SQSRecord } from "aws-lambda";

import {
  getFormTemplate,
  getPreceptor,
  getProfile,
  getRecording,
  getRotation,
  getSession,
  insertPipelineLog,
  updateSessionStatus,
} from "./db.js";
import { runPipeline } from "./pipeline.js";
import type { FormTemplate, PipelineInput } from "./types.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SIGNED_URL_TTL_SECONDS = 600; // 10 minutes
const PIPELINE_TIMEOUT_MS = 270_000; // 270s (Lambda timeout is 300s)

let _s3: S3Client | null = null;
function s3Client(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region:
        process.env.AWS_REGION_DEBRIEF ??
        process.env.AWS_REGION ??
        "ca-central-1",
    });
  }
  return _s3;
}

/** Test hook. */
export function _setS3ClientForTests(client: S3Client | null): void {
  _s3 = client;
}

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, msg: string, fields: Record<string, unknown> = {}): void {
  const entry = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...fields,
  };
  if (level === "error") console.error(JSON.stringify(entry));
  else if (level === "warn") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

/**
 * Redact the userId portion of an S3 object key for logging.
 *
 *   "{userId}/{sessionId}.webm"  →  "{userId[0..7]}…/{sessionId}.webm"
 *
 * userId is a UUID; the first 8 characters are still useful for cross-
 * referencing within an audit window without giving an entire CloudWatch
 * Logs reader the ability to enumerate every user's recordings. sessionId
 * is left intact (random UUID, not PHI on its own).
 */
function redactUserId(key: string): string {
  const slash = key.indexOf("/");
  if (slash <= 0) return key;
  const userId = key.substring(0, slash);
  const rest = key.substring(slash);
  return `${userId.substring(0, 8)}…${rest}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse the SQS record body as an S3 event. Returns all S3 records in the body.
 * S3 batches notifications, so there may be >1 per SQS message in theory; in
 * practice batchSize=1 + S3 PutObject keeps this to 1.
 */
function parseS3Event(sqsRecord: SQSRecord): S3EventRecord[] {
  const body = JSON.parse(sqsRecord.body) as S3Event | { Records?: S3EventRecord[] };
  return body.Records ?? [];
}

/**
 * Extract `{userId, sessionId}` from an S3 object key.
 * Expected format: `{userId}/{sessionId}.webm` (or .mp3/.mp4/.ogg).
 */
function parseObjectKey(key: string): { userId: string; sessionId: string } {
  // S3 delivers keys URL-encoded (e.g. '+' → '%2B').
  const decoded = decodeURIComponent(key.replace(/\+/g, " "));
  const slash = decoded.indexOf("/");
  if (slash <= 0) {
    throw new Error(`INVALID_OBJECT_KEY: expected "{userId}/{sessionId}.ext", got "${decoded}"`);
  }
  const userId = decoded.slice(0, slash);
  const rest = decoded.slice(slash + 1);
  const dot = rest.lastIndexOf(".");
  const sessionId = dot > 0 ? rest.slice(0, dot) : rest;
  if (!sessionId) {
    throw new Error(`INVALID_OBJECT_KEY: missing sessionId in "${decoded}"`);
  }
  return { userId, sessionId };
}

async function presignS3Get(bucket: string, key: string): Promise<string> {
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: SIGNED_URL_TTL_SECONDS }
  );
}

/**
 * Load all DB context needed to build a PipelineInput.
 * Throws if the session or form template cannot be found.
 */
async function buildPipelineInput(params: {
  sessionId: string;
  audioUrl: string;
}): Promise<PipelineInput> {
  const { sessionId, audioUrl } = params;

  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`SESSION_NOT_FOUND: ${sessionId}`);
  }

  const formTemplateRow = await getFormTemplate(session.form_template_id);
  if (!formTemplateRow) {
    throw new Error(`FORM_TEMPLATE_NOT_FOUND: ${session.form_template_id}`);
  }
  const formTemplate: FormTemplate = {
    name: formTemplateRow.name,
    extraction_mode: formTemplateRow.extraction_mode,
    max_outputs: formTemplateRow.max_outputs,
    fields: formTemplateRow.fields,
    competency_framework: formTemplateRow.competency_framework,
  };

  // Optional joins — tolerate missing rows (best-effort for email context).
  const [preceptor, rotation, profile, recording] = await Promise.all([
    session.preceptor_id ? getPreceptor(session.preceptor_id) : Promise.resolve(null),
    session.rotation_id ? getRotation(session.rotation_id) : Promise.resolve(null),
    getProfile(session.user_id),
    getRecording(sessionId),
  ]);

  return {
    sessionId,
    audioUrl,
    language: recording?.language ?? "en",
    formTemplate,
    preceptorEmail: preceptor?.email ?? undefined,
    preceptorName: preceptor?.name ?? undefined,
    residentName: profile?.full_name ?? undefined,
    residentEmail: profile?.email ?? undefined,
    rotationName: rotation?.name ?? null,
    sessionDate: session.date ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: SQSHandler = async (event: SQSEvent) => {
  log("info", "pipeline-worker invoked", {
    recordCount: event.Records.length,
  });

  // Batch size is 1, but loop anyway so the code is robust to config changes.
  for (const sqsRecord of event.Records) {
    let s3Records: S3EventRecord[];
    try {
      s3Records = parseS3Event(sqsRecord);
    } catch (err) {
      log("error", "failed to parse SQS body as S3 event", {
        messageId: sqsRecord.messageId,
        err: String(err),
      });
      // Throw so the message returns to the queue for DLQ after retries.
      throw err;
    }

    for (const s3Record of s3Records) {
      const bucket = s3Record.s3.bucket.name;
      const key = s3Record.s3.object.key;
      let sessionId: string | undefined;

      try {
        const parsed = parseObjectKey(key);
        sessionId = parsed.sessionId;

        log("info", "processing object", {
          messageId: sqsRecord.messageId,
          bucket,
          key: redactUserId(key),
          sessionId,
          userIdPrefix: parsed.userId.substring(0, 8),
        });

        const audioUrl = await presignS3Get(bucket, key);
        const input = await buildPipelineInput({ sessionId, audioUrl });

        await runPipeline(input, {
          timeoutMs: PIPELINE_TIMEOUT_MS,
          gcpProjectId: process.env.GCP_PROJECT_ID,
        });

        log("info", "pipeline completed", { sessionId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const redactedKey = redactUserId(key);
        log("error", "pipeline failed", {
          messageId: sqsRecord.messageId,
          bucket,
          key: redactedKey,
          sessionId,
          err: message,
        });

        // Best-effort: mark the session failed + log, then re-throw for retry.
        if (sessionId) {
          try {
            await updateSessionStatus(sessionId, "processing_failed");
            await insertPipelineLog({
              session_id: sessionId,
              step: "pipeline",
              status: "failed",
              error_message: message,
              metadata: { bucket, key: redactedKey, messageId: sqsRecord.messageId },
            });
          } catch (logErr) {
            log("error", "failed to persist failure state", {
              sessionId,
              err: String(logErr),
            });
          }
        }

        throw err; // SQS redelivers up to maxReceiveCount=3 before DLQ.
      }
    }
  }
};
