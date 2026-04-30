"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DowPattern } from "@/lib/api";

const WEEKEND = ["Saturday", "Sunday"];
const SHORT: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
  Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

export function DowChart({ data }: { data: DowPattern[] }) {
  const maxAvg = Math.max(...data.map((d) => d.avg));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Day of Week</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="none" vertical={false} stroke="oklch(0.91 0.006 75)" strokeWidth={1} />
            <XAxis
              dataKey="day"
              tickFormatter={(d) => SHORT[d] ?? d}
              tick={{ fontSize: 11, fill: "oklch(0.50 0.015 255)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "oklch(0.50 0.015 255)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1).toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(1 0 0)",
                border: "1px solid oklch(0.908 0.006 75)",
                borderRadius: "12px",
                boxShadow: "0 4px 16px oklch(0 0 0 / 0.08)",
                fontSize: 12,
              }}
              formatter={(v) => [
                new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(Number(v)) + " PLN",
                "Avg per tx",
              ]}
              cursor={{ fill: "oklch(0.96 0.004 75)" }}
            />
            <Bar dataKey="avg" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {data.map((d) => (
                <Cell
                  key={d.day}
                  fill={
                    WEEKEND.includes(d.day)
                      ? "oklch(0.62 0.155 38)"
                      : d.avg === maxAvg
                      ? "oklch(0.56 0.200 25)"
                      : "oklch(0.55 0.195 265)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          Avg spend per transaction · <span style={{ color: "oklch(0.62 0.155 38)" }}>■</span> weekend · <span style={{ color: "oklch(0.56 0.200 25)" }}>■</span> peak
        </p>
      </CardContent>
    </Card>
  );
}
