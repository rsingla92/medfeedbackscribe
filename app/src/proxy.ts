import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export default async function proxy(request: NextRequest) {
  // Dev-only: bypass auth for testing. Use DEV_BYPASS_AUTH (no NEXT_PUBLIC_ prefix)
  // so this value is never baked into the client bundle at build time.
  // Hard-blocked in production to prevent accidental bypass.
  if (process.env.DEV_BYPASS_AUTH === "true" && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
