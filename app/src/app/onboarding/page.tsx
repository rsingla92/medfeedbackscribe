export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();
  // Pre-fill with whatever email the user signed in with; they can override
  // if their auth account uses a personal email but their program uses a
  // different one.
  const authEmail = session?.user?.email ?? "";
  return <OnboardingForm authEmail={authEmail} />;
}
