/**
 * Email utility using Resend
 *
 * Sends transactional emails for assessment notifications.
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
 * Send assessment ready notification to a recipient.
 */
export async function sendAssessmentNotification({
  to,
  recipientName,
  role,
  preceptorName,
  residentName,
  rotation,
  date,
  narrativeSummary,
  coachingDidWell,
  coachingConsider,
}: {
  to: string;
  recipientName: string;
  role: "preceptor" | "resident";
  preceptorName: string;
  residentName: string;
  rotation: string | null;
  date: string;
  narrativeSummary: string;
  coachingDidWell?: string | null;
  coachingConsider?: string | null;
}): Promise<boolean> {
  const roleLabel = role === "preceptor" ? "Preceptor" : "Resident";
  const otherPerson = role === "preceptor" ? residentName : preceptorName;

  const coachingSections = [
    coachingDidWell
      ? `<div style="margin-top: 16px;">
          <p style="color: #78716C; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">What went well</p>
          <p style="color: #1C1917; font-size: 14px; line-height: 1.6;">${escapeHtml(coachingDidWell)}</p>
        </div>`
      : "",
    coachingConsider
      ? `<div style="margin-top: 16px;">
          <p style="color: #78716C; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Consider next time</p>
          <p style="color: #1C1917; font-size: 14px; line-height: 1.6;">${escapeHtml(coachingConsider)}</p>
        </div>`
      : "",
  ].filter(Boolean).join("");

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

      ${narrativeSummary ? `
        <div style="margin-top: 16px;">
          <p style="color: #78716C; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Summary</p>
          <p style="color: #1C1917; font-size: 14px; line-height: 1.6;">${escapeHtml(narrativeSummary)}</p>
        </div>
      ` : ""}

      ${coachingSections}

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

/**
 * Legacy wrapper for backward compatibility.
 */
export async function sendPreceptorSummary(
  preceptorEmail: string,
  narrativeSummary: string
): Promise<boolean> {
  return sendAssessmentNotification({
    to: preceptorEmail,
    recipientName: "Preceptor",
    role: "preceptor",
    preceptorName: "",
    residentName: "",
    rotation: null,
    date: new Date().toLocaleDateString("en-CA"),
    narrativeSummary,
  });
}
