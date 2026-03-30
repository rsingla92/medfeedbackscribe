import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import ReactPDF from "@react-pdf/renderer";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { createElement } from "react";

// ---------- PDF Styles ----------
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#1C1917",
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E7E5E4",
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    color: "#1C1917",
  },
  headerMeta: {
    fontSize: 10,
    color: "#78716C",
    marginBottom: 2,
  },
  assessmentBlock: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E7E5E4",
  },
  assessmentTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    color: "#D97706",
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#78716C",
    marginBottom: 2,
    marginTop: 8,
    textTransform: "uppercase" as const,
  },
  sectionValue: {
    fontSize: 11,
    marginBottom: 4,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
    marginBottom: 4,
  },
  tag: {
    fontSize: 9,
    backgroundColor: "#FEF3C7",
    color: "#92400E",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fieldRow: {
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#78716C",
  },
  fieldValue: {
    fontSize: 11,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#A8A29E",
    textAlign: "center",
  },
});

// ---------- PDF Document Builder ----------
interface AssessmentData {
  output_index: number;
  structured_fields: Record<string, unknown>;
  competency_tags: string[];
  narrative_summary: string;
  coaching_did_well: string | null;
  coaching_consider: string | null;
}

interface SessionMeta {
  formName: string;
  preceptorEmail: string | null;
  residentEmail: string;
  rotation: string | null;
  date: string;
}

function buildPdfDocument(
  meta: SessionMeta,
  assessments: AssessmentData[],
  templateFields: Record<string, { label?: string }>,
) {
  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: "LETTER", style: styles.page },
      // Header
      createElement(
        View,
        { style: styles.header },
        createElement(Text, { style: styles.title }, meta.formName),
        meta.preceptorEmail &&
          createElement(
            Text,
            { style: styles.headerMeta },
            `Preceptor: ${meta.preceptorEmail}`
          ),
        createElement(
          Text,
          { style: styles.headerMeta },
          `Resident: ${meta.residentEmail}`
        ),
        meta.rotation &&
          createElement(
            Text,
            { style: styles.headerMeta },
            `Rotation: ${meta.rotation}`
          ),
        createElement(
          Text,
          { style: styles.headerMeta },
          `Date: ${meta.date}`
        )
      ),
      // Assessment blocks
      ...assessments.map((assessment) =>
        createElement(
          View,
          { key: String(assessment.output_index), style: styles.assessmentBlock },
          createElement(
            Text,
            { style: styles.assessmentTitle },
            assessments.length > 1
              ? `Assessment ${assessment.output_index}`
              : "Assessment"
          ),
          // Structured fields
          ...Object.entries(assessment.structured_fields)
            .filter(([, value]) => value != null && value !== "")
            .map(([key, value]) =>
              createElement(
                View,
                { key, style: styles.fieldRow },
                createElement(
                  Text,
                  { style: styles.fieldLabel },
                  templateFields[key]?.label ?? key.replace(/_/g, " ")
                ),
                createElement(
                  Text,
                  { style: styles.fieldValue },
                  Array.isArray(value) ? value.join(", ") : String(value)
                )
              )
            ),
          // Coaching: did well
          assessment.coaching_did_well
            ? createElement(
                View,
                null,
                createElement(
                  Text,
                  { style: styles.sectionLabel },
                  "What you did well"
                ),
                createElement(
                  Text,
                  { style: styles.sectionValue },
                  assessment.coaching_did_well
                )
              )
            : null,
          // Coaching: consider
          assessment.coaching_consider
            ? createElement(
                View,
                null,
                createElement(
                  Text,
                  { style: styles.sectionLabel },
                  "Consider next time"
                ),
                createElement(
                  Text,
                  { style: styles.sectionValue },
                  assessment.coaching_consider
                )
              )
            : null,
          // Competency tags
          assessment.competency_tags.length > 0
            ? createElement(
                View,
                null,
                createElement(
                  Text,
                  { style: styles.sectionLabel },
                  "Competency Tags"
                ),
                createElement(
                  View,
                  { style: styles.tagRow },
                  ...assessment.competency_tags.map((tag) =>
                    createElement(Text, { key: tag, style: styles.tag }, tag)
                  )
                )
              )
            : null,
          // Narrative summary
          assessment.narrative_summary
            ? createElement(
                View,
                null,
                createElement(
                  Text,
                  { style: styles.sectionLabel },
                  "Narrative Summary"
                ),
                createElement(
                  Text,
                  { style: styles.sectionValue },
                  assessment.narrative_summary
                )
              )
            : null
        )
      ),
      // Footer
      createElement(
        Text,
        { style: styles.footer },
        `Generated by Debrief on ${new Date().toLocaleDateString("en-CA")}`
      )
    )
  );
}

// ---------- Route Handler ----------
export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/export/[id]">
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
        "id, user_id, form_template_id, preceptor_id, created_at, preceptor:preceptors(name, email), rotation:rotations(name)"
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
    const preceptor = Array.isArray(session.preceptor) ? session.preceptor[0] : session.preceptor;
    const rotation = Array.isArray(session.rotation) ? session.rotation[0] : session.rotation;

    // Build PDF
    const meta: SessionMeta = {
      formName: formTemplate.name,
      preceptorEmail: preceptor?.email ?? preceptor?.name ?? null,
      residentEmail: user.email ?? "Unknown",
      rotation: rotation?.name ?? null,
      date: new Date(session.created_at).toLocaleDateString("en-CA"),
    };

    const doc = buildPdfDocument(
      meta,
      assessments as AssessmentData[],
      (formTemplate.fields as Record<string, { label?: string }>) ?? {}
    );

    const pdfBuffer = await ReactPDF.renderToBuffer(doc);

    // Update exported_at timestamp for all assessments in this session
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

    // Build a safe filename
    const safeName = formTemplate.name.replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
    const dateStr = new Date(session.created_at)
      .toISOString()
      .slice(0, 10);
    const filename = `${safeName}-${dateStr}.pdf`;

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
    return Response.json({ error: message }, { status: 500 });
  }
}
