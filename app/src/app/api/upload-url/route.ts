import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isValidUUID } from "@/lib/uuid";
import { getPresignedUploadUrl } from "@/lib/storage/s3";
import { getRecordingSession } from "@/lib/db/queries";

const ALLOWED_CONTENT_TYPES = new Set(["audio/webm", "audio/mp4"]);

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
    const { sessionId, contentType } = body as Record<string, unknown>;

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
    if (
      typeof contentType !== "string" ||
      !ALLOWED_CONTENT_TYPES.has(contentType)
    ) {
      return Response.json(
        { error: "Unsupported contentType. Allowed: audio/webm, audio/mp4" },
        { status: 400 },
      );
    }

    const owned = await getRecordingSession(sessionId, userId);
    if (!owned) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const { url, key } = await getPresignedUploadUrl({
      userId,
      sessionId,
      contentType,
    });
    return Response.json({ url, key }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Upload URL route error:", message);
    return Response.json(
      { error: "Failed to create upload URL" },
      { status: 500 },
    );
  }
}
