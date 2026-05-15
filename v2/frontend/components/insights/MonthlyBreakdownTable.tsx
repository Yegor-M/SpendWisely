"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyBreakdown } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

export function MonthlyBreakdownTable({ data }: { data: MonthlyBreakdown[] }) {
  if (!data.length) return null;
  const reversed = [...data].reverse();

  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle>Monthly Numbers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 font-medium text-muted-foreground">Month</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Income</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Recurring</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Variable</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {reversed.map((row) => (
                <tr key={row.month} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 font-medium tabular-nums">{row.month}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.income > 0 ? fmt(row.income) : "—"}</td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground">{fmt(row.recurring)}</td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground">{fmt(row.variable)}</td>
                  <td
                    className="py-2.5 text-right tabular-nums font-semibold"
                    style={{ color: row.net >= 0 ? "oklch(0.62 0.175 148)" : "oklch(0.56 0.200 25)" }}
                  >
                    {row.net >= 0 ? "+" : ""}{fmt(row.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
