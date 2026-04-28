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
        <CardTitle className="text-base">
          Category Changes
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {prev_month_label} → {last_month_label}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left pb-2">Category</th>
                <th className="text-right pb-2">{prev_month_label}</th>
                <th className="text-right pb-2">{last_month_label}</th>
                <th className="text-right pb-2">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row) => {
                const isUp = row.delta > 0;
                const isNew = row.prev_month === 0 && row.last_month > 0;
                const isGone = row.last_month === 0 && row.prev_month > 0;
                return (
                  <tr key={row.category} className="text-sm">
                    <td className="py-1.5 font-medium">{row.category}</td>
                    <td className="py-1.5 text-right text-muted-foreground">
                      {row.prev_month > 0 ? fmt(row.prev_month) : "—"}
                    </td>
                    <td className="py-1.5 text-right">
                      {row.last_month > 0 ? fmt(row.last_month) : "—"}
                    </td>
                    <td className={`py-1.5 text-right font-medium ${isUp ? "text-red-600" : "text-green-600"}`}>
                      {isNew ? (
                        <span className="text-orange-500 text-xs">NEW</span>
                      ) : isGone ? (
                        <span className="text-blue-500 text-xs">GONE</span>
                      ) : (
                        <>
                          {isUp ? "▲" : "▼"} {fmt(Math.abs(row.delta))}
                          {row.delta_pct !== null && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({row.delta_pct > 0 ? "+" : ""}{row.delta_pct}%)
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
