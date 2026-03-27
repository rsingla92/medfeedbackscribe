import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle expired or invalid links — redirect back to auth with error info
  if (error || errorDescription) {
    const authUrl = new URL("/auth", origin);
    authUrl.searchParams.set("error", error ?? "access_denied");
    if (errorDescription) {
      authUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(authUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // Successful authentication — redirect to home
      return NextResponse.redirect(new URL("/", origin));
    }

    // Exchange failed (likely expired code) — redirect to auth with error
    const authUrl = new URL("/auth", origin);
    authUrl.searchParams.set("error", "access_denied");
    authUrl.searchParams.set(
      "error_description",
      "Link expired or already used"
    );
    return NextResponse.redirect(authUrl);
  }

  // No code provided — redirect to auth
  return NextResponse.redirect(new URL("/auth", origin));
}
