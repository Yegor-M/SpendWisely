"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Merchant } from "@/lib/api";

export function TopMerchants({ data }: { data: Merchant[] }) {
  const max = data[0]?.total ?? 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Merchants</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.slice(0, 10).map((m) => (
            <div key={m.counterparty} className="flex items-center gap-3">
              <div className="w-32 truncate text-sm font-medium shrink-0">{m.counterparty || "(blank)"}</div>
              <div className="flex-1 h-2 bg-muted rounded">
                <div
                  className="h-2 bg-violet-500 rounded"
                  style={{ width: `${(m.total / max) * 100}%` }}
                />
              </div>
              <span className="text-sm tabular-nums w-20 text-right">
                {new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(m.total)} PLN
              </span>
              <span className="text-xs text-muted-foreground w-8 text-right">×{m.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
