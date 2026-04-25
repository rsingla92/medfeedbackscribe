export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { LandingContent } from "./_landing/content";

export default async function HomePage() {
  // Always render the marketing landing page at "/". Authenticated users see
  // a "Dashboard" link in the nav instead of "Sign in" so they can jump back
  // into the app from the public page (e.g. after clicking the logo).
  const session = await auth();
  const isAuthenticated = Boolean(session?.user?.id);
  return <LandingContent isAuthenticated={isAuthenticated} />;
}
