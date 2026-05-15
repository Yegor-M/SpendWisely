"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecurringSummary } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

const regularityColor = (r: number) =>
  r >= 0.85 ? "oklch(0.62 0.175 148)"
  : r >= 0.6 ? "oklch(0.70 0.145 90)"
  : "oklch(0.65 0.200 50)";

const periodBadge: Record<string, string> = {
  Monthly:    "bg-blue-50 text-blue-700",
  "Bi-weekly":"bg-purple-50 text-purple-700",
  Weekly:     "bg-orange-50 text-orange-700",
  Quarterly:  "bg-gray-100 text-gray-600",
  Annual:     "bg-gray-100 text-gray-600",
};

type Props = { data: RecurringSummary };

export function RecurringCostsCard({ data }: Props) {
  const topItems = data.items.slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Recurring Costs</CardTitle>
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">
              {fmt(data.total_monthly_recurring)} PLN
            </p>
            <p className="text-[11px] text-muted-foreground">committed /month</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {topItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recurring transactions detected.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {topItems.map((item, i) => (
              <div key={i} className="flex items-center py-1.5 first:pt-0 last:pb-0 gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate">{item.counterparty}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{item.category}</span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${periodBadge[item.period] ?? "bg-muted text-muted-foreground"}`}
                >
                  {item.period}
                </span>
                <p className="text-[12px] font-semibold tabular-nums shrink-0">
                  {item.amount_max > 0 && (item.amount_max - item.amount_min) / item.amount_max > 0.05
                    ? <>{fmt(item.amount_min)}<span className="text-muted-foreground font-normal">–</span>{fmt(item.amount_max)}</>
                    : fmt(item.monthly_equiv)
                  }
                </p>
              </div>
            ))}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
