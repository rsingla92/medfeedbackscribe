import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isValidUUID } from "@/lib/uuid";
import { sql } from "@/lib/db/client";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as { ids?: unknown };
  if (!Array.isArray(body.ids)) {
    return Response.json({ error: "ids must be an array" }, { status: 400 });
  }
  const ids = body.ids.filter(
    (id): id is string => typeof id === "string" && isValidUUID(id),
  );
  if (ids.length === 0) {
    return Response.json({ statuses: [] });
  }
  const rows = await sql<{ id: string; status: string }[]>`
    select id, status from recording_sessions
    where id in ${sql(ids)} and user_id = ${session.user.id}
  `;
  return Response.json({ statuses: rows });
}
