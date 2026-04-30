"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryDelta } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

export function CategoryDeltasTable({ data }: { data: CategoryDelta[] }) {
  if (!data.length) return null;
  const { last_month_label, prev_month_label } = data[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Changes · {prev_month_label} → {last_month_label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50">
          {data.map((row) => {
            const isUp   = row.delta > 0;
            const isNew  = row.prev_month === 0 && row.last_month > 0;
            const isGone = row.last_month === 0 && row.prev_month > 0;
            return (
              <div key={row.category} className="flex items-center py-2.5 first:pt-0 last:pb-0 gap-3">
                <span className="flex-1 text-[13px] font-medium truncate">{row.category}</span>
                <span className="text-[12px] text-muted-foreground tabular-nums w-20 text-right">
                  {row.prev_month > 0 ? fmt(row.prev_month) : "—"}
                </span>
                <span className="text-[13px] tabular-nums w-20 text-right">
                  {row.last_month > 0 ? fmt(row.last_month) : "—"}
                </span>
                <span
                  className="text-[12px] font-semibold tabular-nums w-24 text-right"
                  style={{
                    color: isNew ? "oklch(0.70 0.145 90)"
                      : isGone ? "oklch(0.55 0.195 265)"
                      : isUp   ? "oklch(0.56 0.200 25)"
                      :          "oklch(0.64 0.170 145)",
                  }}
                >
                  {isNew  ? "NEW" : isGone ? "GONE" : `${isUp ? "+" : ""}${fmt(row.delta)}`}
                  {!isNew && !isGone && row.delta_pct !== null && (
                    <span className="ml-1 opacity-60 font-normal">
                      {row.delta_pct > 0 ? "+" : ""}{row.delta_pct}%
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
