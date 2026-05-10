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
    <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      <div className="space-y-1">
        <div className="h-6 w-16 bg-muted rounded-lg animate-pulse" />
        <div className="h-3 w-48 bg-muted rounded animate-pulse" />
      </div>

      {/* This Month */}
      <div className="space-y-4">
        <div className="h-3 w-28 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <div className="h-3 w-24 bg-muted rounded animate-pulse mb-5" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border bg-muted/30 p-3">
                <div className="h-2.5 w-16 bg-muted rounded animate-pulse mb-2" />
                <div className="h-6 w-20 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <div className="w-5 h-5 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="w-8 h-3 bg-muted rounded animate-pulse" />
                <div className="flex-1 h-3 bg-muted rounded animate-pulse" />
                <div className="w-20 h-3 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Prediction */}
      <div className="space-y-4">
        <div className="h-3 w-36 bg-muted rounded animate-pulse" />
        <CardSkeleton className="h-64" />
      </div>
    </main>
  );
}
