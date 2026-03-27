export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ReviewClient from "./review-client";

// ── Types shared between server and client ─────────────────────────────────────

export interface SessionData {
  id: string;
  status: "processing" | "processing_failed" | "ready" | "exported";
  created_at: string;
  preceptor: { full_name: string };
  rotation: { name: string };
  form_type: { name: string; extraction_mode: "multi" | "single" };
  recording: {
    transcript_clean: string | null;
    transcript_raw: string | null;
    audio_url: string | null;
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

// ── Server Component (data fetching) ───────────────────────────────────────────

export default async function ReviewPage(props: PageProps<"/review/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();

  // Fetch session with all related data
  const { data: session, error } = await supabase
    .from("sessions")
    .select(
      `
      id,
      status,
      created_at,
      preceptor:preceptors(full_name),
      rotation:rotations(name),
      form_type:form_types(name, extraction_mode),
      recording:recordings(transcript_clean, transcript_raw, audio_url, duration_seconds),
      assessments(id, output_index, structured_fields, competency_tags, narrative_summary, coaching_did_well, coaching_consider, llm_confidence)
    `
    )
    .eq("id", id)
    .single();

  if (error || !session) {
    notFound();
  }

  // Get current pipeline step if still processing
  let pipelineStep: string | null = null;
  if (session.status === "processing") {
    const { data: logs } = await supabase
      .from("pipeline_logs")
      .select("step, status")
      .eq("session_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (logs && logs.length > 0) {
      pipelineStep = logs[0].step;
    }
  }

  // Normalize Supabase joined data (comes back as arrays for single relations)
  const normalized: SessionData = {
    id: session.id,
    status: session.status as SessionData["status"],
    created_at: session.created_at,
    preceptor: Array.isArray(session.preceptor)
      ? session.preceptor[0]
      : session.preceptor,
    rotation: Array.isArray(session.rotation)
      ? session.rotation[0]
      : session.rotation,
    form_type: Array.isArray(session.form_type)
      ? session.form_type[0]
      : session.form_type,
    recording: Array.isArray(session.recording)
      ? session.recording[0] ?? null
      : session.recording,
    assessments: (session.assessments ?? []).sort(
      (a: { output_index: number }, b: { output_index: number }) =>
        a.output_index - b.output_index
    ),
    pipeline_step: pipelineStep,
  };

  return <ReviewClient session={normalized} />;
}
