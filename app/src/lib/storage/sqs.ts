/**
 * AWS SQS helpers — server-side only.
 *
 * Used by /api/reprocess to manually re-enqueue a session for the Lambda
 * pipeline. Normal uploads trigger the pipeline via an S3 PutObject event,
 * so the payload shape mimics that S3 event — the Lambda doesn't need to
 * know whether a message came from S3 or from a manual retry.
 *
 * NEVER import from client code.
 */

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const REGION = process.env.AWS_REGION || "ca-central-1";

let cachedClient: SQSClient | null = null;

function getClient(): SQSClient {
  if (!cachedClient) {
    cachedClient = new SQSClient({ region: REGION });
  }
  return cachedClient;
}

export interface ReprocessEnqueueInput {
  /** S3 object key of the audio file, e.g. `user-uuid/session-uuid.webm` */
  audioKey: string;
  /** Session UUID — forwarded through the event for logging/idempotency. */
  sessionId: string;
}

/**
 * Send a synthetic S3-event message to the pipeline queue. The Lambda
 * handler parses the `Records[].s3` shape the same way whether the event
 * came from S3 or this re-enqueue path.
 */
export async function enqueueReprocess({
  audioKey,
  sessionId,
}: ReprocessEnqueueInput): Promise<void> {
  const queueUrl = process.env.SQS_PIPELINE_QUEUE_URL;
  if (!queueUrl) {
    throw new Error("SQS_PIPELINE_QUEUE_URL env var is not set");
  }

  const bucket = process.env.S3_RECORDINGS_BUCKET;
  if (!bucket) {
    throw new Error("S3_RECORDINGS_BUCKET env var is not set");
  }

  // Synthetic S3 event shape. Only the fields the Lambda actually reads are
  // populated; everything else is left out to keep the payload small.
  const body = {
    Records: [
      {
        eventSource: "debrief:reprocess",
        eventName: "ObjectCreated:Put",
        s3: {
          bucket: { name: bucket },
          object: { key: audioKey },
        },
        // Extra hint fields for the Lambda — ignored by standard S3 event parsers.
        debrief: {
          sessionId,
          trigger: "manual-reprocess",
        },
      },
    ],
  };

  await getClient().send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(body),
    })
  );
}
