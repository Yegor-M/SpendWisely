function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border bg-card p-5 ${className}`}>
      <div className="h-3 w-24 bg-muted rounded animate-pulse mb-4" />
      <div className="space-y-3">
        <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
        <div className="h-3 w-full bg-muted rounded animate-pulse" />
        <div className="h-3 w-4/5 bg-muted rounded animate-pulse" />
        <div className="h-3 w-3/5 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="h-7 w-20 bg-muted rounded-lg animate-pulse mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CardSkeleton />
        <CardSkeleton />
        <div className="rounded-2xl border bg-card p-5">
          <div className="h-3 w-28 bg-muted rounded animate-pulse mb-4" />
          <div className="h-40 w-full bg-muted rounded-xl animate-pulse" />
        </div>
        <CardSkeleton />
        <div className="rounded-2xl border bg-card p-5">
          <div className="h-3 w-32 bg-muted rounded animate-pulse mb-4" />
          <div className="h-48 w-full bg-muted rounded-xl animate-pulse" />
        </div>
        <CardSkeleton />
        <CardSkeleton />
        <div className="rounded-2xl border bg-card p-5">
          <div className="h-3 w-28 bg-muted rounded animate-pulse mb-4" />
          <div className="flex gap-6">
            <div className="h-36 w-36 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-3 pt-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-7 w-32 bg-muted rounded animate-pulse" />
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-7 w-32 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
