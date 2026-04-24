import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { listPreceptors, createPreceptor } from "@/lib/db/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const preceptors = await listPreceptors();
  return Response.json({ preceptors });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as {
    name?: string;
    email?: string | null;
    specialty?: string | null;
    site?: string | null;
  };
  if (!body.name?.trim()) {
    return Response.json({ error: "name required" }, { status: 400 });
  }
  const preceptor = await createPreceptor({
    name: body.name.trim(),
    email: body.email ?? null,
    specialty: body.specialty ?? null,
    site: body.site ?? null,
  });
  return Response.json({ preceptor }, { status: 201 });
}
