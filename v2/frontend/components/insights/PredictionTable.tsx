"use client";
import { useState } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Prediction } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

const fmtSigned = (n: number) =>
  (n >= 0 ? "+" : "") + new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

// Confidence config
const CONFIDENCE: Record<string, { label: string; color: string; desc: string }> = {
  high:   { label: "Stable",   color: "oklch(0.62 0.175 148)", desc: "Low variance across months — reliable estimate" },
  medium: { label: "Variable", color: "oklch(0.70 0.145 90)",  desc: "Some variance — treat as a range, not a point" },
  low:    { label: "Volatile", color: "oklch(0.58 0.200 25)",  desc: "Highly irregular — actual may differ significantly" },
  "—":    { label: "",         color: "oklch(0.54 0.190 152)", desc: "" },
};

const TREND_ICON: Record<string, string>  = { up: "↑", down: "↓", stable: "→" };
const TREND_COLOR: Record<string, string> = {
  up:     "oklch(0.58 0.200 25)",   // coral — spending going up is a warning
  down:   "oklch(0.52 0.185 155)",  // deep emerald — going down is good
  stable: "oklch(0.60 0.010 255)",  // neutral grey
};

// Tiny 6-bar sparkline
function Sparkline({ history }: { history: { month: string; amount: number }[] }) {
  if (!history.length) return null;
  const max = Math.max(...history.map((h) => h.amount), 1);
  return (
    <div className="flex items-end gap-px h-8 shrink-0">
      {history.map((h, i) => {
        const pct = h.amount / max;
        const isLast = i === history.length - 1;
        return (
          <div
            key={h.month}
            title={`${h.month}: ${fmt(h.amount)} PLN`}
            className="w-2.5 rounded-sm"
            style={{
              height: `${Math.max(pct * 100, 4)}%`,
              background: isLast
                ? "oklch(0.70 0.145 90)"
                : "oklch(0.62 0.175 148 / 0.5)",
            }}
          />
        );
      })}
    </div>
  );
}

type SortKey = "predicted" | "delta" | "trend" | "confidence";

export function PredictionTable({ data }: { data: Prediction[] }) {
  const [sort, setSort] = useState<SortKey>("predicted");
  const [showChart, setShowChart] = useState(false);

  const total = data.find((r) => r.category === "TOTAL");
  const rows  = data.filter((r) => r.category !== "TOTAL");

  const sorted = [...rows].sort((a, b) => {
    if (sort === "predicted")   return b.predicted_spend - a.predicted_spend;
    if (sort === "delta")       return b.delta_vs_last - a.delta_vs_last;
    if (sort === "trend")       return b.trend_pct - a.trend_pct;
    if (sort === "confidence") {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.confidence as keyof typeof order] ?? 3) - (order[b.confidence as keyof typeof order] ?? 3);
    }
    return 0;
  });

  const trendingUp   = rows.filter((r) => r.trend_direction === "up").length;
  const trendingDown = rows.filter((r) => r.trend_direction === "down").length;
  const volatile     = rows.filter((r) => r.confidence === "low").length;

  // chart data: last month actual vs predicted, top 8 by predicted
  const chartData = [...rows]
    .sort((a, b) => b.predicted_spend - a.predicted_spend)
    .slice(0, 8)
    .map((r) => ({
      name: r.category.length > 12 ? r.category.slice(0, 12) + "…" : r.category,
      "Last month": Math.round(r.last_month_actual),
      "Predicted":  Math.round(r.predicted_spend),
    }));

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => setSort(k)}
      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
        sort === k
          ? "bg-foreground text-background border-foreground"
          : "text-muted-foreground border-border hover:border-foreground/40"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Next Month Forecast</CardTitle>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Linear trend over {rows[0]?.months_observed ?? "?"} months of history
            </p>
          </div>
          {total && (
            <div className="text-right">
              <div className="text-xl font-semibold tabular-nums">{fmt(total.predicted_spend)} PLN</div>
              <div
                className="text-[12px] tabular-nums font-medium"
                style={{ color: total.delta_vs_last >= 0 ? "oklch(0.58 0.200 25)" : "oklch(0.52 0.185 155)" }}
              >
                {fmtSigned(total.delta_vs_last)} vs last month
              </div>
            </div>
          )}
        </div>

        {/* Summary pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-muted">
            {rows.length} categories
          </span>
          {trendingUp > 0 && (
            <span
              className="text-[11px] px-2.5 py-1 rounded-full font-medium"
              style={{ background: "oklch(0.58 0.200 25 / 0.12)", color: "oklch(0.58 0.200 25)" }}
            >
              ↑ {trendingUp} trending up
            </span>
          )}
          {trendingDown > 0 && (
            <span
              className="text-[11px] px-2.5 py-1 rounded-full font-medium"
              style={{ background: "oklch(0.52 0.185 155 / 0.12)", color: "oklch(0.52 0.185 155)" }}
            >
              ↓ {trendingDown} trending down
            </span>
          )}
          {volatile > 0 && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              ⚡ {volatile} volatile
            </span>
          )}
        </div>

        {/* Sort + chart toggle */}
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="flex gap-1.5">
            <SortBtn k="predicted"   label="By amount" />
            <SortBtn k="delta"       label="By delta" />
            <SortBtn k="trend"       label="By trend" />
            <SortBtn k="confidence"  label="By stability" />
          </div>
          <button
            onClick={() => setShowChart((v) => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            {showChart ? "Hide chart" : "Show comparison chart"}
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Comparison bar chart */}
        {showChart && (
          <div className="rounded-xl border border-border/50 p-3 bg-muted/30">
            <p className="text-[11px] text-muted-foreground mb-3">Last month actual vs next month predicted (top 8)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barCategoryGap="28%" barGap={3}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmt} width={55} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(1 0 0)",
                    border: "1px solid oklch(0.908 0.006 75)",
                    borderRadius: "10px",
                    fontSize: 12,
                  }}
                  formatter={(v) => `${fmt(Number(v))} PLN`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Last month" fill="oklch(0.62 0.175 148 / 0.45)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Predicted"  fill="oklch(0.62 0.175 148)"         radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category rows */}
        <div className="divide-y divide-border/40">
          {sorted.map((row) => {
            const conf  = CONFIDENCE[row.confidence] ?? CONFIDENCE.low;
            const isUp  = row.trend_direction === "up";
            const isVolatile = row.confidence === "low";
            return (
              <div key={row.category} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                {/* Row header */}
                <div className="flex items-center gap-2">
                  {/* Trend arrow */}
                  <span
                    className="text-sm font-bold w-4 shrink-0 tabular-nums"
                    style={{ color: TREND_COLOR[row.trend_direction] }}
                    title={`${row.trend_pct > 0 ? "+" : ""}${row.trend_pct}% monthly trend`}
                  >
                    {TREND_ICON[row.trend_direction]}
                  </span>

                  <span className="flex-1 text-[13px] font-semibold truncate">{row.category}</span>

                  {/* Watch flag */}
                  {isUp && row.trend_pct > 10 && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                      style={{ background: "oklch(0.58 0.200 25 / 0.12)", color: "oklch(0.58 0.200 25)" }}
                    >
                      watch
                    </span>
                  )}

                  {/* Confidence pill */}
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: `${conf.color}18`, color: conf.color }}
                    title={conf.desc}
                  >
                    {conf.label}
                  </span>

                  {/* Predicted amount */}
                  <span className="text-[14px] font-semibold tabular-nums w-24 text-right shrink-0">
                    {fmt(row.predicted_spend)} PLN
                  </span>
                </div>

                {/* Row detail line */}
                <div className="flex items-end gap-3 pl-6">
                  <div className="flex-1 space-y-0.5">
                    {/* Last month → predicted */}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>Last month: <span className="text-foreground font-medium tabular-nums">{fmt(row.last_month_actual)} PLN</span></span>
                      <span>·</span>
                      <span
                        className="font-medium tabular-nums"
                        style={{ color: row.delta_vs_last >= 0 ? "oklch(0.58 0.200 25)" : "oklch(0.52 0.185 155)" }}
                      >
                        {fmtSigned(row.delta_vs_last)}
                      </span>
                    </div>

                    {/* Range band */}
                    {row.range_low !== row.range_high && (
                      <div className="text-[11px] text-muted-foreground">
                        Range: <span className="tabular-nums">{fmt(row.range_low)}–{fmt(row.range_high)} PLN</span>
                        {row.cv > 0 && (
                          <span className="ml-1.5 opacity-60">
                            (CV {Math.round(row.cv * 100)}%{isVolatile ? " — high variance" : ""})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Trend detail */}
                    {row.trend_direction !== "stable" && (
                      <div className="text-[11px]" style={{ color: TREND_COLOR[row.trend_direction] }}>
                        {row.trend_direction === "up" ? "Growing" : "Shrinking"} ~{Math.abs(row.trend_pct)}%/month
                        {" · "}{row.months_observed}mo of data
                      </div>
                    )}
                    {row.trend_direction === "stable" && (
                      <div className="text-[11px] text-muted-foreground">
                        Stable · avg {fmt(row.avg_historical)} PLN · {row.months_observed}mo of data
                      </div>
                    )}
                  </div>

                  {/* Sparkline */}
                  <Sparkline history={row.history} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="pt-2 border-t border-border/40 flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[11px] text-muted-foreground">
            <span style={{ color: CONFIDENCE.high.color }}>● Stable</span> — CV &lt; 20%
          </span>
          <span className="text-[11px] text-muted-foreground">
            <span style={{ color: CONFIDENCE.medium.color }}>● Variable</span> — CV 20–50%
          </span>
          <span className="text-[11px] text-muted-foreground">
            <span style={{ color: CONFIDENCE.low.color }}>● Volatile</span> — CV &gt; 50%
          </span>
          <span className="text-[11px] text-muted-foreground ml-auto">
            Sparkline bars = last 6 months · amber bar = most recent
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
