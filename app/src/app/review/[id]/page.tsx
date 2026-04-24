export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db/client";
import {
  listAssessmentsForSession,
  listPipelineLogs,
} from "@/lib/db/queries";
import ReviewClient from "./review-client";

export interface SessionData {
  id: string;
  status: "processing" | "processing_failed" | "ready" | "exported";
  created_at: string;
  preceptor: { name: string } | null;
  rotation: { name: string } | null;
  form_template: { name: string; extraction_mode: "multi" | "single" } | null;
  recording: {
    transcript_clean: string | null;
    audio_path: string | null;
    duration_seconds: number | null;
  } | null;
  assessments: Assessment[];
  pipeline_step?: string | null;
}

export interface Assessment {
  id: string;
  output_index: number;
  structured_fields: Record<string, unknown>;
  competency_tags: string[];
  narrative_summary: string;
  coaching_did_well: string | null;
  coaching_consider: string | null;
  llm_confidence: Record<string, number>;
}

interface SessionWithJoinsRow {
  id: string;
  status: string;
  created_at: string;
  preceptor_name: string | null;
  rotation_name: string | null;
  form_name: string | null;
  extraction_mode: "multi" | "single" | null;
  transcript_clean: string | null;
  audio_path: string | null;
  duration_seconds: number | null;
}

export default async function ReviewPage(props: PageProps<"/review/[id]">) {
  const { id } = await props.params;

  const authSession = await auth();
  if (!authSession?.user?.id) redirect("/auth");
  const userId = authSession.user.id;

  const rows = await sql<SessionWithJoinsRow[]>`
    select
      rs.id, rs.status, rs.created_at,
      p.name as preceptor_name,
      r.name as rotation_name,
      ft.name as form_name, ft.extraction_mode,
      rec.transcript_clean, rec.audio_path, rec.duration_seconds
    from recording_sessions rs
    left join preceptors p on p.id = rs.preceptor_id
    left join rotations r on r.id = rs.rotation_id
    left join form_templates ft on ft.id = rs.form_template_id
    left join recordings rec on rec.session_id = rs.id
    where rs.id = ${id} and rs.user_id = ${userId}
    limit 1
  `;
  const row = rows[0];
  if (!row) notFound();

  const assessmentRows = await listAssessmentsForSession(id, userId);

  let pipelineStep: string | null = null;
  if (row.status === "processing") {
    const logs = await listPipelineLogs(id, userId);
    pipelineStep = logs[0]?.step ?? null;
  }

  const normalized: SessionData = {
    id: row.id,
    status: row.status as SessionData["status"],
    created_at: row.created_at,
    preceptor: row.preceptor_name ? { name: row.preceptor_name } : null,
    rotation: row.rotation_name ? { name: row.rotation_name } : null,
    form_template:
      row.form_name && row.extraction_mode
        ? { name: row.form_name, extraction_mode: row.extraction_mode }
        : null,
    recording:
      row.audio_path || row.transcript_clean || row.duration_seconds != null
        ? {
            transcript_clean: row.transcript_clean,
            audio_path: row.audio_path,
            duration_seconds: row.duration_seconds,
          }
        : null,
    assessments: assessmentRows.map((a) => ({
      id: a.id,
      output_index: a.output_index,
      structured_fields: a.structured_fields,
      competency_tags: a.competency_tags ?? [],
      narrative_summary: a.narrative_summary ?? "",
      coaching_did_well: a.coaching_did_well,
      coaching_consider: a.coaching_consider,
      llm_confidence: (a.llm_confidence ?? {}) as Record<string, number>,
    })),
    pipeline_step: pipelineStep,
  };

  return <ReviewClient session={normalized} />;
}
