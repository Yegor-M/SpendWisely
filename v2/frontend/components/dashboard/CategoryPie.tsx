"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryBreakdown } from "@/lib/api";

// Green-shades dominant palette with contrast anchors
const PALETTE = [
  "oklch(0.62 0.175 148)",  // vivid emerald
  "oklch(0.44 0.165 158)",  // forest
  "oklch(0.70 0.125 148)",  // sage
  "oklch(0.56 0.165 172)",  // teal
  "oklch(0.55 0.195 265)",  // indigo
  "oklch(0.70 0.145 90)",   // amber
  "oklch(0.52 0.185 155)",  // deep emerald
  "oklch(0.60 0.175 300)",  // violet
  "oklch(0.78 0.090 148)",  // mint
  "oklch(0.58 0.200 25)",   // coral
];

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n) + " PLN";

export function CategoryPie({ data }: { data: CategoryBreakdown[] }) {
  const top = data.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 items-center">
          <div className="shrink-0">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={top}
                  dataKey="total_spent"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {top.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(1 0 0)",
                    border: "1px solid oklch(0.908 0.006 75)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 16px oklch(0 0 0 / 0.08)",
                    fontSize: 12,
                  }}
                  formatter={(v) => fmt(Number(v))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            {top.map((d, i) => (
              <div key={d.category} className="flex items-center gap-2 text-sm">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="truncate text-[13px] flex-1">{d.category}</span>
                <span className="text-[12px] text-muted-foreground shrink-0">{d.share_pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
