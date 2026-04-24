import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isValidUUID } from "@/lib/uuid";
import {
  createRecordingSession,
  createRecording,
  updateRecordingSessionStatus,
} from "@/lib/db/queries";
import { sql } from "@/lib/db/client";

// Bump this whenever the consent copy in record/page.tsx materially changes.
// Stored per-row so later policy reviews can map a row to the exact disclosure
// the resident attested to. See migration 006.
const CONSENT_COPY_VERSION = "v1-2026-04";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    preceptor_id?: string;
    rotation_id?: string | null;
    form_template_id?: string;
    consent_confirmed?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body.preceptor_id ||
    !isValidUUID(body.preceptor_id) ||
    !body.form_template_id ||
    !isValidUUID(body.form_template_id)
  ) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const consentConfirmed = body.consent_confirmed === true;
    const created = await createRecordingSession({
      userId: session.user.id,
      preceptorId: body.preceptor_id,
      rotationId: body.rotation_id ?? null,
      formTemplateId: body.form_template_id,
      date: new Date().toISOString().slice(0, 10),
      consentConfirmed,
    });
    // Stamp the consent event. Done as a scoped UPDATE (not in the INSERT) so
    // the existing createRecordingSession signature is unchanged — the rest of
    // the codebase reading that query's shape stays untouched.
    // Scoped by user_id so a hostile body can't affect another user's row.
    if (consentConfirmed) {
      await sql`
        update recording_sessions
        set consent_confirmed_at = now(),
            consent_copy_version = ${CONSENT_COPY_VERSION}
        where id = ${created.id} and user_id = ${session.user.id}
      `;
    }
    // Existing UI expects the session to be created in "uploading" state.
    await updateRecordingSessionStatus(
      created.id,
      session.user.id,
      "uploading",
    );
    return Response.json({ session: { ...created, status: "uploading" } });
  } catch (err) {
    const e = err as {
      code?: string;
      constraint_name?: string;
      constraint?: string;
      message?: string;
    };
    const constraint = e.constraint_name ?? e.constraint ?? "";
    const isFkViolation =
      e.code === "23503" ||
      constraint.includes("preceptor_id_fkey") ||
      constraint.includes("form_template_id_fkey");
    if (isFkViolation) {
      return Response.json(
        { error: "Invalid preceptor_id or form_template_id" },
        { status: 400 },
      );
    }
    console.error("recording-sessions POST failed:", e.message ?? err);
    return Response.json(
      { error: "Failed to create recording session" },
      { status: 500 },
    );
  }
}

// Separate endpoint for creating the recording row (called after S3 upload).
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    session_id?: string;
    audio_path?: string;
    duration_seconds?: number | null;
    language?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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
