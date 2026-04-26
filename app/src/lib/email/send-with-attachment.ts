/**
 * SES v2 sender that supports a single binary attachment (e.g. a PDF).
 *
 * SES `SendEmailCommand` only supports attachments via the `Raw` content
 * variant — i.e. you hand it a complete RFC 5322 message including the
 * multipart MIME envelope. We assemble that here without pulling in
 * nodemailer or mimemessage to keep the dependency surface tight.
 */

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const REGION = process.env.AWS_REGION ?? "ca-central-1";
const FROM_EMAIL =
  process.env.SES_FROM_EMAIL ?? "noreply@debriefmd.ca";

let _client: SESv2Client | null = null;
function client(): SESv2Client {
  if (!_client) _client = new SESv2Client({ region: REGION });
  return _client;
}

export interface AttachmentEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachment: {
    filename: string;
    contentType: string;
    /** Raw binary as a Node Buffer. Will be base64-encoded into the MIME. */
    body: Buffer;
  };
  /** Optional BCC for program-admin observation. */
  bcc?: string | null;
}

// Encode a header value that may contain non-ASCII characters using
// RFC 2047 encoded-word so SES doesn't reject the message.
function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

// Quote-printable-ish safe filename for Content-Disposition. We keep it
// strict ASCII; the route's filename builder already strips weird chars.
function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9 \-_.]/g, "_").slice(0, 120);
}

// Wrap base64 to 76-character lines as required by RFC 2045.
function base64Wrap(buf: Buffer): string {
  const b64 = buf.toString("base64");
  return b64.match(/.{1,76}/g)?.join("\r\n") ?? b64;
}

function buildMime(input: AttachmentEmailInput): Buffer {
  const boundary = `=_Debrief_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const altBoundary = `=_Debrief_alt_${Math.random().toString(36).slice(2, 10)}`;
  const filename = sanitizeFilename(input.attachment.filename);

  const headers: string[] = [
    `From: ${FROM_EMAIL}`,
    `To: ${input.to}`,
    ...(input.bcc ? [`Bcc: ${input.bcc}`] : []),
    `Subject: ${encodeHeader(input.subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const parts: string[] = [
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    input.text,
    "",
    `--${altBoundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    input.html,
    "",
    `--${altBoundary}--`,
    "",
    `--${boundary}`,
    `Content-Type: ${input.attachment.contentType}; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    `Content-Transfer-Encoding: base64`,
    "",
    base64Wrap(input.attachment.body),
    "",
    `--${boundary}--`,
    "",
  ];

  // RFC 5322 mandates CRLF line endings.
  const message = headers.concat("", parts).join("\r\n");
  return Buffer.from(message, "utf8");
}

export async function sendEmailWithAttachment(
  input: AttachmentEmailInput,
): Promise<void> {
  const raw = buildMime(input);
  await client().send(
    new SendEmailCommand({
      FromEmailAddress: FROM_EMAIL,
      Destination: {
        ToAddresses: [input.to],
        ...(input.bcc ? { BccAddresses: [input.bcc] } : {}),
      },
      Content: { Raw: { Data: raw } },
    }),
  );
}
