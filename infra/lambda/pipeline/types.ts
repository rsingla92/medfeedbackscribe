/**
 * Shared types for the Debrief pipeline Lambda worker.
 *
 * Ported from app/src/lib/pipeline/ + app/src/lib/email.ts, stripped of
 * Supabase-specific types (replaced by the db.ts helpers).
 */

// ---------------------------------------------------------------------------
// Form template (JSON schema driven)
// ---------------------------------------------------------------------------

export interface FormTemplate {
  name: string;
  extraction_mode: "multi" | "single";
  max_outputs: number;
  fields: Record<string, unknown>;
  competency_framework: string;
}

// ---------------------------------------------------------------------------
// Pipeline input (what we call runPipeline with)
// ---------------------------------------------------------------------------

export interface PipelineInput {
  sessionId: string;
  audioUrl: string;
  language: "en" | "fr";
  formTemplate: FormTemplate;
  preceptorEmail?: string;
  preceptorName?: string;
  residentName?: string;
  residentEmail?: string;
  rotationName?: string | null;
  sessionDate?: string;
}

export interface PipelineConfig {
  timeoutMs: number;
  gcpProjectId?: string;
}

// ---------------------------------------------------------------------------
// STT + extraction result types
// ---------------------------------------------------------------------------

export interface STTResult {
  transcript: string;
  confidence: number;
  duration_seconds: number;
  language: string;
}

export interface AssessmentOutput {
  output_index: number;
  structured_fields: Record<string, unknown>;
  competency_tags: string[];
  narrative_summary: string;
  coaching_did_well?: string;
  coaching_consider?: string;
  confidence: Record<string, number>;
}

export interface ExtractionResult {
  outputs: AssessmentOutput[];
  model: string;
}

export interface GeminiScrubExtractResult {
  clean: string;
  totalRedactions: number;
  extraction: ExtractionResult;
}

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

export interface SessionRow {
  id: string;
  user_id: string;
  preceptor_id: string | null;
  rotation_id: string | null;
  form_template_id: string;
  date: string | null;
  status: string;
}

export interface RecordingRow {
  session_id: string;
  audio_path: string | null;
  language: string | null;
}

export interface FormTemplateRow {
  id: string;
  name: string;
  extraction_mode: "multi" | "single";
  max_outputs: number;
  fields: Record<string, unknown>;
  competency_framework: string;
}

export interface PreceptorRow {
  id: string;
  name: string;
  email: string | null;
}

export interface RotationRow {
  id: string;
  name: string;
}

export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

// ---------------------------------------------------------------------------
// Email types
// ---------------------------------------------------------------------------

export interface AssessmentNotificationOptions {
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
}
