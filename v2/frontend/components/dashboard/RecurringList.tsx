"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Recurring } from "@/lib/api";

export function RecurringList({ data }: { data: Recurring[] }) {
  const monthly = data.filter((r) => r.period === "Monthly" && r.regularity >= 0.8);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Regular Subscriptions & Bills
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({monthly.length} monthly)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {monthly.slice(0, 12).map((r) => (
            <div key={`${r.counterparty}-${r.amount}`} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate font-medium">{r.counterparty}</span>
                <Badge variant="secondary" className="text-xs shrink-0">{r.category}</Badge>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="text-muted-foreground text-xs">
                  {(r.regularity * 100).toFixed(0)}% regular
                </span>
                <span className="font-semibold">
                  {new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(r.amount)} PLN
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
