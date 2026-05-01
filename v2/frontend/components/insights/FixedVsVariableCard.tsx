"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Summary, RecurringSummary } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

type Props = { summary: Summary; recurring: RecurringSummary };

export function FixedVsVariableCard({ summary, recurring }: Props) {
  const fixed    = recurring.total_monthly_recurring;
  const total    = summary.avg_monthly_expenses;
  const variable = Math.max(0, total - fixed);
  const fixedPct = total > 0 ? Math.min(100, (fixed / total) * 100) : 0;
  const varPct   = 100 - fixedPct;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Fixed vs Variable</CardTitle>
          <p className="text-[11px] text-muted-foreground">avg {fmt(total)} PLN/mo</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* stacked bar */}
        <div className="h-3 rounded-full overflow-hidden flex">
          <div
            className="h-full transition-all"
            style={{ width: `${fixedPct}%`, background: "oklch(0.55 0.195 265)" }}
          />
          <div
            className="h-full transition-all"
            style={{ width: `${varPct}%`, background: "oklch(0.62 0.175 148)" }}
          />
        </div>

        {/* legend rows */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "oklch(0.55 0.195 265)" }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fixed</span>
              <span className="text-[11px] text-muted-foreground ml-auto">{fixedPct.toFixed(0)}%</span>
            </div>
            <p className="text-xl font-semibold tabular-nums">{fmt(fixed)} PLN</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {recurring.item_count} recurring item{recurring.item_count !== 1 ? "s" : ""}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "oklch(0.62 0.175 148)" }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Variable</span>
              <span className="text-[11px] text-muted-foreground ml-auto">{varPct.toFixed(0)}%</span>
            </div>
            <p className="text-xl font-semibold tabular-nums">{fmt(variable)} PLN</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">discretionary</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
