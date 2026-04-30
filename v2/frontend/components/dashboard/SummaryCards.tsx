"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Summary } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n) + " PLN";

const pct = (n: number) => (n > 0 ? "+" : "") + n.toFixed(1) + "%";

export function SummaryCards({ data }: { data: Summary }) {
  const isPositive = data.net_balance >= 0;
  const hasSalary = data.usd_salary_total > 0;

  return (
    <div className="space-y-3">
      {/* Hero row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="col-span-2 md:col-span-2 bg-foreground text-background">
          <CardHeader className="pb-1">
            <CardTitle className="text-background/50">Net Balance</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className={`text-4xl font-semibold tracking-tight ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {fmt(data.net_balance)}
            </p>
            <p className="text-sm text-background/50 mt-1.5">
              {data.months_covered} months · savings rate{" "}
              <span className={isPositive ? "text-emerald-400" : "text-red-400"}>
                {pct(data.savings_rate_pct)}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Income</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold tracking-tight">{fmt(data.total_income)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasSalary
                ? `$${data.usd_salary_total.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD @ ${data.implied_fx_rate.toFixed(2)}`
                : `avg ${fmt(data.avg_monthly_income)}/mo`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Expenses</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold tracking-tight">{fmt(data.total_expenses)}</p>
            <p className="text-xs text-muted-foreground mt-1">avg {fmt(data.avg_monthly_expenses)}/mo</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Transactions",    value: data.transaction_count.toLocaleString() },
          { label: "Merchants",       value: data.unique_counterparties.toLocaleString() },
          { label: "Largest expense", value: fmt(data.largest_single_expense) },
          { label: "Budget health",   value: `${data.budget_health_label} · ${data.budget_health_score}/100` },
        ].map((s) => (
          <Card key={s.label} size="sm">
            <CardHeader className="pb-0">
              <CardTitle>{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="pt-1 pb-4">
              <p className="text-base font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
