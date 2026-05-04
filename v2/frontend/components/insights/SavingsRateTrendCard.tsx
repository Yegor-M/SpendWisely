"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyTrend } from "@/lib/api";

type Props = { data: MonthlyTrend[] };

export function SavingsRateTrendCard({ data }: Props) {
  // Exclude months with no income — they produce a misleading 0% rate
  const valid = data.filter((d) => d.income > 0);
  const formatted = valid.map((d) => ({ month: d.month.slice(2), rate: d.savings_rate_pct }));
  const avg = valid.length > 0 ? valid.reduce((s, d) => s + d.savings_rate_pct, 0) / valid.length : 0;
  const latest = valid[valid.length - 1]?.savings_rate_pct ?? 0;
  const direction = latest > avg + 2 ? "up" : latest < avg - 2 ? "down" : "flat";

  const dirColor =
    direction === "up"   ? "oklch(0.62 0.175 148)"
    : direction === "down" ? "oklch(0.56 0.200 25)"
    : "oklch(0.50 0.015 255)";

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle>Savings Rate</CardTitle>
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums" style={{ color: dirColor }}>
              {latest.toFixed(1)}%
            </p>
            <p className="text-[11px] text-muted-foreground">avg {avg.toFixed(1)}% / mo</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={formatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
              tickFormatter={(v) => `${v.toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(1 0 0)",
                border: "1px solid oklch(0.908 0.006 75)",
                borderRadius: "12px",
                boxShadow: "0 4px 16px oklch(0 0 0 / 0.08)",
                fontSize: 13,
              }}
              formatter={(v) => [`${Number(v).toFixed(1)}%`, "Savings rate"]}
              cursor={{ stroke: "oklch(0.85 0.006 75)" }}
            />
            {/* zero line */}
            <ReferenceLine y={0} stroke="oklch(0.56 0.200 25)" strokeDasharray="4 2" strokeWidth={1} />
            {/* avg line */}
            <ReferenceLine
              y={avg}
              stroke="oklch(0.75 0.015 255)"
              strokeDasharray="4 2"
              strokeWidth={1}
              label={{ value: "avg", position: "right", fontSize: 10, fill: "oklch(0.60 0.015 255)" }}
            />
            <Line
              dataKey="rate"
              stroke={dirColor}
              strokeWidth={2}
              dot={{ r: 3, fill: dirColor, strokeWidth: 0 }}
              type="monotone"
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
