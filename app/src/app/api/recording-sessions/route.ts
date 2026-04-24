import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isValidUUID } from "@/lib/uuid";
import {
  createRecordingSession,
  createRecording,
  updateRecordingSessionStatus,
} from "@/lib/db/queries";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as {
    preceptor_id?: string;
    rotation_id?: string | null;
    form_template_id?: string;
    consent_confirmed?: boolean;
  };
  if (
    !body.preceptor_id ||
    !isValidUUID(body.preceptor_id) ||
    !body.form_template_id ||
    !isValidUUID(body.form_template_id)
  ) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const created = await createRecordingSession({
    userId: session.user.id,
    preceptorId: body.preceptor_id,
    rotationId: body.rotation_id ?? null,
    formTemplateId: body.form_template_id,
    date: new Date().toISOString().slice(0, 10),
    consentConfirmed: body.consent_confirmed === true,
  });
  // Existing UI expects the session to be created in "uploading" state.
  await updateRecordingSessionStatus(created.id, session.user.id, "uploading");
  return Response.json({ session: { ...created, status: "uploading" } });
}

// Separate endpoint for creating the recording row (called after S3 upload).
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as {
    session_id?: string;
    audio_path?: string;
    duration_seconds?: number | null;
    language?: string;
  };
  if (
    !body.session_id ||
    !isValidUUID(body.session_id) ||
    !body.audio_path
  ) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }
  const recording = await createRecording({
    sessionId: body.session_id,
    userId: session.user.id,
    audioPath: body.audio_path,
    durationSeconds: body.duration_seconds ?? null,
    language: body.language ?? "en",
  });
  return Response.json({ recording });
}
