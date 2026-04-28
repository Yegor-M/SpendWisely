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
        <CardTitle className="text-base">Spending by Day of Week</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="day" tickFormatter={(d) => SHORT[d] ?? d} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1).toFixed(0)}`} />
            <Tooltip
              formatter={(v, name) => [
                new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(Number(v)) + " PLN",
                name === "avg" ? "Avg per tx" : name,
              ]}
            />
            <Bar dataKey="avg" name="avg" radius={[3, 3, 0, 0]}>
              {data.map((d) => (
                <Cell
                  key={d.day}
                  fill={
                    WEEKEND.includes(d.day)
                      ? "#f97316"
                      : d.avg === maxAvg
                      ? "#ef4444"
                      : "#6366f1"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground text-center mt-1">Avg spend per transaction</p>
      </CardContent>
    </Card>
  );
}
