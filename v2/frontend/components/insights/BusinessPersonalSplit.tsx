"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BusinessSplit } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

export function BusinessPersonalSplit({ data }: { data: BusinessSplit }) {
  const chartData = [
    { name: "Personal", value: data.personal_expenses, pct: data.personal_pct },
    { name: "Business", value: data.business_expenses, pct: data.business_pct },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Business vs Personal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              dataKey="value"
              paddingAngle={3}
            >
              <Cell fill="#6366f1" />
              <Cell fill="#f97316" />
            </Pie>
            <Tooltip
              formatter={(v) => fmt(Number(v)) + " PLN"}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-indigo-50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Personal / mo</p>
            <p className="font-bold text-indigo-700">{fmt(data.avg_monthly_personal)} PLN</p>
            <p className="text-xs text-muted-foreground">{data.personal_pct}%</p>
          </div>
          <div className="rounded-lg bg-orange-50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Business / mo</p>
            <p className="font-bold text-orange-700">{fmt(data.avg_monthly_business)} PLN</p>
            <p className="text-xs text-muted-foreground">{data.business_pct}%</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Business = {data.business_categories.join(", ")}
        </p>
      </CardContent>
    </Card>
  );
}
