import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isValidUUID } from "@/lib/uuid";
import { updateAssessment } from "@/lib/db/queries";

const MAX_TEXT_LEN = 8000;
const MAX_STRUCTURED_BYTES = 32 * 1024;

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

  let body: {
    structured_fields?: Record<string, unknown>;
    competency_tags?: string[];
    narrative_summary?: string;
    coaching_did_well?: string | null;
    coaching_consider?: string | null;
    resident_reviewed?: boolean;
    resident_edited?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Server-side length caps
  const textFields: Array<["narrative_summary" | "coaching_did_well" | "coaching_consider"]> = [
    ["narrative_summary"],
    ["coaching_did_well"],
    ["coaching_consider"],
  ];
  for (const [field] of textFields) {
    const v = body[field];
    if (typeof v === "string" && v.length > MAX_TEXT_LEN) {
      return Response.json({ error: "Payload too large" }, { status: 413 });
    }
  }
  if (body.structured_fields !== undefined) {
    try {
      const encoded = JSON.stringify(body.structured_fields);
      if (
        typeof encoded === "string" &&
        Buffer.byteLength(encoded, "utf8") > MAX_STRUCTURED_BYTES
      ) {
        return Response.json({ error: "Payload too large" }, { status: 413 });
      }
    } catch {
      return Response.json(
        { error: "Invalid structured_fields" },
        { status: 400 },
      );
    }
  }

  const updated = await updateAssessment(id, session.user.id, body);
  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ assessment: updated });
}
