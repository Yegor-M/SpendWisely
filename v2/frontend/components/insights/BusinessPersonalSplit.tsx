"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BusinessSplit } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

const COLORS = ["oklch(0.55 0.195 265)", "oklch(0.54 0.190 152)"];

export function BusinessPersonalSplit({ data }: { data: BusinessSplit }) {
  const chartData = [
    { name: "Personal", value: data.personal_expenses },
    { name: "Business", value: data.business_expenses },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business vs Personal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="shrink-0">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={68}
                  dataKey="value"
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(1 0 0)",
                    border: "1px solid oklch(0.908 0.006 75)",
                    borderRadius: "12px",
                    fontSize: 12,
                  }}
                  formatter={(v) => fmt(Number(v)) + " PLN"}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-4">
            {[
              { label: "Personal", pct: data.personal_pct, avg: data.avg_monthly_personal, color: COLORS[0] },
              { label: "Business", pct: data.business_pct, avg: data.avg_monthly_business, color: COLORS[1] },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-[13px] font-medium">{s.label}</span>
                  <span className="text-[12px] text-muted-foreground ml-auto">{s.pct}%</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums" style={{ color: s.color }}>
                  {fmt(s.avg)} <span className="text-sm font-normal text-muted-foreground">PLN/mo</span>
                </p>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Business = {data.business_categories.join(", ")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
