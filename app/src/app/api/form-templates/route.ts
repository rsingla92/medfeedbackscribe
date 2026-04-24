import { auth } from "@/lib/auth";
import { listFormTemplates } from "@/lib/db/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const templates = await listFormTemplates();
  return Response.json({ templates });
}
