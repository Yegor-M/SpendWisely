"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecurringSummary, Summary } from "@/lib/api";

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

type Props = { data: RecurringSummary; summary?: Summary };

export function RecurringCostsCard({ data, summary }: Props) {
  const topItems = data.items.slice(0, 10);

  const fixed    = data.total_monthly_recurring;
  const total    = summary?.avg_monthly_expenses ?? 0;
  const variable = Math.max(0, total - fixed);
  const fixedPct = total > 0 ? Math.min(100, (fixed / total) * 100) : 0;
  const varPct   = 100 - fixedPct;

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
              <div key={i} className="flex items-center py-2.5 first:pt-0 last:pb-0 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{item.counterparty}</p>
                  <p className="text-[11px] text-muted-foreground">{item.category} · {item.occurrences}×</p>
                </div>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${periodBadge[item.period] ?? "bg-muted text-muted-foreground"}`}
                >
                  {item.period}
                </span>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-semibold tabular-nums">{fmt(item.monthly_equiv)} PLN</p>
                  <p
                    className="text-[10px] font-medium"
                    style={{ color: regularityColor(item.regularity) }}
                  >
                    {(item.regularity * 100).toFixed(0)}% regular
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {summary && total > 0 && (
          <div className="pt-2 border-t border-border/50 space-y-2">
            <div className="h-2 rounded-full overflow-hidden flex">
              <div className="h-full" style={{ width: `${fixedPct}%`, background: "oklch(0.55 0.195 265)" }} />
              <div className="h-full" style={{ width: `${varPct}%`, background: "oklch(0.62 0.175 148)" }} />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>
                <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: "oklch(0.55 0.195 265)" }} />
                Fixed {fmt(fixed)} PLN <span className="opacity-60">({fixedPct.toFixed(0)}%)</span>
              </span>
              <span>
                <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: "oklch(0.62 0.175 148)" }} />
                Variable {fmt(variable)} PLN <span className="opacity-60">({varPct.toFixed(0)}%)</span>
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
