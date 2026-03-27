function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--radius-md)] bg-border-light animate-pulse ${className}`}
    />
  );
}

export default function ReviewLoading() {
  return (
    <main className="flex flex-1 flex-col min-h-screen bg-background pb-24">
      {/* Header skeleton */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-40 mx-auto" />
            <Skeleton className="h-3 w-56 mx-auto" />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
        {/* Transcript skeleton */}
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/4" />
        </div>

        {/* Assessment skeleton */}
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 space-y-5">
          <Skeleton className="h-5 w-32" />

          {/* Coaching blocks */}
          <div className="space-y-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>

          {/* Field rows */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <Skeleton className="h-3 w-28 shrink-0" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}

          {/* Competency pills */}
          <div className="flex gap-2 flex-wrap">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>

          {/* Narrative */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>

        {/* Action buttons skeleton */}
        <div className="flex gap-3">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 flex-1" />
        </div>
      </div>

      {/* Audio player bar skeleton */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface px-4 py-3">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <Skeleton className="h-2 flex-1 rounded-full" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
    </main>
  );
}
