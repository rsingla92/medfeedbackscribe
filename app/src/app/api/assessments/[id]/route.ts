import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isValidUUID } from "@/lib/uuid";
import { updateAssessment } from "@/lib/db/queries";

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
    structured_fields?: Record<string, unknown>;
    competency_tags?: string[];
    narrative_summary?: string;
    coaching_did_well?: string | null;
    coaching_consider?: string | null;
    resident_reviewed?: boolean;
    resident_edited?: boolean;
  };
  const updated = await updateAssessment(id, session.user.id, body);
  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ assessment: updated });
}
