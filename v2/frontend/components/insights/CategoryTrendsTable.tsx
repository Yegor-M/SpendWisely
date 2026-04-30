"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryTrend } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

const trendColor = { up: "oklch(0.56 0.200 25)", down: "oklch(0.64 0.170 145)", flat: "oklch(0.50 0.015 255)" };
const trendLabel = { up: "▲", down: "▼", flat: "→" };

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 56;
  const h = 22;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={w} height={h}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="oklch(0.62 0.155 38)"
      />
    </svg>
  );
}

export function CategoryTrendsTable({ data }: { data: CategoryTrend[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50">
          {data.slice(0, 14).map((row) => (
            <div key={row.category} className="flex items-center py-2.5 first:pt-0 last:pb-0 gap-3">
              <span className="flex-1 text-[13px] font-medium truncate">{row.category}</span>
              <span className="text-[12px] text-muted-foreground tabular-nums w-20 text-right">
                avg {fmt(row.avg)}
              </span>
              <div className="w-14 flex justify-center">
                <Sparkline values={row.values} />
              </div>
              <span
                className="text-[12px] font-semibold w-8 text-right"
                style={{ color: trendColor[row.trend] }}
              >
                {trendLabel[row.trend]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
