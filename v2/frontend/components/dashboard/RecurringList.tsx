"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Recurring } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

export function RecurringList({ data }: { data: Recurring[] }) {
  const monthly = data.filter((r) => r.period === "Monthly" && r.regularity >= 0.8);
  const total = monthly.reduce((s, r) => s + r.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Regular Bills
          <span className="ml-2 normal-case font-normal text-muted-foreground">
            {monthly.length} monthly · {fmt(total)} PLN/mo
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50">
          {monthly.slice(0, 12).map((r) => (
            <div
              key={`${r.counterparty}-${r.amount}`}
              className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">{r.counterparty}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{r.category}</p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-[13px] font-semibold tabular-nums">{fmt(r.amount)} PLN</p>
                <p className="text-[11px] text-muted-foreground">
                  {(r.regularity * 100).toFixed(0)}% regular
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
