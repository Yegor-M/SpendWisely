"use client";
import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
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

const totalFmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

export function CategoryPie({ data }: { data: CategoryBreakdown[] }) {
  const top = data.slice(0, 10);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const totalSpend = top.reduce((s, d) => s + d.total_spent, 0);
  const anySelected = selected.size > 0;
  const selectedPct = anySelected
    ? Math.round(top.filter((_, i) => selected.has(i)).reduce((s, d) => s + d.share_pct, 0) * 10) / 10
    : null;
  const selectedSpend = anySelected
    ? top.filter((_, i) => selected.has(i)).reduce((s, d) => s + d.total_spent, 0)
    : null;

  function toggle(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-5 items-start">
          <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
            <PieChart width={200} height={200} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Pie
                data={top}
                dataKey="total_spent"
                nameKey="category"
                cx={100}
                cy={100}
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
                strokeWidth={0}
                onClick={(_: unknown, idx: number) => toggle(idx)}
                style={{ cursor: "pointer" }}
              >
                {top.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PALETTE[i % PALETTE.length]}
                    opacity={!anySelected || selected.has(i) ? 1 : 0.2}
                  />
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
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-3 text-center">
              {anySelected ? (
                <>
                  <span className="text-2xl font-semibold leading-tight">{selectedPct}%</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{totalFmt(selectedSpend!)} PLN</span>
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">total</span>
                  <span className="text-lg font-semibold leading-tight">{totalFmt(totalSpend)}</span>
                  <span className="text-xs text-muted-foreground">PLN</span>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 space-y-1.5 min-w-0 pt-1">
            {top.map((d, i) => {
              const isActive = selected.has(i);
              return (
                <div
                  key={d.category}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                  onClick={() => toggle(i)}
                  style={{ opacity: !anySelected || isActive ? 1 : 0.35 }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: PALETTE[i % PALETTE.length] }}
                  />
                  <span className="truncate text-[13px] flex-1">{d.category}</span>
                  <span className="text-[12px] text-muted-foreground shrink-0">{d.share_pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
