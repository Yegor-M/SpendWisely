"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Summary } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n) + " PLN";

const pct = (n: number) => n.toFixed(1) + "%";

function healthColor(score: number) {
  if (score >= 75) return "bg-green-100 text-green-800";
  if (score >= 50) return "bg-yellow-100 text-yellow-800";
  if (score >= 30) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

export function SummaryCards({ data }: { data: Summary }) {
  const hasSalary = data.usd_salary_total > 0;
  const incomeSubline = hasSalary
    ? `$${data.usd_salary_total.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD @ ${data.implied_fx_rate.toFixed(2)}`
    : `Avg ${fmt(data.avg_monthly_income)}/mo`;

  const cards = [
    { title: "Total Income",   value: fmt(data.total_income),      sub: incomeSubline },
    { title: "Total Expenses", value: fmt(data.total_expenses),     sub: `Avg ${fmt(data.avg_monthly_expenses)}/mo` },
    { title: "Net Balance",    value: fmt(data.net_balance),        sub: `${data.months_covered} months covered` },
    { title: "Savings Rate",   value: pct(data.savings_rate_pct),   sub: data.net_balance >= 0 ? "On track" : "Spending > income" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </CardContent>
        </Card>
      ))}

      <Card className="col-span-2 md:col-span-4">
        <CardHeader className="pb-2 flex flex-row items-center gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Budget Health</CardTitle>
          <Badge className={healthColor(data.budget_health_score)}>
            {data.budget_health_label} — {data.budget_health_score}/100
          </Badge>
          {data.usd_salary_total > 0 && (
            <Badge className="bg-blue-100 text-blue-800 ml-auto">
              ${data.usd_salary_total.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD salary · {data.implied_fx_rate.toFixed(2)} PLN/USD
            </Badge>
          )}
        </CardHeader>
        <CardContent className="flex gap-6 text-sm">
          <span>{data.transaction_count} transactions</span>
          <span>{data.unique_counterparties} merchants</span>
          <span>Largest expense: {fmt(data.largest_single_expense)}</span>
        </CardContent>
      </Card>
    </div>
  );
}
