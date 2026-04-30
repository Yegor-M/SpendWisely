function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border bg-card p-5 ${className}`}>
      <div className="h-3 w-20 bg-muted rounded animate-pulse mb-3" />
      <div className="h-8 w-36 bg-muted rounded-lg animate-pulse mb-2" />
      <div className="h-3 w-24 bg-muted rounded animate-pulse" />
    </div>
  );
}

export default function Loading() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* header row */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-5 w-20 bg-muted rounded animate-pulse" />
          <div className="h-3 w-36 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-8 w-24 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* hero + stat cards */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2 rounded-2xl border bg-foreground/10 p-5 h-28 animate-pulse" />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-4 h-16 animate-pulse" />
          ))}
        </div>
      </div>

      {/* charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5">
          <div className="h-3 w-32 bg-muted rounded animate-pulse mb-4" />
          <div className="h-60 w-full bg-muted rounded-xl animate-pulse" />
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="h-3 w-36 bg-muted rounded animate-pulse mb-4" />
          <div className="h-60 w-full bg-muted rounded-xl animate-pulse" />
        </div>
      </div>

      {/* merchants + recurring */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5">
          <div className="h-3 w-28 bg-muted rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 items-center">
                <div className="h-3 w-4 bg-muted rounded animate-pulse" />
                <div className="h-3 flex-1 bg-muted rounded animate-pulse" />
                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="h-3 w-36 bg-muted rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 items-center">
                <div className="h-3 flex-1 bg-muted rounded animate-pulse" />
                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
