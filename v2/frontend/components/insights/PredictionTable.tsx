"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Prediction } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

const confidenceDot: Record<string, string> = {
  high:   "oklch(0.64 0.170 145)",
  medium: "oklch(0.70 0.145 90)",
  low:    "oklch(0.50 0.015 255)",
  "—":    "oklch(0.62 0.155 38)",
};

export function PredictionTable({ data }: { data: Prediction[] }) {
  const total = data.find((r) => r.category === "TOTAL");
  const rows  = data.filter((r) => r.category !== "TOTAL").slice(0, 12);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Next Month Forecast</CardTitle>
          {total && (
            <span className="text-lg font-semibold tabular-nums">{fmt(total.predicted_spend)} PLN</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50">
          {rows.map((row) => (
            <div key={row.category} className="flex items-center py-2.5 first:pt-0 last:pb-0 gap-3">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: confidenceDot[row.confidence] ?? confidenceDot.low }}
              />
              <span className="flex-1 text-[13px] font-medium truncate">{row.category}</span>
              <span className="text-[12px] text-muted-foreground tabular-nums">
                avg {fmt(row.avg_historical)}
              </span>
              <span className="text-[13px] font-semibold tabular-nums w-20 text-right">
                {fmt(row.predicted_spend)}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-4">
          Dot color: <span style={{ color: confidenceDot.high }}>●</span> high ·{" "}
          <span style={{ color: confidenceDot.medium }}>●</span> medium ·{" "}
          <span style={{ color: confidenceDot.low }}>●</span> low confidence
        </p>
      </CardContent>
    </Card>
  );
}
