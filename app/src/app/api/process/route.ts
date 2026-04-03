import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runPipeline } from "@/lib/pipeline/index";
import { isValidUUID } from "@/lib/uuid";

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

    if (!sessionId || typeof sessionId !== "string" || !isValidUUID(sessionId)) {
      return Response.json(
        { error: "Missing or invalid sessionId" },
        { status: 400 }
      );
    }

    // Validate session exists and belongs to user
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(
        "id, user_id, form_template_id, preceptor_id, status"
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

    // Fetch the recording
    const { data: recording, error: recordingError } = await supabase
      .from("recordings")
      .select("audio_path, language")
      .eq("session_id", sessionId)
      .single();

    if (recordingError || !recording?.audio_path) {
      return Response.json(
        { error: "No recording found for this session" },
        { status: 404 }
      );
    }

    // Create a signed URL for the audio file
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("recordings")
      .createSignedUrl(recording.audio_path, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return Response.json(
        { error: "Failed to create audio URL" },
        { status: 500 }
      );
    }

    const audioUrl = signedUrlData.signedUrl;

    // Fetch preceptor email for notification
    let preceptorEmail: string | undefined;
    if (session.preceptor_id) {
      const { data: preceptor } = await supabase
        .from("preceptors")
        .select("email")
        .eq("id", session.preceptor_id)
        .single();
      preceptorEmail = preceptor?.email ?? undefined;
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
        audioUrl,
        language: (recording.language as "en" | "fr") || "en",
        formTemplate: {
          name: formTemplate.name,
          extraction_mode: formTemplate.extraction_mode,
          max_outputs: formTemplate.max_outputs,
          fields: formTemplate.fields as Record<string, unknown>,
          competency_framework: formTemplate.competency_framework,
        },
        preceptorEmail,
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

    // Update session status so user sees failure (not stuck in "processing")
    try {
      const body = await request.clone().json().catch(() => null);
      if (body?.sessionId) {
        const supabaseForUpdate = await createClient();
        await supabaseForUpdate
          .from("sessions")
          .update({ status: "processing_failed" })
          .eq("id", body.sessionId);
      }
    } catch {
      // Best-effort status update
    }

    return Response.json({ error: message }, { status: 500 });
  }
}
