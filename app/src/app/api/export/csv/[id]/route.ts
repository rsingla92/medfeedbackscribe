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

// ── CSV Helpers ─────────────────────────────────────────────────────────────────

/** Escape a value for CSV: wrap in quotes if it contains commas, quotes, or newlines */
function csvEscape(value: string): string {
  let s = value;
  // Excel / Sheets treat leading =, +, -, @, tab, CR as formulas. Prepend a
  // single quote to neutralize. LLM output or preceptor-supplied narrative can
  // contain these.
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (
    s.includes(",") ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r")
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** One45 CanMEDS roles in standard order */
const CANMEDS_ROLES = [
  "Family Medicine Expert",
  "Communicator",
  "Collaborator",
  "Manager",
  "Health Advocate",
  "Scholar",
  "Professional",
] as const;

// ── Route Handler ───────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const profile = await getProfile(userId);
    const residentName =
      profile?.full_name ?? authSession.user.email ?? "Unknown";

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

    const preceptor = {
      name: session.preceptor_name,
      email: session.preceptor_email,
    };
    const rotation = { name: session.rotation_name };

    // ── Build CSV ─────────────────────────────────────────────────────────────

    const headers = [
      "Resident Name",
      "Preceptor Name",
      "Rotation",
      "Date",
      "Overall Performance",
      ...CANMEDS_ROLES.map((role) => `${role} - Rating`),
      ...CANMEDS_ROLES.map((role) => `${role} - Comments`),
      "Narrative Summary",
      "Coaching: Did Well",
      "Coaching: Consider Next Time",
    ];

    const rows = assessments.map((assessment) => {
      const fields = (assessment.structured_fields ?? {}) as Record<
        string,
        unknown
      >;

      // Try to find the overall performance field
      const overallPerformance =
        findFieldValue(fields, "overall_performance") ||
        findFieldValue(fields, "overall") ||
        "";

      // Extract CanMEDS role ratings and comments
      const roleRatings = CANMEDS_ROLES.map((role) => {
        const normalizedRole = role.toLowerCase().replace(/\s+/g, "_");
        // Look for rating in structured fields
        const rating =
          findFieldValue(fields, normalizedRole) ||
          findFieldValue(fields, `${normalizedRole}_rating`) ||
          findFieldValue(fields, role) ||
          // Check competency_tags for on-target indication
          (assessment.competency_tags?.includes(role)
            ? "On target for this role"
            : "");
        return String(rating);
      });

      const roleComments = CANMEDS_ROLES.map((role) => {
        const normalizedRole = role.toLowerCase().replace(/\s+/g, "_");
        return String(
          findFieldValue(fields, `${normalizedRole}_comments`) ||
            findFieldValue(fields, `${normalizedRole}_comment`) ||
            ""
        );
      });

      return [
        residentName,
        preceptor?.name ?? preceptor?.email ?? "",
        rotation?.name ?? "",
        session.date ?? new Date(session.created_at).toISOString().slice(0, 10),
        overallPerformance,
        ...roleRatings,
        ...roleComments,
        assessment.narrative_summary ?? "",
        assessment.coaching_did_well ?? "",
        assessment.coaching_consider ?? "",
      ].map((v) => csvEscape(String(v)));
    });

    const csv = [headers.map(csvEscape).join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );

    // Build filename (truncate to avoid OS filename length limits)
    const safeName = formTemplate.name
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .slice(0, 50);
    const effectiveName = safeName || "export";
    const dateStr = (
      session.date ?? new Date(session.created_at).toISOString().slice(0, 10)
    );
    const safePreceptor = (preceptor?.name ?? "")
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .slice(0, 30);
    const filename = safePreceptor
      ? `${effectiveName}-${safePreceptor}-${dateStr}.csv`
      : `${effectiveName}-${dateStr}.csv`;

    // Atomically mark assessments exported + flip session status. If either
    // statement fails, the transaction rolls back so we never leave the DB in
    // a split state where assessments.exported_at is set but the session is
    // still `ready`.
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
      action: "session.export_csv",
      targetType: "recording_session",
      targetId: sessionId,
      result: "ok",
      request,
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate CSV";
    console.error("CSV export failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

// ── Utility ─────────────────────────────────────────────────────────────────────

/** Search for a field value by trying several key variants */
function findFieldValue(
  fields: Record<string, unknown>,
  key: string
): string {
  // Direct match
  if (fields[key] != null && fields[key] !== "") {
    return Array.isArray(fields[key])
      ? (fields[key] as string[]).join(", ")
      : String(fields[key]);
  }

  // Case-insensitive search
  const lowerKey = key.toLowerCase();
  for (const [k, v] of Object.entries(fields)) {
    if (k.toLowerCase() === lowerKey && v != null && v !== "") {
      return Array.isArray(v) ? (v as string[]).join(", ") : String(v);
    }
  }

  return "";
}
