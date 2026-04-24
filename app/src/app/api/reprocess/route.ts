import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isValidUUID } from "@/lib/uuid";
import { enqueueReprocess } from "@/lib/storage/sqs";
import { sql } from "@/lib/db/client";
import {
  getRecordingSession,
  getRecordingBySession,
  updateRecordingSessionStatus,
  clearTranscriptClean,
} from "@/lib/db/queries";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

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
        { status: 400 },
      );
    }

    const rs = await getRecordingSession(sessionId, userId);
    if (!rs) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const allowedStatuses = ["processing_failed", "processing"];
    if (!allowedStatuses.includes(rs.status)) {
      return Response.json(
        {
          error: `Session cannot be reprocessed in status '${rs.status}'. Only processing_failed or processing sessions may be retried.`,
        },
        { status: 409 },
      );
    }

    const updatedAt = new Date(rs.updated_at).getTime();
    if (updatedAt > Date.now() - 5 * 60 * 1000) {
      return Response.json(
        {
          error:
            "Session was updated less than 5 minutes ago. Wait a moment before retrying.",
        },
        { status: 409 },
      );
    }

    const recording = await getRecordingBySession(sessionId, userId);
    if (!recording?.audio_path) {
      return Response.json(
        { error: "No recording found for this session" },
        { status: 404 },
      );
    }

    const reset = await updateRecordingSessionStatus(
      sessionId,
      userId,
      "created",
    );
    if (!reset) {
      return Response.json(
        { error: "Failed to reset session for reprocessing" },
        { status: 500 },
      );
    }

    await clearTranscriptClean(sessionId, userId);

    try {
      await enqueueReprocess({
        audioKey: recording.audio_path,
        sessionId,
      });
    } catch (enqueueErr) {
      // Roll back to processing_failed so the retry button stays available.
      await sql`
        update recording_sessions
        set status = 'processing_failed'
        where id = ${sessionId} and user_id = ${userId}
      `;
      console.error("SQS enqueue failed:", enqueueErr);
      return Response.json(
        { error: "Failed to start reprocessing" },
        { status: 500 },
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
