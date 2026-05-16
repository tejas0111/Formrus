import { useMemo } from "react";

interface ResponseChartProps {
  responses: { createdAtMs: string }[];
}

/**
 * Simple bar chart showing responses over time.
 * Groups by day, renders as CSS bars in retro style.
 */
export function ResponseChart({ responses }: ResponseChartProps) {
  const buckets = useMemo(() => {
    const now = Date.now();
    const days = 7;
    const msPerDay = 86_400_000;
    const result: { label: string; count: number; pct: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = now - (i + 1) * msPerDay;
      const dayEnd = now - i * msPerDay;
      const date = new Date(dayEnd);
      const label = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

      const count = responses.filter((r) => {
        const ms = Number(r.createdAtMs);
        return ms > dayStart && ms <= dayEnd;
      }).length;

      result.push({ label, count, pct: 0 });
    }

    const max = Math.max(...result.map((b) => b.count), 1);
    for (const b of result) {
      b.pct = (b.count / max) * 100;
    }

    return result;
  }, [responses]);

  const total = responses.length;
  const last24h = responses.filter((r) => Date.now() - Number(r.createdAtMs) < 86_400_000).length;
  const last7d = responses.filter((r) => Date.now() - Number(r.createdAtMs) < 7 * 86_400_000).length;

  return (
    <div
      className="border-[3px] border-retro-border p-4"
      style={{ background: "var(--bg-card)", boxShadow: "4px 4px 0px var(--shadow-color)" }}
    >
      <h3 className="font-mono font-bold text-xs uppercase mb-4" style={{ color: "var(--text)" }}>
        Response Activity
      </h3>

      {/* Summary stats */}
      <div className="flex gap-4 mb-4">
        <div>
          <span className="font-mono font-bold text-lg" style={{ color: "var(--text)" }}>{total}</span>
          <span className="font-mono text-[10px] uppercase block" style={{ color: "var(--text-muted)" }}>All time</span>
        </div>
        <div>
          <span className="font-mono font-bold text-lg" style={{ color: "var(--neon-cyan)" }}>{last24h}</span>
          <span className="font-mono text-[10px] uppercase block" style={{ color: "var(--text-muted)" }}>Last 24h</span>
        </div>
        <div>
          <span className="font-mono font-bold text-lg" style={{ color: "var(--neon-lime)" }}>{last7d}</span>
          <span className="font-mono text-[10px] uppercase block" style={{ color: "var(--text-muted)" }}>Last 7d</span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1.5 h-28">
        {buckets.map((bucket, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
            <span className="font-mono text-[9px] font-bold min-h-[12px]" style={{ color: "var(--text-muted)" }}>
              {bucket.count > 0 ? bucket.count : ""}
            </span>
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full border-[2px] border-retro-border transition-all duration-500"
                style={{
                  height: `${Math.max(bucket.pct, 4)}%`,
                  background: bucket.count > 0 ? "var(--neon-lime)" : "var(--code-bg)",
                  minHeight: "4px",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Labels */}
      <div className="flex gap-1.5 mt-1.5">
        {buckets.map((bucket, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="font-mono text-[8px] truncate block" style={{ color: "var(--text-muted)" }}>
              {bucket.label.split(" ").slice(0, 2).join(" ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
