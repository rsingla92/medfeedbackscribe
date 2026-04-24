import Link from "next/link";

function describe(code: string | undefined): string {
  switch (code) {
    case "Configuration":
      return "The server is misconfigured. Please contact support.";
    case "AccessDenied":
      return "Access denied. Please contact your program administrator.";
    case "Verification":
      return "The sign-in link was invalid or has expired.";
    case "OAuthAccountNotLinked":
      return "This email is already linked to a different sign-in method.";
    default:
      return "Something went wrong while signing in.";
  }
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-[family-name:var(--font-display)] text-foreground">
          Sign-in error
        </h1>
        <p className="text-sm text-muted">{describe(error)}</p>
        <Link
          href="/auth"
          className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
