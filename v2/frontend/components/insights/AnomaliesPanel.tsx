"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Anomaly } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

export function AnomaliesPanel({ data }: { data: Anomaly[] }) {
  const highSpend = data.filter((a) => a.anomaly_type === "high_spend");
  const dupes     = data.filter((a) => a.anomaly_type === "possible_duplicate");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Anomalies</CardTitle>
          {data.length > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {data.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground">No anomalies detected.</p>
        )}

        {highSpend.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
              Unusually large ({highSpend.length})
            </p>
            <div className="divide-y divide-border/50">
              {highSpend.slice(0, 8).map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 first:pt-0">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">{a.counterparty || a.title}</p>
                    <p className="text-[11px] text-muted-foreground">{a.booking_date} · {a.category}</p>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="text-[13px] font-semibold tabular-nums" style={{ color: "oklch(0.56 0.200 25)" }}>
                      {fmt(a.abs_amount)} PLN
                    </p>
                    {a.z_score !== null && (
                      <p className="text-[11px] text-muted-foreground">z = {a.z_score.toFixed(1)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {dupes.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
              Possible duplicates ({dupes.length})
            </p>
            <div className="divide-y divide-border/50">
              {dupes.slice(0, 5).map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 first:pt-0">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">{a.counterparty || a.title}</p>
                    <p className="text-[11px] text-muted-foreground">{a.booking_date}</p>
                  </div>
                  <p className="text-[13px] font-semibold tabular-nums ml-4 shrink-0" style={{ color: "oklch(0.70 0.145 90)" }}>
                    {fmt(a.abs_amount)} PLN
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
