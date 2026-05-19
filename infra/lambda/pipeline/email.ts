/**
 * Email utility — SES v2 implementation for the Lambda worker.
 *
 * Mirrors the function signatures of app/src/lib/email.ts so the orchestrator
 * call sites don't have to change.
 *
 * PHI discipline: the email body intentionally omits the transcript and the
 * narrative summary. Recipients receive "your assessment is ready" + a link.
 * This matches the Phase 2 spec — the resident reviews PHI in-app, never in
 * email — and is stricter than the Resend template in the Next.js app.
 *
 * Env vars:
 *   SES_FROM_EMAIL       — from address (default noreply@debrief.whitecoatprep.com)
 *   SES_APP_URL          — optional base URL for the "review" deep link
 *   PROGRAM_ADMIN_EMAIL  — optional BCC for program admins (set by pipeline.ts)
 */

import {
  SESv2Client,
  SendEmailCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-sesv2";
import type { AssessmentNotificationOptions } from "./types.js";

const DEFAULT_FROM = "Debrief <noreply@debriefmd.ca>";

let _sesClient: SESv2Client | null = null;
function getSesClient(): SESv2Client {
  if (!_sesClient) {
    _sesClient = new SESv2Client({
      region: process.env.AWS_REGION_DEBRIEF ?? process.env.AWS_REGION ?? "ca-central-1",
    });
  }
  return _sesClient;
}

/** Test hook. */
export function _setSesClientForTests(client: SESv2Client | null): void {
  _sesClient = client;
}

/**
 * Escape special HTML characters to prevent content injection.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email via SES v2. Returns true if sent, false if skipped/failed.
 * Never throws — email failures are non-fatal for the pipeline.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const from = process.env.SES_FROM_EMAIL ?? DEFAULT_FROM;

  const input: SendEmailCommandInput = {
    FromEmailAddress: from,
    Destination: { ToAddresses: [options.to] },
    Content: {
      Simple: {
        Subject: { Data: options.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: options.html, Charset: "UTF-8" },
        },
      },
    },
  };

  try {
    await getSesClient().send(new SendEmailCommand(input));
    return true;
  } catch (err) {
    console.error("SES send failed:", err);
    return false;
  }
}

/**
 * Send assessment-ready notification.
 *
 * The content deliberately omits the transcript and narrative summary.
 * We only tell the recipient that an assessment is ready and show the
 * session metadata (names, rotation, date).
 */
export async function sendAssessmentNotification(
  opts: AssessmentNotificationOptions
): Promise<boolean> {
  const {
    to,
    recipientName,
    role,
    preceptorName,
    residentName,
    rotation,
    date,
  } = opts;

  const roleLabel = role === "preceptor" ? "Preceptor" : "Resident";
  const otherPerson = role === "preceptor" ? residentName : preceptorName;
  const appUrl = process.env.SES_APP_URL ?? "https://app.debriefmd.ca";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h1 style="font-family: Georgia, serif; color: #1C1917; font-size: 28px; margin-bottom: 4px;">Debrief</h1>
      <p style="color: #78716C; font-size: 13px; margin-bottom: 24px;">Talk first. Forms second.</p>

      <p style="color: #1C1917; font-size: 15px; line-height: 1.6;">
        Hi ${escapeHtml(recipientName)}, a feedback assessment is ready for your review.
      </p>

      <div style="margin: 20px 0; padding: 16px; background: #FAFAF9; border: 1px solid #E7E5E4; border-radius: 8px;">
        <table style="width: 100%; font-size: 13px; color: #44403C;">
          <tr><td style="padding: 4px 0; color: #78716C;">${roleLabel}</td><td style="padding: 4px 0; text-align: right; font-weight: 500;">${escapeHtml(role === "preceptor" ? preceptorName : residentName)}</td></tr>
          <tr><td style="padding: 4px 0; color: #78716C;">${role === "preceptor" ? "Resident" : "Preceptor"}</td><td style="padding: 4px 0; text-align: right; font-weight: 500;">${escapeHtml(otherPerson)}</td></tr>
          ${rotation ? `<tr><td style="padding: 4px 0; color: #78716C;">Rotation</td><td style="padding: 4px 0; text-align: right; font-weight: 500;">${escapeHtml(rotation)}</td></tr>` : ""}
          <tr><td style="padding: 4px 0; color: #78716C;">Date</td><td style="padding: 4px 0; text-align: right; font-weight: 500;">${escapeHtml(date)}</td></tr>
        </table>
      </div>

      <p style="color: #1C1917; font-size: 14px; line-height: 1.6;">
        For privacy reasons the assessment content is not included in this email.
        <a href="${escapeHtml(appUrl)}" style="color: #D97706; font-weight: 500;">Open Debrief</a> to review.
      </p>

      <hr style="border: none; border-top: 1px solid #E7E5E4; margin: 24px 0;" />
      <p style="color: #A8A29E; font-size: 12px;">
        ${role === "resident"
          ? "Please review this assessment before submitting to your program."
          : "The resident will review this assessment before submitting."}
      </p>
      <p style="color: #A8A29E; font-size: 11px; margin-top: 12px;">Debrief — Data encrypted at rest (AES-256), stored in Canada (ca-central-1).</p>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Debrief: Assessment ready${rotation ? ` — ${rotation}` : ""} (${date})`,
    html,
  });
}
