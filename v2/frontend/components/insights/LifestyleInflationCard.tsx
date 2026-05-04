"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyTrend } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

type Props = { data: MonthlyTrend[] };

export function LifestyleInflationCard({ data }: Props) {
  // Exclude months with no income and need at least 4 remaining for a meaningful split
  const valid = data.filter((d) => d.income > 0);
  if (valid.length < 4) return null;

  const expenses = valid.map((d) => d.expenses);
  const mid = Math.floor(expenses.length / 2);
  const early  = expenses.slice(0, mid);
  const recent = expenses.slice(mid);

  const avgEarly  = early.reduce((s, v) => s + v, 0) / early.length;
  const avgRecent = recent.reduce((s, v) => s + v, 0) / recent.length;
  const changePct = ((avgRecent - avgEarly) / avgEarly) * 100;
  const changeAbs = avgRecent - avgEarly;

  const verdict =
    changePct > 10  ? "inflating"  :
    changePct < -10 ? "deflating"  :
    "stable";

  const verdictColor =
    verdict === "inflating" ? "oklch(0.56 0.200 25)"  :
    verdict === "deflating" ? "oklch(0.62 0.175 148)" :
    "oklch(0.50 0.015 255)";

  const verdictLabel =
    verdict === "inflating" ? "Lifestyle creep detected" :
    verdict === "deflating" ? "Spending is shrinking"    :
    "Spending is stable";

  const earlyLabel  = `${valid[0].month} – ${valid[mid - 1].month}`;
  const recentLabel = `${valid[mid].month} – ${valid[valid.length - 1].month}`;

  // Bar widths: scale so the larger = 100%
  const maxAvg = Math.max(avgEarly, avgRecent);
  const earlyW  = (avgEarly  / maxAvg) * 100;
  const recentW = (avgRecent / maxAvg) * 100;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Lifestyle Inflation</CardTitle>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background:
                verdict === "inflating" ? "oklch(0.95 0.05 25)"  :
                verdict === "deflating" ? "oklch(0.95 0.05 148)" :
                "oklch(0.95 0.004 75)",
              color: verdictColor,
            }}
          >
            {changePct > 0 ? "+" : ""}{changePct.toFixed(1)}%
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground">{verdictLabel}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {[
          { label: earlyLabel,  avg: avgEarly,  barW: earlyW,  muted: true },
          { label: recentLabel, avg: avgRecent, barW: recentW, muted: false },
        ].map((row) => (
          <div key={row.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">{row.label}</span>
              <span className={`font-semibold tabular-nums ${row.muted ? "text-muted-foreground" : ""}`}>
                {fmt(row.avg)} PLN/mo
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${row.barW}%`,
                  background: row.muted ? "oklch(0.80 0.006 75)" : verdictColor,
                }}
              />
            </div>
          </div>
        ))}

        <p className="text-[12px] text-muted-foreground pt-1">
          Monthly burn{" "}
          <span className="font-semibold" style={{ color: verdictColor }}>
            {changeAbs >= 0 ? "+" : ""}{fmt(changeAbs)} PLN
          </span>
          {" "}vs your earlier average
        </p>
      </CardContent>
    </Card>
  );
}
