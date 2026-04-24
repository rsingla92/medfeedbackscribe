import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isValidUUID } from "@/lib/uuid";
import { getRecordingBySession } from "@/lib/db/queries";
import { getPresignedPlaybackUrl } from "@/lib/storage/s3";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;
  if (!isValidUUID(sessionId)) {
    return Response.json({ error: "Invalid sessionId" }, { status: 400 });
  }
  const recording = await getRecordingBySession(sessionId, session.user.id);
  if (!recording?.audio_path) {
    return Response.json({ error: "Recording not found" }, { status: 404 });
  }
  const url = await getPresignedPlaybackUrl(recording.audio_path);
  return Response.json({ url });
}
