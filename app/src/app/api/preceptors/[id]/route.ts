import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isValidUUID } from "@/lib/uuid";
import { updatePreceptor, deletePreceptor } from "@/lib/db/queries";

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
  const body = (await request.json()) as {
    name?: string;
    email?: string | null;
    specialty?: string | null;
    site?: string | null;
  };
  const updated = await updatePreceptor(id, body);
  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ preceptor: updated });
}

export async function DELETE(
  _request: NextRequest,
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
  await deletePreceptor(id);
  return new Response(null, { status: 204 });
}
