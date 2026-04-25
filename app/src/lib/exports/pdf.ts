/**
 * Shared PDF builder for assessment exports.
 *
 * Used by:
 *   - /api/export/[id]      — direct download (renderToBuffer → 200 with PDF body)
 *   - /api/export/[id]/email — email attachment (renderToBuffer → SES Raw multipart)
 *
 * Pure: no DB, no auth — call sites pass already-fetched data.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { createElement } from "react";

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

export interface AssessmentData {
  output_index: number;
  structured_fields: Record<string, unknown>;
  competency_tags: string[];
  narrative_summary: string;
  coaching_did_well: string | null;
  coaching_consider: string | null;
}

export interface SessionMeta {
  formName: string;
  preceptorEmail: string | null;
  residentEmail: string;
  rotation: string | null;
  date: string;
}

export function buildPdfDocument(
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
      createElement(
        View,
        { style: styles.header },
        createElement(Text, { style: styles.title }, meta.formName),
        meta.preceptorEmail &&
          createElement(
            Text,
            { style: styles.headerMeta },
            `Preceptor: ${meta.preceptorEmail}`,
          ),
        createElement(
          Text,
          { style: styles.headerMeta },
          `Resident: ${meta.residentEmail}`,
        ),
        meta.rotation &&
          createElement(
            Text,
            { style: styles.headerMeta },
            `Rotation: ${meta.rotation}`,
          ),
        createElement(
          Text,
          { style: styles.headerMeta },
          `Date: ${meta.date}`,
        ),
      ),
      ...assessments.map((assessment) =>
        createElement(
          View,
          {
            key: String(assessment.output_index),
            style: styles.assessmentBlock,
          },
          createElement(
            Text,
            { style: styles.assessmentTitle },
            assessments.length > 1
              ? `Assessment ${assessment.output_index}`
              : "Assessment",
          ),
          ...Object.entries(assessment.structured_fields)
            .filter(([, value]) => value != null && value !== "")
            .map(([key, value]) =>
              createElement(
                View,
                { key, style: styles.fieldRow },
                createElement(
                  Text,
                  { style: styles.fieldLabel },
                  templateFields[key]?.label ?? key.replace(/_/g, " "),
                ),
                createElement(
                  Text,
                  { style: styles.fieldValue },
                  Array.isArray(value) ? value.join(", ") : String(value),
                ),
              ),
            ),
          assessment.coaching_did_well
            ? createElement(
                View,
                null,
                createElement(
                  Text,
                  { style: styles.sectionLabel },
                  "What you did well",
                ),
                createElement(
                  Text,
                  { style: styles.sectionValue },
                  assessment.coaching_did_well,
                ),
              )
            : null,
          assessment.coaching_consider
            ? createElement(
                View,
                null,
                createElement(
                  Text,
                  { style: styles.sectionLabel },
                  "Consider next time",
                ),
                createElement(
                  Text,
                  { style: styles.sectionValue },
                  assessment.coaching_consider,
                ),
              )
            : null,
          assessment.competency_tags.length > 0
            ? createElement(
                View,
                null,
                createElement(
                  Text,
                  { style: styles.sectionLabel },
                  "Competency Tags",
                ),
                createElement(
                  View,
                  { style: styles.tagRow },
                  ...assessment.competency_tags.map((tag) =>
                    createElement(Text, { key: tag, style: styles.tag }, tag),
                  ),
                ),
              )
            : null,
          assessment.narrative_summary
            ? createElement(
                View,
                null,
                createElement(
                  Text,
                  { style: styles.sectionLabel },
                  "Narrative Summary",
                ),
                createElement(
                  Text,
                  { style: styles.sectionValue },
                  assessment.narrative_summary,
                ),
              )
            : null,
        ),
      ),
      createElement(
        Text,
        { style: styles.footer },
        `Generated by Debrief on ${new Date().toLocaleDateString("en-CA")}`,
      ),
    ),
  );
}

export function renderPdfBuffer(
  meta: SessionMeta,
  assessments: AssessmentData[],
  templateFields: Record<string, { label?: string }>,
): Promise<Buffer> {
  return renderToBuffer(buildPdfDocument(meta, assessments, templateFields));
}

export function buildExportFilename(
  formName: string,
  preceptorName: string | null,
  date: string | Date,
): string {
  const safeName =
    formName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().slice(0, 50) || "export";
  // postgres.js returns DATE columns as JS Date objects, but our route may
  // also pass through a pre-formatted string. Normalize to YYYY-MM-DD.
  const dateStr =
    date instanceof Date
      ? date.toISOString().slice(0, 10)
      : String(date).slice(0, 10);
  const safePreceptor = (preceptorName ?? "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .slice(0, 30);
  return safePreceptor
    ? `${safeName}-${safePreceptor}-${dateStr}.pdf`
    : `${safeName}-${dateStr}.pdf`;
}
