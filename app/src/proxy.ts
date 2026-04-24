import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/",
  "/auth",
  "/demo",
  "/onboarding",
  "/landing",
  "/about",
  "/contact",
  "/for-programs",
  "/security",
  "/accessibility",
  "/privacy",
  "/terms",
];

const PUBLIC_API_PREFIXES = ["/api/auth", "/api/health", "/api/ready"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

// Double-gate: explicit positive match on NODE_ENV === "development" so an
// unset NODE_ENV fails closed. Keep in sync with auth.ts.
const devBypassEnabled =
  process.env.DEV_BYPASS_AUTH === "true" &&
  process.env.NODE_ENV === "development";

export default async function proxy(request: NextRequest) {
  if (devBypassEnabled) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const session = await auth();
  if (!session?.user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
