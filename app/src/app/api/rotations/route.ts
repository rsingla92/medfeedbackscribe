import { auth } from "@/lib/auth";
import { listRotations } from "@/lib/db/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rotations = await listRotations();
  return Response.json({ rotations });
}
