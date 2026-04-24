/**
 * AWS S3 storage helpers — server-side only.
 *
 * Exports `getPresignedUploadUrl` which returns a short-lived PUT URL the
 * browser can use to upload audio blobs directly to S3. An S3 PutObject
 * event then fires → SQS → Lambda, which runs the processing pipeline
 * (STT, PHI scrubbing, extraction, email). The Next.js app no longer
 * does that work itself.
 *
 * Key format: `${userId}/${sessionId}.webm` — matches the Supabase Storage
 * path convention so DB `audio_path` values stay compatible during the
 * Supabase → AWS migration (Phase 1 of 4).
 *
 * NEVER import this module from client code — it uses AWS credentials
 * from the process environment (IAM role on the server, access keys
 * in dev). Exposing it client-side would leak signing creds.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// 10 minutes — long enough for a slow mobile upload, short enough that a
// leaked URL can't be replayed after the user moves on.
const PRESIGN_EXPIRES_SECONDS = 10 * 60;

const REGION = process.env.AWS_REGION || "ca-central-1";

// Lazy singleton — the SDK v3 client is cheap, but we only want to construct
// it on demand so unit tests can stub it before import side-effects run.
let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({ region: REGION });
  }
  return cachedClient;
}

/**
 * Build the S3 object key for a session's audio file. Mirrors the old
 * Supabase Storage path so downstream consumers (Lambda, review page)
 * don't need to change.
 */
export function buildAudioKey(userId: string, sessionId: string): string {
  return `${userId}/${sessionId}.webm`;
}

export interface PresignedUploadInput {
  userId: string;
  sessionId: string;
  contentType: string;
}

export interface PresignedUploadResult {
  url: string;
  key: string;
}

/**
 * Generate a presigned PUT URL for uploading a recording.
 *
 * The returned URL expires in 10 minutes. The browser should PUT the blob
 * directly to `url` with the exact same `Content-Type` header it was signed
 * with — otherwise S3 rejects the request.
 */
export async function getPresignedUploadUrl({
  userId,
  sessionId,
  contentType,
}: PresignedUploadInput): Promise<PresignedUploadResult> {
  const bucket = process.env.S3_RECORDINGS_BUCKET;
  if (!bucket) {
    throw new Error("S3_RECORDINGS_BUCKET env var is not set");
  }

  const key = buildAudioKey(userId, sessionId);

  // Local dev without AWS creds: return a stub URL that the browser can PUT
  // to (harmlessly). The browser PUT will 404 but the app flow continues —
  // Lambda isn't wired locally either. Production has real credentials from
  // the App Runner instance role.
  if (
    process.env.NODE_ENV !== "production" &&
    !process.env.AWS_ACCESS_KEY_ID &&
    !process.env.AWS_PROFILE &&
    !process.env.AWS_WEB_IDENTITY_TOKEN_FILE
  ) {
    return { url: `about:blank#dev-no-aws-creds/${key}`, key };
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(getClient(), command, {
    expiresIn: PRESIGN_EXPIRES_SECONDS,
  });

  return { url, key };
}

/**
 * Generate a presigned GET URL so the browser can play back a recording.
 * 1-hour expiry — covers a long review session.
 */
export async function getPresignedPlaybackUrl(key: string): Promise<string> {
  const bucket = process.env.S3_RECORDINGS_BUCKET;
  if (!bucket) throw new Error("S3_RECORDINGS_BUCKET env var is not set");
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: 60 * 60 });
}
