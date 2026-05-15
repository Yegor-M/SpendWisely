"use client";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyBreakdown } from "@/lib/api";

const PLN = (v: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(v) + " PLN";

const RECURRING_COLOR = "oklch(0.55 0.13 255)";
const VARIABLE_COLOR  = "oklch(0.70 0.145 90)";
const INCOME_COLOR    = "oklch(0.62 0.175 148)";
const NET_COLOR       = (v: number) => v >= 0 ? "oklch(0.62 0.175 148)" : "oklch(0.56 0.200 25)";

export function MonthlyBreakdownChart({ data }: { data: MonthlyBreakdown[] }) {
  const formatted = data.map((d) => ({ ...d, month: d.month.slice(2) }));
  const avgNet = data.length > 0 ? data.reduce((s, d) => s + d.net, 0) / data.length : 0;

  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle>Monthly Spend Breakdown</CardTitle>
          <span className="text-xs text-muted-foreground">
            avg net{" "}
            <span className="font-semibold" style={{ color: NET_COLOR(avgNet) }}>
              {avgNet >= 0 ? "+" : ""}{new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(avgNet)} PLN
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={formatted} margin={{ top: 4, right: 40, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="none" vertical={false} stroke="oklch(0.91 0.006 75)" strokeWidth={1} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "oklch(0.50 0.015 255)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "oklch(0.50 0.015 255)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip
              contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.91 0.006 75)", borderRadius: 8, fontSize: 12 }}
              formatter={(value, name) => { const n = String(name); return [PLN(Number(value)), n.charAt(0).toUpperCase() + n.slice(1)]; }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="recurring" name="Recurring" stackId="exp" fill={RECURRING_COLOR} radius={[0, 0, 0, 0]} />
            <Bar dataKey="variable"  name="Variable"  stackId="exp" fill={VARIABLE_COLOR}  radius={[3, 3, 0, 0]} />
            <Line dataKey="income" name="Income" type="monotone" stroke={INCOME_COLOR} strokeWidth={2} dot={{ r: 3, fill: INCOME_COLOR }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
