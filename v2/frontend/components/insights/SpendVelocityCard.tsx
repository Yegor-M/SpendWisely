"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SpendVelocity } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

export function SpendVelocityCard({ data }: { data: SpendVelocity }) {
  if (!data.has_current_data) {
    return (
      <Card>
        <CardHeader><CardTitle>This Month</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">No transactions yet this month.</CardContent>
      </Card>
    );
  }

  const isOver = data.vs_avg_pct !== null && data.vs_avg_pct > 10;
  const isUnder = data.vs_avg_pct !== null && data.vs_avg_pct < -10;
  const accentColor = isOver ? "oklch(0.56 0.200 25)" : isUnder ? "oklch(0.64 0.170 145)" : "oklch(0.62 0.155 38)";

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between">
          <CardTitle>This Month · {data.current_month}</CardTitle>
          {data.vs_avg_pct !== null && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background: isOver ? "oklch(0.95 0.05 25)" : isUnder ? "oklch(0.95 0.05 145)" : "oklch(0.96 0.03 38)",
                color: accentColor,
              }}
            >
              {data.vs_avg_pct > 0 ? "+" : ""}{data.vs_avg_pct}% vs avg
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Spent so far</p>
            <p className="text-2xl font-semibold tabular-nums">{fmt(data.spent_so_far)} PLN</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1">EOM projection</p>
            <p className="text-2xl font-semibold tabular-nums" style={{ color: accentColor }}>
              {fmt(data.projected_eom)} PLN
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Month progress</span>
              <span>Day {data.days_elapsed} / {data.days_in_month}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${data.day_pct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Spend pace</span>
              <span>{((data.spent_so_far / (data.projected_eom || 1)) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (data.spent_so_far / (data.projected_eom || 1)) * 100)}%`,
                  background: accentColor,
                }}
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Avg prior months: <span className="font-medium text-foreground">{fmt(data.avg_prior_months)} PLN</span>
        </p>
      </CardContent>
    </Card>
  );
}
