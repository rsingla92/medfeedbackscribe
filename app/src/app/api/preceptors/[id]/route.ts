import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isValidUUID } from "@/lib/uuid";
import { updatePreceptor, deletePreceptor } from "@/lib/db/queries";
import { recordAudit } from "@/lib/db/audit";

/**
 * Postgres unique/fk error codes we care about here.
 *   23503 — foreign_key_violation (e.g. delete blocked by recording_sessions).
 */
const PG_FK_VIOLATION = "23503";

function isPgError(err: unknown): err is { code?: string } {
  return typeof err === "object" && err !== null && "code" in err;
}

export async function PATCH(
  request: NextRequest,
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

  // Body may be malformed — don't let request.json() throw a 500.
  let body: {
    name?: string;
    email?: string | null;
    specialty?: string | null;
    site?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const updated = await updatePreceptor(id, session.user.id, body);
    if (!updated) {
      // Null from updatePreceptor means either the row doesn't exist OR the
      // caller isn't the owner (including the shared-row case where
      // created_by_user_id IS NULL). Return 403 so the ownership boundary
      // is explicit — 404 would mask authz failures behind "not found".
      await recordAudit({
        actorUserId: session.user.id,
        action: "preceptor.update",
        targetType: "preceptor",
        targetId: id,
        result: "forbidden",
        request,
      });
      return Response.json(
        { error: "Forbidden: you don't own this preceptor" },
        { status: 403 },
      );
    }
    await recordAudit({
      actorUserId: session.user.id,
      action: "preceptor.update",
      targetType: "preceptor",
      targetId: id,
      result: "ok",
      request,
    });
    return Response.json({ preceptor: updated });
  } catch (err) {
    if (isPgError(err) && err.code === PG_FK_VIOLATION) {
      await recordAudit({
        actorUserId: session.user.id,
        action: "preceptor.update",
        targetType: "preceptor",
        targetId: id,
        result: "error",
        request,
        metadata: { reason: "fk_violation" },
      });
      return Response.json(
        {
          error:
            "Preceptor is referenced by sessions; delete or reassign those first.",
        },
        { status: 409 },
      );
    }
    console.error("PATCH /api/preceptors/[id] error:", err);
    return Response.json(
      { error: "Failed to update preceptor" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
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

  try {
    const affected = await deletePreceptor(id, session.user.id);
    if (affected === 0) {
      // Same reasoning as PATCH — surface ownership failures as 403.
      await recordAudit({
        actorUserId: session.user.id,
        action: "preceptor.delete",
        targetType: "preceptor",
        targetId: id,
        result: "forbidden",
        request,
      });
      return Response.json(
        { error: "Forbidden: you don't own this preceptor" },
        { status: 403 },
      );
    }
    await recordAudit({
      actorUserId: session.user.id,
      action: "preceptor.delete",
      targetType: "preceptor",
      targetId: id,
      result: "ok",
      request,
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    if (isPgError(err) && err.code === PG_FK_VIOLATION) {
      await recordAudit({
        actorUserId: session.user.id,
        action: "preceptor.delete",
        targetType: "preceptor",
        targetId: id,
        result: "error",
        request,
        metadata: { reason: "fk_violation" },
      });
      return Response.json(
        {
          error:
            "Preceptor is referenced by sessions; delete or reassign those first.",
        },
        { status: 409 },
      );
    }
    console.error("DELETE /api/preceptors/[id] error:", err);
    return Response.json(
      { error: "Failed to delete preceptor" },
      { status: 500 },
    );
  }
}
