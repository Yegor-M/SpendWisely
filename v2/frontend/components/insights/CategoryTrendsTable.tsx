"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryTrend } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 60;
  const h = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  });

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-indigo-500"
      />
    </svg>
  );
}

export function CategoryTrendsTable({ data }: { data: CategoryTrend[] }) {
  const top = data.slice(0, 15);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Category Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left pb-2">Category</th>
                <th className="text-right pb-2">Avg/mo</th>
                <th className="text-center pb-2">Trend</th>
                <th className="text-right pb-2">Direction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {top.map((row) => (
                <tr key={row.category}>
                  <td className="py-1.5 font-medium">{row.category}</td>
                  <td className="py-1.5 text-right">{fmt(row.avg)}</td>
                  <td className="py-1.5 text-center">
                    <Sparkline values={row.values} />
                  </td>
                  <td className={`py-1.5 text-right text-xs font-semibold ${
                    row.trend === "up" ? "text-red-500" :
                    row.trend === "down" ? "text-green-500" : "text-muted-foreground"
                  }`}>
                    {row.trend === "up" ? "▲ Up" : row.trend === "down" ? "▼ Down" : "→ Flat"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
