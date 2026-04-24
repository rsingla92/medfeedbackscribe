import { LandingContent } from "@/app/_landing/content";

// /landing renders the marketing page regardless of auth state.
// This is intentional — it lets signed-in users (and devs with
// DEV_BYPASS_AUTH on) preview the public page. The root "/" routes
// authenticated users to the dashboard; use /landing for preview.
export default function LandingPage() {
  return <LandingContent />;
}
