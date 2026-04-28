"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryBreakdown } from "@/lib/api";

const COLORS = [
  "#6366f1","#22c55e","#ef4444","#f59e0b","#3b82f6",
  "#ec4899","#14b8a6","#f97316","#8b5cf6","#84cc16",
  "#06b6d4","#e11d48","#a3e635","#fb923c","#7c3aed",
];

export function CategoryPie({ data }: { data: CategoryBreakdown[] }) {
  const top = data.slice(0, 10);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={top}
              dataKey="total_spent"
              nameKey="category"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, percent }) => `${((percent ?? 0) * 100).toFixed(1)}%`}
              labelLine={false}
            >
              {top.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              formatter={(v) =>
                new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(Number(v)) + " PLN"
              }
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
