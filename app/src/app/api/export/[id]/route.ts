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

// PDF builder + styles live in @/lib/exports/pdf so the email-PDF route
// (api/export/[id]/email) can render the same document.

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
    const residentName =
      profile?.full_name ?? authSession.user.email ?? "Unknown";

    // postgres.js returns DATE columns as JS Date objects despite our typed
    // query interface saying `string` — cast through unknown and normalize
    // to a YYYY-MM-DD string before handing to the PDF / filename builders.
    const rawDate = session.date as unknown;
    const dateString =
      rawDate instanceof Date
        ? rawDate.toISOString().slice(0, 10)
        : (rawDate as string | null) ??
          new Date(session.created_at).toLocaleDateString("en-CA");

    const meta: SessionMeta = {
      formName: formTemplate.name,
      preceptorEmail: session.preceptor_name ?? session.preceptor_email ?? null,
      residentEmail: residentName,
      rotation: session.rotation_name ?? null,
      date: dateString,
    };

    // Render BEFORE touching DB state. If rendering throws, the session
    // stays in `ready` and the resident can retry.
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

    // Atomically mark assessments exported + flip session status.
    const updated = await sql.begin(async (tx) => {
      await tx`
        update assessments a
        set exported_at = now()
        from recording_sessions rs
        where a.session_id = rs.id
          and a.session_id = ${sessionId}
          and rs.user_id = ${userId}
      `;
      const rows = await tx<{ id: string }[]>`
        update recording_sessions
        set status = 'exported'
        where id = ${sessionId} and user_id = ${userId}
        returning id
      `;
      return rows[0] ?? null;
    });
    if (!updated) {
      console.error(
        `Export state update failed: session ${sessionId} not found for user ${userId}`,
      );
      throw new Error("Failed to update session status");
    }

    await recordAudit({
      actorUserId: userId,
      action: "session.export_pdf",
      targetType: "recording_session",
      targetId: sessionId,
      result: "ok",
      request,
    });

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate PDF";
    console.error("PDF export failed:", message);
    return Response.json({ error: "PDF export failed" }, { status: 500 });
  }
}
