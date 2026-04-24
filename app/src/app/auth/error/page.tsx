import Link from "next/link";
import { authError } from "@/lib/errors";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const copy = authError(error);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-[family-name:var(--font-display)] text-foreground">
          Sign-in error
        </h1>
        <div className="space-y-2 text-left">
          <p className="text-sm font-semibold text-error">{copy.title}</p>
          <p className="text-sm leading-relaxed text-muted">
            {copy.description}
          </p>
        </div>
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
