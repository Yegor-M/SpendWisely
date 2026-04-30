"use client";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyTrend } from "@/lib/api";

const PLN = (v: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(v) + " PLN";

export function MonthlyChart({ data }: { data: MonthlyTrend[] }) {
  const formatted = data.map((d) => ({ ...d, month: d.month.slice(2) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Cash Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={formatted} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
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
              tick={{ fontSize: 11, fill: "oklch(0.50 0.015 255)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(1 0 0)",
                border: "1px solid oklch(0.908 0.006 75)",
                borderRadius: "12px",
                boxShadow: "0 4px 16px oklch(0 0 0 / 0.08)",
                fontSize: 13,
              }}
              formatter={(v) => PLN(Number(v))}
              cursor={{ fill: "oklch(0.96 0.004 75)" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            />
            <Bar dataKey="income"   fill="oklch(0.64 0.170 145)" name="Income"   radius={[4,4,0,0]} maxBarSize={40} />
            <Bar dataKey="expenses" fill="oklch(0.62 0.155 38)"  name="Expenses" radius={[4,4,0,0]} maxBarSize={40} />
            <Line
              dataKey="savings"
              stroke="oklch(0.55 0.195 265)"
              strokeWidth={2}
              dot={{ r: 3, fill: "oklch(0.55 0.195 265)", strokeWidth: 0 }}
              name="Savings"
              type="monotone"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
