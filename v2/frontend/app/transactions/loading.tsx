export default function Loading() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="h-7 w-36 bg-muted rounded-lg animate-pulse mb-6" />
      <div className="rounded-2xl border overflow-hidden">
        <div className="flex gap-6 px-4 py-3 border-b bg-muted/30">
          {[80, 130, 80, 90, 80, 55].map((w, i) => (
            <div key={i} className="h-3 rounded animate-pulse bg-muted" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="flex gap-6 items-center px-4 py-3.5 border-b last:border-0">
            <div className="h-3 rounded animate-pulse bg-muted shrink-0" style={{ width: 80 }} />
            <div className="h-3 rounded animate-pulse bg-muted shrink-0" style={{ width: 130 }} />
            <div className="h-3 rounded animate-pulse bg-muted flex-1" style={{ maxWidth: 240 }} />
            <div className="h-5 rounded-full animate-pulse bg-muted shrink-0" style={{ width: 90 }} />
            <div className="h-3 rounded animate-pulse bg-muted shrink-0 ml-auto" style={{ width: 70 }} />
            <div className="h-3 rounded animate-pulse bg-muted shrink-0" style={{ width: 32 }} />
          </div>
        ))}
      </div>
    </main>
  );
}
