"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IncomeSource } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

export function IncomeSourcesTable({ data }: { data: IncomeSource[] }) {
  const top = data.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Income Sources</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {top.map((src) => (
            <div key={src.counterparty || "unknown"}>
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{src.counterparty || "Unknown"}</span>
                  {src.currency === "USD" && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded shrink-0">USD</span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 text-right ml-2">
                  <span className="text-muted-foreground text-xs">{src.share_pct}%</span>
                  <span className="font-semibold text-green-700">{fmt(src.total_received)} PLN</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${src.share_pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {src.tx_count} payment{src.tx_count !== 1 ? "s" : ""} · avg {fmt(src.avg_per_tx)} PLN
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
