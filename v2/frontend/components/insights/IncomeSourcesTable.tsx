"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IncomeSource } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

export function IncomeSourcesTable({ data }: { data: IncomeSource[] }) {
  const top = data.slice(0, 10).filter((s) => s.total_received > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income Sources</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50">
          {top.map((src) => (
            <div key={src.counterparty || "unknown"} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-medium truncate">{src.counterparty || "Unknown"}</span>
                  {src.currency === "USD" && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      USD
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-[12px] text-muted-foreground">{src.share_pct}%</span>
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: "oklch(0.64 0.170 145)" }}>
                    {fmt(src.total_received)} PLN
                  </span>
                </div>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${src.share_pct}%`,
                    background: "oklch(0.64 0.170 145)",
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {src.tx_count} payment{src.tx_count !== 1 ? "s" : ""} · avg {fmt(src.avg_per_tx)} PLN
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
