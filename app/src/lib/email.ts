/**
 * Email utility using Resend
 *
 * Sends transactional emails for preceptor notifications.
 * Gracefully skips if RESEND_API_KEY is not configured.
 */

import { Resend } from "resend";

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
 * Send an email via Resend. Returns true if sent, false if skipped/failed.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("Email skipped: RESEND_API_KEY not configured");
    return false;
  }

  const resend = new Resend(apiKey);

  const from =
    process.env.RESEND_FROM_EMAIL ?? "Debrief <noreply@debrief.whitecoatprep.com>";

  const { error } = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  if (error) {
    console.error("Failed to send email:", error);
    return false;
  }

  return true;
}

/**
 * Build and send a preceptor summary email after a feedback session is processed.
 */
export async function sendPreceptorSummary(
  preceptorEmail: string,
  narrativeSummary: string
): Promise<boolean> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1C1917; font-size: 18px; margin-bottom: 16px;">
        Debrief: Feedback session recorded
      </h2>
      <p style="color: #44403C; font-size: 14px; line-height: 1.6;">
        ${escapeHtml(narrativeSummary)}
      </p>
      <hr style="border: none; border-top: 1px solid #E7E5E4; margin: 20px 0;" />
      <p style="color: #A8A29E; font-size: 12px;">
        This is an automated notification from Debrief. The resident will review the assessment before submitting.
      </p>
    </div>
  `;

  return sendEmail({
    to: preceptorEmail,
    subject: "Debrief: Feedback session recorded",
    html,
  });
}
