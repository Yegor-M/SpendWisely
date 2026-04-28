"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyTrend } from "@/lib/api";

export function MonthlyChart({ data }: { data: MonthlyTrend[] }) {
  const formatted = data.map((d) => ({
    ...d,
    month: d.month.slice(2), // "2026-02" → "26-02"
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly Cash Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={formatted} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(v) =>
                new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(Number(v)) + " PLN"
              }
            />
            <Legend />
            <Bar dataKey="income"   fill="#22c55e" name="Income"   radius={[3,3,0,0]} />
            <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[3,3,0,0]} />
            <Line dataKey="savings" stroke="#6366f1" strokeWidth={2} dot={false} name="Savings" />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
