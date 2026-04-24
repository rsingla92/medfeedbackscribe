import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { upsertProfile } from "@/lib/db/queries";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      full_name?: string;
      email?: string;
      program?: string | null;
      specialty?: string | null;
      year_of_training?: number | null;
      site?: string | null;
    };

    const fullName = body.full_name?.trim();
    if (!fullName) {
      return Response.json({ error: "Full name required" }, { status: 400 });
    }

    const email = body.email?.trim();
    if (!email || !isValidEmail(email)) {
      return Response.json(
        { error: "A valid institutional email is required" },
        { status: 400 },
      );
    }

    await upsertProfile(session.user.id, {
      full_name: fullName,
      email,
      program: body.program ?? null,
      specialty: body.specialty ?? null,
      year_of_training: body.year_of_training ?? null,
      site: body.site ?? null,
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("Onboarding route error:", message);
    return Response.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
