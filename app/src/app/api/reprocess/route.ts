import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/uuid";

/**
 * POST /api/reprocess
 *
 * Allows a session owner to requeue processing for a session that has stalled
 * or explicitly failed.
 *
 * Allowed when:
 *   - status IN ('processing_failed', 'processing')
 *   - updated_at < now() - 5 minutes  (avoids double-trigger for recent starts)
 *
 * On success:
 *   - Resets status to 'created' and clears transcript_clean so the pipeline
 *     starts from a clean slate (transcript_raw is preserved for re-transcription).
 *   - Internally fires POST /api/process to kick off the pipeline.
 *   - Returns 202 { status: 'reprocessing' }
 *
 * On conflict (session not eligible):
 *   - Returns 409 { error: '...' }
 */
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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { sessionId } = body as Record<string, unknown>;

    if (
      !sessionId ||
      typeof sessionId !== "string" ||
      !isValidUUID(sessionId)
    ) {
      return Response.json(
        { error: "Missing or invalid sessionId" },
        { status: 400 }
      );
    }

    // Fetch session — RLS ensures only the owner can see it
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id, status, updated_at")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    // Ownership check (belt-and-suspenders on top of RLS)
    if (session.user_id !== user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Status must be failed or stuck-processing
    const allowedStatuses = ["processing_failed", "processing"];
    if (!allowedStatuses.includes(session.status)) {
      return Response.json(
        {
          error: `Session cannot be reprocessed in status '${session.status}'. Only processing_failed or processing sessions may be retried.`,
        },
        { status: 409 }
      );
    }

    // Recency guard: updated_at must be > 5 minutes ago to avoid double-trigger
    const updatedAt = new Date(session.updated_at).getTime();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (updatedAt > fiveMinutesAgo) {
      return Response.json(
        {
          error:
            "Session was updated less than 5 minutes ago. Wait a moment before retrying.",
        },
        { status: 409 }
      );
    }

    // Reset session to 'created' so /api/process accepts it
    const { error: resetError } = await supabase
      .from("sessions")
      .update({ status: "created" })
      .eq("id", sessionId);

    if (resetError) {
      console.error("Failed to reset session status:", resetError);
      return Response.json(
        { error: "Failed to reset session for reprocessing" },
        { status: 500 }
      );
    }

    // Clear transcript_clean so the pipeline re-runs from scratch.
    // transcript_raw is preserved — the pipeline will re-transcribe from
    // the original audio file regardless, so clearing clean just ensures
    // no stale PHI-scrubbed text leaks into the re-extraction.
    await supabase
      .from("recordings")
      .update({ transcript_clean: null })
      .eq("session_id", sessionId);

    // Trigger the pipeline by calling /api/process internally.
    // We use fetch so the parallel agent's after() changes take effect
    // automatically when both PRs are merged.
    const processUrl = new URL("/api/process", request.url);
    const processResponse = await fetch(processUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward the session cookie so /api/process can authenticate
        Cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!processResponse.ok) {
      // Pipeline trigger failed — roll back to processing_failed
      await supabase
        .from("sessions")
        .update({ status: "processing_failed" })
        .eq("id", sessionId);

      const errBody = await processResponse
        .json()
        .catch(() => ({ error: "Unknown error" }));
      console.error("Internal /api/process trigger failed:", errBody);
      return Response.json(
        { error: "Failed to start reprocessing" },
        { status: 500 }
      );
    }

    return Response.json({ status: "reprocessing" }, { status: 202 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Reprocess route error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
