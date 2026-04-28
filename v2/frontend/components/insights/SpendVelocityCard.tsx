"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SpendVelocity } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n) + " PLN";

export function SpendVelocityCard({ data }: { data: SpendVelocity }) {
  if (!data.has_current_data) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">This Month</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">No transactions yet this month.</CardContent>
      </Card>
    );
  }

  const spendPct = Math.min(100, (data.spent_so_far / (data.projected_eom || 1)) * 100);
  const isOver = data.vs_avg_pct !== null && data.vs_avg_pct > 10;
  const isUnder = data.vs_avg_pct !== null && data.vs_avg_pct < -10;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">This Month — {data.current_month}</CardTitle>
        {data.vs_avg_pct !== null && (
          <Badge className={isOver ? "bg-red-100 text-red-800" : isUnder ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}>
            {data.vs_avg_pct > 0 ? "+" : ""}{data.vs_avg_pct}% vs avg
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Spent so far</span>
          <span className="font-semibold">{fmt(data.spent_so_far)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Projected EOM</span>
          <span className="font-bold text-base">{fmt(data.projected_eom)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Avg prior months</span>
          <span>{fmt(data.avg_prior_months)}</span>
        </div>

        {/* Progress bar: day elapsed */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Day {data.days_elapsed} of {data.days_in_month}</span>
            <span>{data.day_pct}% through month</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${data.day_pct}%` }}
            />
          </div>
        </div>

        {/* Spend bar vs projection */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Spend pace</span>
            <span>{spendPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : "bg-emerald-500"}`}
              style={{ width: `${spendPct}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
