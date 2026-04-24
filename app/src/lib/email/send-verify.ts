/**
 * Email-change confirmation sender.
 *
 * Dispatches the "confirm your notification email" link used by the
 * onboarding / profile flow when a resident provides an institutional email
 * that differs from their authenticated `users.email`. The link points at
 * `/api/profile/confirm-email?token=...`, which atomically promotes
 * `profiles.pending_email` → `profiles.email`.
 *
 * Kept separate from `send-magic-link.ts` (sign-in) because:
 *   - The two mailers have different subject lines / UX copy.
 *   - Auth.js owns the magic-link sender; this one is app-owned.
 * Both use the same SES v2 client pattern, same FROM_EMAIL env, same region.
 */

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const FROM_EMAIL =
  process.env.SES_FROM_EMAIL ?? "noreply@debrief.whitecoatprep.com";
const REGION = process.env.AWS_REGION ?? "ca-central-1";

let _client: SESv2Client | null = null;
function client(): SESv2Client {
  if (!_client) _client = new SESv2Client({ region: REGION });
  return _client;
}

interface SendEmailChangeConfirmationParams {
  /** Destination — the new, unverified email the resident supplied. */
  to: string;
  /** Random token issued by the onboarding/profile flow. */
  token: string;
  /** Resident's display name (optional, for a warmer salutation). */
  residentName?: string | null;
}

export async function sendEmailChangeConfirmation({
  to,
  token,
  residentName,
}: SendEmailChangeConfirmationParams): Promise<void> {
  // AUTH_URL is required here: the confirmation link must resolve to the
  // pinned origin so an attacker who forges the Host header can't trick us
  // into sending a link to evil.com. We mirror the send-magic-link.ts guard.
  const authUrl = process.env.AUTH_URL;
  if (!authUrl) {
    throw new Error(
      "AUTH_URL must be set to send email-change confirmations",
    );
  }
  const expectedOrigin = new URL(authUrl).origin;
  const url = `${expectedOrigin}/api/profile/confirm-email?token=${encodeURIComponent(token)}`;

  // Defense in depth: re-parse the URL we just built and confirm it's still
  // the expected origin (catches any future refactor that introduces
  // untrusted concatenation).
  if (new URL(url).origin !== expectedOrigin) {
    throw new Error("Refusing to send confirmation for unexpected host");
  }

  const greeting = residentName?.trim()
    ? `Hi ${escapeHtml(residentName.trim().split(" ")[0])},`
    : "Hi,";

  const subject = "Confirm your Debrief notification email";

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#faf8f5;font-family:'DM Sans',-apple-system,system-ui,sans-serif;color:#1c1917;">
  <div style="max-width:480px;margin:0 auto;padding:48px 24px;">
    <h1 style="font-family:'Instrument Serif',Georgia,serif;font-size:36px;font-weight:400;line-height:1.1;letter-spacing:-0.01em;margin:0 0 24px;">
      Confirm your notification email
    </h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#44403c;">
      ${greeting}
    </p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 32px;color:#44403c;">
      You asked Debrief to send your coaching-note notifications to
      <strong>${escapeHtml(to)}</strong>. Click the button below to confirm
      this address. The link expires in 24 hours.
    </p>
    <p style="margin:0 0 32px;">
      <a href="${url}"
         style="display:inline-block;background:#D97706;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:500;font-size:16px;">
        Confirm email
      </a>
    </p>
    <p style="font-size:14px;line-height:1.6;color:#78716c;margin:0 0 8px;">
      Or copy and paste this URL into your browser:
    </p>
    <p style="font-size:13px;line-height:1.5;color:#78716c;word-break:break-all;margin:0 0 32px;">
      ${url}
    </p>
    <hr style="border:0;border-top:1px solid #e7e5e4;margin:32px 0;" />
    <p style="font-size:13px;line-height:1.5;color:#a8a29e;margin:0;">
      If you didn't request this change, you can safely ignore this email —
      your notification address will stay as it was.
    </p>
  </div>
</body>
</html>`;

  const text = `Confirm your Debrief notification email

${greeting.replace(/&#39;/g, "'")}

You asked Debrief to send your coaching-note notifications to ${to}.
Click this link to confirm:

${url}

The link expires in 24 hours. If you didn't request this change, ignore
this email — your notification address will stay as it was.`;

  await client().send(
    new SendEmailCommand({
      FromEmailAddress: FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            Text: { Data: text, Charset: "UTF-8" },
          },
        },
      },
    }),
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
