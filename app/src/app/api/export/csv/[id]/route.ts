import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ── CSV Helpers ─────────────────────────────────────────────────────────────────

/** Escape a value for CSV: wrap in quotes if it contains commas, quotes, or newlines */
function csvEscape(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/export/csv/[id]">
) {
  try {
    const { id: sessionId } = await ctx.params;
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch session with joined data
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(
        "id, user_id, date, form_template_id, preceptor_id, created_at, preceptor:preceptors(name, email), rotation:rotations(name)"
      )
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch assessments
    const { data: assessments, error: assessmentsError } = await supabase
      .from("assessments")
      .select(
        "id, output_index, structured_fields, competency_tags, narrative_summary, coaching_did_well, coaching_consider"
      )
      .eq("session_id", sessionId)
      .order("output_index", { ascending: true });

    if (assessmentsError || !assessments || assessments.length === 0) {
      return Response.json(
        { error: "No assessments found for this session" },
        { status: 404 }
      );
    }

    // Fetch form template
    const { data: formTemplate, error: templateError } = await supabase
      .from("form_templates")
      .select("name, fields")
      .eq("id", session.form_template_id)
      .single();

    if (templateError || !formTemplate) {
      return Response.json(
        { error: "Form template not found" },
        { status: 404 }
      );
    }

    // Normalize joined data
    const preceptor = Array.isArray(session.preceptor)
      ? session.preceptor[0]
      : session.preceptor;
    const rotation = Array.isArray(session.rotation)
      ? session.rotation[0]
      : session.rotation;

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
        user.email ?? "Unknown",
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

    // Update exported_at timestamp
    const assessmentIds = assessments.map((a) => a.id);
    await supabase
      .from("assessments")
      .update({ exported_at: new Date().toISOString() })
      .in("id", assessmentIds);

    // Update session status to exported
    await supabase
      .from("sessions")
      .update({ status: "exported" })
      .eq("id", sessionId);

    // Build filename
    const safeName = formTemplate.name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
    const dateStr = (
      session.date ?? new Date(session.created_at).toISOString().slice(0, 10)
    );
    const filename = `${safeName}-${dateStr}-one45.csv`;

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
