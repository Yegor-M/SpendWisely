"use client";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ComposedChart, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyTrend } from "@/lib/api";

const PLN = (v: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(v) + " PLN";

type Props = { data: MonthlyTrend[] };

export function InsightsMonthlyChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    month: d.month.slice(2), // "24-01" style
  }));

  const avgSavingsRate =
    data.length > 0
      ? data.reduce((s, d) => s + d.savings_rate_pct, 0) / data.length
      : 0;

  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle>Monthly P&amp;L</CardTitle>
          <span className="text-xs text-muted-foreground">
            avg savings rate{" "}
            <span
              className="font-semibold"
              style={{
                color:
                  avgSavingsRate >= 20
                    ? "oklch(0.62 0.175 148)"
                    : avgSavingsRate >= 0
                    ? "oklch(0.70 0.145 90)"
                    : "oklch(0.56 0.200 25)",
              }}
            >
              {avgSavingsRate.toFixed(1)}%
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={formatted} margin={{ top: 4, right: 40, left: -8, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="none"
              vertical={false}
              stroke="oklch(0.91 0.006 75)"
              strokeWidth={1}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "oklch(0.50 0.015 255)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="pln"
              tick={{ fontSize: 11, fill: "oklch(0.50 0.015 255)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fontSize: 11, fill: "oklch(0.55 0.195 265)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(1 0 0)",
                border: "1px solid oklch(0.908 0.006 75)",
                borderRadius: "12px",
                boxShadow: "0 4px 16px oklch(0 0 0 / 0.08)",
                fontSize: 13,
              }}
              formatter={(value, name) => {
                const v = Number(value);
                if (name === "Savings %") return [`${v.toFixed(1)}%`, name as string];
                return [PLN(v), name as string];
              }}
              cursor={{ fill: "oklch(0.96 0.004 75)" }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            <ReferenceLine yAxisId="pct" y={0} stroke="oklch(0.75 0.015 255)" strokeDasharray="4 2" />
            <Bar yAxisId="pln" dataKey="income"   fill="oklch(0.62 0.175 148)" name="Income"   radius={[4,4,0,0]} maxBarSize={36} />
            <Bar yAxisId="pln" dataKey="expenses" fill="oklch(0.58 0.200 25)"  name="Expenses" radius={[4,4,0,0]} maxBarSize={36} />
            <Line
              yAxisId="pct"
              dataKey="savings_rate_pct"
              stroke="oklch(0.55 0.195 265)"
              strokeWidth={2}
              dot={{ r: 3, fill: "oklch(0.55 0.195 265)", strokeWidth: 0 }}
              name="Savings %"
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
