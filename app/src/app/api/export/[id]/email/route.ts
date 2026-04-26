import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isValidUUID } from "@/lib/uuid";
import {
  getRecordingSessionWithJoins,
  listAssessmentsForSession,
  getFormTemplate,
  getProfile,
} from "@/lib/db/queries";
import { sql } from "@/lib/db/client";
import { recordAudit } from "@/lib/db/audit";
import {
  renderPdfBuffer,
  buildExportFilename,
  type AssessmentData,
  type SessionMeta,
} from "@/lib/exports/pdf";
import { sendEmailWithAttachment } from "@/lib/email/send-with-attachment";

/**
 * POST /api/export/[id]/email
 *
 * Build the PDF and email it to the resident's verified `profiles.email`
 * (NOT to a body-supplied address — that would re-introduce the
 * email-spoofing vector closed in the onboarding flow). Mark the session
 * exported in the same transaction the direct-download route uses so the
 * dashboard reflects the action.
 *
 * Body: ignored (no parameters; recipient is the authenticated user).
 * Response 200: { ok: true, sentTo: <email> }
 *           404: session/template/assessments missing
 *           412: profile.email not yet verified — resident must confirm first
 *           500: render or send failure
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params;
    if (!isValidUUID(sessionId)) {
      return Response.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const authSession = await auth();
    if (!authSession?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authSession.user.id;

    const session = await getRecordingSessionWithJoins(sessionId, userId);
    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const assessments = await listAssessmentsForSession(sessionId, userId);
    if (assessments.length === 0) {
      return Response.json(
        { error: "No assessments found for this session" },
        { status: 404 },
      );
    }

    const formTemplate = await getFormTemplate(session.form_template_id);
    if (!formTemplate) {
      return Response.json(
        { error: "Form template not found" },
        { status: 404 },
      );
    }

    const profile = await getProfile(userId);
    const recipient = profile?.email ?? null;
    if (!recipient) {
      return Response.json(
        {
          error:
            "Add a verified institutional email in your profile before emailing exports.",
        },
        { status: 412 },
      );
    }

    const residentName =
      profile?.full_name ?? authSession.user.email ?? "Resident";

    // postgres.js returns DATE columns as JS Date objects despite our typed
    // query interface saying `string` — cast through unknown and normalize.
    const rawDate = session.date as unknown;
    const dateString =
      rawDate instanceof Date
        ? rawDate.toISOString().slice(0, 10)
        : (rawDate as string | null) ??
          new Date(session.created_at).toLocaleDateString("en-CA");

    const meta: SessionMeta = {
      formName: formTemplate.name,
      preceptorEmail:
        session.preceptor_name ?? session.preceptor_email ?? null,
      residentEmail: residentName,
      rotation: session.rotation_name ?? null,
      date: dateString,
    };

    const pdfBuffer = await renderPdfBuffer(
      meta,
      assessments as unknown as AssessmentData[],
      (formTemplate.fields as Record<string, { label?: string }>) ?? {},
    );

    const filename = buildExportFilename(
      formTemplate.name,
      session.preceptor_name ?? null,
      meta.date,
    );

    const subject = `Your Coaching Note — ${meta.date}`;
    const dashboardUrl = `${process.env.AUTH_URL ?? "https://debriefmd.ca"}/dashboard`;
    const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#faf8f5;font-family:'DM Sans',-apple-system,system-ui,sans-serif;color:#1c1917;">
<div style="max-width:480px;margin:0 auto;padding:48px 24px;">
  <h1 style="font-family:'Instrument Serif',Georgia,serif;font-size:32px;font-weight:400;margin:0 0 16px;">Your Coaching Note</h1>
  <p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 16px;">
    The PDF for your ${escapeHtml(meta.formName)} session on ${escapeHtml(meta.date)} is attached.
  </p>
  ${
    meta.rotation
      ? `<p style="font-size:14px;line-height:1.6;color:#78716c;margin:0 0 16px;">Rotation: ${escapeHtml(meta.rotation)}</p>`
      : ""
  }
  <p style="font-size:14px;line-height:1.6;color:#78716c;margin:0 0 24px;">
    You can view, edit, or re-export this assessment any time from your dashboard.
  </p>
  <p style="margin:0 0 32px;">
    <a href="${dashboardUrl}" style="display:inline-block;background:#D97706;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;font-size:15px;">Open Debrief</a>
  </p>
  <hr style="border:0;border-top:1px solid #e7e5e4;margin:24px 0;" />
  <p style="font-size:12px;color:#a8a29e;margin:0;">
    Patient identifiers were scrubbed before this export was generated. Stored exclusively on Canadian infrastructure.
  </p>
</div></body></html>`;

    const text = `Your Coaching Note for ${meta.formName} on ${meta.date} is attached.

Open Debrief: ${dashboardUrl}

Patient identifiers were scrubbed before this export was generated.`;

    try {
      await sendEmailWithAttachment({
        to: recipient,
        subject,
        html,
        text,
        attachment: {
          filename,
          contentType: "application/pdf",
          body: pdfBuffer,
        },
      });
    } catch (err) {
      console.error("SES send failed:", err);
      await recordAudit({
        actorUserId: userId,
        action: "session.email_pdf",
        targetType: "recording_session",
        targetId: sessionId,
        result: "error",
        request,
        metadata: { reason: "ses_send_failed" },
      });
      return Response.json(
        {
          error:
            "We built the PDF but couldn't send the email. Try again, or use the direct download.",
        },
        { status: 500 },
      );
    }

    // Same transaction shape as the direct download — mark assessments
    // exported and flip session status atomically. If the email goes out
    // but this fails we'd see a duplicate-email-but-status-not-flipped
    // outcome; that's acceptable (resident still has the email and can
    // retry from the dashboard, which idempotently sets the status).
    await sql.begin(async (tx) => {
      await tx`
        update assessments a
        set exported_at = now()
        from recording_sessions rs
        where a.session_id = rs.id
          and a.session_id = ${sessionId}
          and rs.user_id = ${userId}
      `;
      await tx`
        update recording_sessions
        set status = 'exported'
        where id = ${sessionId} and user_id = ${userId}
      `;
    });

    await recordAudit({
      actorUserId: userId,
      action: "session.email_pdf",
      targetType: "recording_session",
      targetId: sessionId,
      result: "ok",
      request,
      metadata: { recipient_domain: recipient.split("@")[1] ?? "unknown" },
    });

    return Response.json({ ok: true, sentTo: recipient }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email export failed";
    console.error("Email export route error:", message);
    return Response.json(
      { error: "Email export failed" },
      { status: 500 },
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
