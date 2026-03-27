import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runPipeline } from "@/lib/pipeline/index";

const TIMEOUT_MS = 120_000;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return Response.json(
        { error: "Missing or invalid sessionId" },
        { status: 400 }
      );
    }

    // Validate session exists and belongs to user
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(
        "id, user_id, form_template_id, preceptor_email, status"
      )
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.status === "processing") {
      return Response.json(
        { error: "Session is already being processed" },
        { status: 409 }
      );
    }

    // Fetch the recording audio URL
    const { data: recording, error: recordingError } = await supabase
      .from("recordings")
      .select("audio_url, language")
      .eq("session_id", sessionId)
      .single();

    if (recordingError || !recording?.audio_url) {
      return Response.json(
        { error: "No recording found for this session" },
        { status: 404 }
      );
    }

    // Fetch form template
    const { data: formTemplate, error: templateError } = await supabase
      .from("form_templates")
      .select("name, extraction_mode, max_outputs, fields, competency_framework")
      .eq("id", session.form_template_id)
      .single();

    if (templateError || !formTemplate) {
      return Response.json(
        { error: "Form template not found" },
        { status: 404 }
      );
    }

    // Validate environment variables
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!deepgramApiKey || !anthropicApiKey) {
      console.error("Missing required API keys: DEEPGRAM_API_KEY or ANTHROPIC_API_KEY");
      return Response.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Run the pipeline (non-blocking from the client's perspective is optional;
    // here we await so the caller knows when it completes)
    await runPipeline(
      supabase,
      {
        sessionId,
        audioUrl: recording.audio_url,
        language: (recording.language as "en" | "fr") || "en",
        formTemplate: {
          name: formTemplate.name,
          extraction_mode: formTemplate.extraction_mode,
          max_outputs: formTemplate.max_outputs,
          fields: formTemplate.fields as Record<string, unknown>,
          competency_framework: formTemplate.competency_framework,
        },
        preceptorEmail: session.preceptor_email ?? undefined,
      },
      {
        deepgramApiKey,
        anthropicApiKey,
        timeoutMs: TIMEOUT_MS,
      }
    );

    return Response.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Pipeline trigger failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
