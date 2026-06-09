"use client";
import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import type { DailySpend } from "@/lib/api";

const CAT_COLORS: Record<string, string> = {
  "Groceries":        "oklch(0.60 0.160 148)",
  "Food & Dining":    "oklch(0.72 0.155 60)",
  "Transport":        "oklch(0.62 0.145 220)",
  "Rent & Housing":   "oklch(0.52 0.195 265)",
  "Accounting":       "oklch(0.58 0.155 310)",
  "Healthcare":       "oklch(0.65 0.140 185)",
  "Online Shopping":  "oklch(0.68 0.165 32)",
  "Entertainment":    "oklch(0.62 0.155 280)",
  "Sports & Fitness": "oklch(0.60 0.170 140)",
  "Subscriptions":    "oklch(0.64 0.130 250)",
  "Clothing":         "oklch(0.66 0.148 350)",
  "Education":        "oklch(0.60 0.145 200)",
  "Transfers":        "oklch(0.70 0.080 60)",
  "Crypto":           "oklch(0.62 0.175 80)",
  "Travel":           "oklch(0.68 0.160 165)",
  "Personal Care":    "oklch(0.70 0.130 330)",
  "Gifts":            "oklch(0.68 0.150 15)",
  "Other":            "oklch(0.82 0.018 0)",
};

const FALLBACK_COLORS = [
  "oklch(0.60 0.160 148)", "oklch(0.72 0.155 60)", "oklch(0.62 0.145 220)",
  "oklch(0.52 0.195 265)", "oklch(0.58 0.155 310)", "oklch(0.65 0.140 185)",
];

function color(cat: string, idx: number) {
  return CAT_COLORS[cat] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

function toYM(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return toYM(d);
}
function label(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en", { month: "long", year: "numeric" });
}

function CustomTooltip({ active, payload, label: lbl }: {
  active?: boolean; payload?: Array<{ name: string; value: number; fill: string }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const nonZero = payload.filter((p) => p.value > 0).slice().reverse();
  const total = nonZero.reduce((s, p) => s + p.value, 0);
  if (total === 0) return null;
  const day = lbl ? Number(lbl.split("-")[2]) : "";
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-[12px] min-w-[160px]">
      <p className="text-[11px] font-semibold text-muted-foreground mb-2">Day {day}</p>
      {nonZero.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.fill }} />
            <span className="text-muted-foreground truncate">{p.name}</span>
          </div>
          <span className="font-medium tabular-nums shrink-0">
            {Math.round(p.value).toLocaleString("pl-PL")}
          </span>
        </div>
      ))}
      {nonZero.length > 1 && (
        <div className="flex justify-between border-t border-border mt-1.5 pt-1.5 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{Math.round(total).toLocaleString("pl-PL")}</span>
        </div>
      )}
    </div>
  );
}

export function DailySpendChart() {
  const today = new Date();
  const [month, setMonth] = useState(() => toYM(today));
  const [data, setData] = useState<DailySpend | null>(null);
  const [loading, setLoading] = useState(true);
  const isCurrentMonth = month >= toYM(today);

  const fetchData = () => {
    setLoading(true);
    api.dailySpend(month).then(setData).finally(() => setLoading(false));
  };

  useEffect(fetchData, [month]);

  useEffect(() => {
    window.addEventListener("spendwisely:import", fetchData);
    return () => window.removeEventListener("spendwisely:import", fetchData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const activeDays = data?.days.filter((d) =>
    data.categories.some((c) => (d[c] ?? 0) > 0)
  ) ?? [];
  const avgDaily = activeDays.length > 0
    ? activeDays.reduce((s, d) => s + data!.categories.reduce((cs, c) => cs + (d[c] ?? 0), 0), 0) / activeDays.length
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Daily Spending</CardTitle>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="p-1 rounded hover:bg-muted transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-[13px] font-medium w-[140px] text-center">{label(month)}</span>
            <button
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={isCurrentMonth}
              className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : !data || data.days.length === 0 || data.categories.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            No spending data for this month.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data.days}
                margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
                barCategoryGap="18%"
              >
                <CartesianGrid
                  strokeDasharray="none"
                  vertical={false}
                  stroke="oklch(0.91 0.006 75)"
                  strokeWidth={1}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => String(Number((v as string).split("-")[2]))}
                  tick={{ fontSize: 10, fill: "oklch(0.55 0.020 0)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "oklch(0.55 0.020 0)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                  width={36}
                />
                <Tooltip
                  cursor={{ fill: "oklch(0.95 0.005 0)", radius: 3 }}
                  content={<CustomTooltip />}
                />
                {avgDaily > 0 && (
                  <ReferenceLine
                    y={avgDaily}
                    stroke="oklch(0.60 0.025 0)"
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    label={{
                      value: `avg ${Math.round(avgDaily).toLocaleString("pl-PL")}`,
                      position: "right",
                      fontSize: 9,
                      fill: "oklch(0.55 0.025 0)",
                    }}
                  />
                )}
                {data.categories.map((cat, i) => (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    stackId="spend"
                    fill={color(cat, i)}
                    radius={i === data.categories.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {data.categories.map((cat, i) => (
                <div key={cat} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: color(cat, i) }}
                  />
                  <span className="text-[11px] text-muted-foreground">{cat}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
