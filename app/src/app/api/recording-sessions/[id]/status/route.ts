import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isValidUUID } from "@/lib/uuid";
import {
  getRecordingSession,
  listPipelineLogs,
  getRecordingBySession,
} from "@/lib/db/queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!isValidUUID(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const rs = await getRecordingSession(id, session.user.id);
  if (!rs) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const logs = await listPipelineLogs(id, session.user.id);
  const recording = await getRecordingBySession(id, session.user.id);
  return Response.json({
    status: rs.status,
    pipeline_step: logs[0]?.step ?? null,
    transcript_clean: recording?.transcript_clean ?? null,
  });
}
