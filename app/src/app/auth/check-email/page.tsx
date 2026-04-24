export default function CheckEmailPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-[family-name:var(--font-display)] text-foreground">
            Check your email
          </h1>
          <p className="text-muted text-base">
            We sent you a sign-in link. Click the link in your email to
            continue.
          </p>
        </div>
        <p className="text-xs text-subtle">
          The link expires in 24 hours and can only be used once.
        </p>
      </div>
    </main>
  );
}
