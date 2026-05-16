export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse border-[2px] border-retro-border ${className}`}
      style={{ background: "var(--code-bg)", ...style }}
    />
  );
}

export function SkeletonText({ width = "100%" }: { width?: string }) {
  return <Skeleton className="h-3 rounded-none" style={{ width }} />;
}

export function SkeletonCard() {
  return (
    <div
      className="border-[3px] border-retro-border p-4"
      style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}
    >
      <Skeleton className="w-9 h-9 mb-3" />
      <Skeleton className="h-4 w-2/3 mb-2" />
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

export function SkeletonMetric() {
  return (
    <div
      className="border-[3px] border-retro-border p-4"
      style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}
    >
      <Skeleton className="w-9 h-9 mb-3" />
      <Skeleton className="h-6 w-16 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function SkeletonFormPage() {
  return (
    <div className="min-h-screen dot-grid" style={{ backgroundColor: "var(--bg)" }}>
      {/* Header skeleton */}
      <div
        className="h-12 flex items-center px-4 md:px-6"
        style={{ background: "var(--nav-bg)", borderBottom: "3px solid var(--border-color)" }}
      >
        <Skeleton className="h-4 w-32" />
      </div>

      <main className="pt-6 pb-16 px-4 md:px-6 max-w-2xl mx-auto">
        {/* Title card */}
        <div
          className="border-[3px] border-retro-border p-5 md:p-6 mb-5"
          style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}
        >
          <Skeleton className="h-6 w-3/4 mb-3" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-2/3 mb-4" />
          <div className="flex gap-3 pt-3 border-t-[2px]" style={{ borderColor: "var(--border-light)" }}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>

        {/* Field skeletons */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border-[3px] border-retro-border p-3 mb-3"
            style={{ background: "var(--bg-secondary)" }}
          >
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}

        {/* Button skeleton */}
        <Skeleton className="h-10 w-full mt-2" />
      </main>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="min-h-screen dot-grid" style={{ backgroundColor: "var(--bg)" }}>
      {/* Header */}
      <div
        className="h-16 flex items-center justify-between px-4 md:px-6 lg:px-10"
        style={{ background: "var(--nav-bg)", borderBottom: "3px solid var(--border-color)" }}
      >
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>

      <div className="pt-24 pb-12 px-4 md:px-6 lg:px-10 max-w-7xl mx-auto">
        {/* Title */}
        <div className="mb-8">
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-3 w-72" />
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => <SkeletonMetric key={i} />)}
        </div>

        {/* Form list */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-[3px] border-retro-border p-4"
              style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}
            >
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-3 w-40 mb-2" />
                  <Skeleton className="h-2.5 w-64" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
