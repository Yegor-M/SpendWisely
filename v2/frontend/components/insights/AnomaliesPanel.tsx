"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Anomaly } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

export function AnomaliesPanel({ data }: { data: Anomaly[] }) {
  const highSpend = data.filter((a) => a.anomaly_type === "high_spend");
  const dupes = data.filter((a) => a.anomaly_type === "possible_duplicate");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Anomalies
          {data.length > 0 && (
            <Badge className="bg-orange-100 text-orange-800">{data.length} found</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground">No anomalies detected.</p>
        )}

        {highSpend.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Unusually large ({highSpend.length})
            </p>
            <div className="space-y-2">
              {highSpend.slice(0, 8).map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <span className="font-medium truncate block">{a.counterparty || a.title}</span>
                    <span className="text-xs text-muted-foreground">{a.booking_date} · {a.category}</span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="font-semibold text-red-600">{fmt(a.abs_amount)} PLN</span>
                    {a.z_score !== null && (
                      <span className="block text-xs text-muted-foreground">z={a.z_score.toFixed(1)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {dupes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Possible duplicates ({dupes.length})
            </p>
            <div className="space-y-2">
              {dupes.slice(0, 5).map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <span className="font-medium truncate block">{a.counterparty || a.title}</span>
                    <span className="text-xs text-muted-foreground">{a.booking_date}</span>
                  </div>
                  <span className="font-semibold text-orange-600 shrink-0 ml-2">
                    {fmt(a.abs_amount)} PLN
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
