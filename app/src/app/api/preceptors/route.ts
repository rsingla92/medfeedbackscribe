import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { listPreceptors, createPreceptor } from "@/lib/db/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const preceptors = await listPreceptors();
  // Echo back the caller's user id so the client can hide edit/delete
  // affordances on rows they don't own (shared seed preceptors or another
  // resident's creations). The server still enforces ownership — this is
  // purely a UX signal, not a security boundary.
  return Response.json({ preceptors, currentUserId: session.user.id });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
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
  if (!body.name?.trim()) {
    return Response.json({ error: "name required" }, { status: 400 });
  }
  // Stamp ownership at creation time so the row's creator is the only
  // non-admin principal allowed to mutate it later (see migration 007 +
  // updatePreceptor/deletePreceptor queries).
  const preceptor = await createPreceptor(
    {
      name: body.name.trim(),
      email: body.email ?? null,
      specialty: body.specialty ?? null,
      site: body.site ?? null,
    },
    session.user.id,
  );
  return Response.json({ preceptor }, { status: 201 });
}
