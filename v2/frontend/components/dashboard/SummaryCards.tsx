"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Summary } from "@/lib/api";

const pln = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

export function SummaryCards({ data, monthData }: { data: Summary; monthData?: Summary }) {
  const bal          = monthData ?? data;
  const isPositive   = bal.net_balance >= 0;
  const netUsd       = data.implied_fx_rate > 0 ? bal.net_balance / data.implied_fx_rate : 0;
  const hasSalary    = data.usd_salary_total > 0;
  const balanceColor = isPositive ? "text-emerald-400" : "text-red-400";

  return (
    <div className="space-y-4">
      {/* ── Hero row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Net Balance — dark card, big number */}
        <Card className="md:col-span-1 bg-foreground text-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-[12px] font-semibold uppercase tracking-widest text-background/40">
              Net Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            <p className={`text-5xl font-black tracking-tighter leading-none ${balanceColor}`}>
              {pln(bal.net_balance)}
            </p>
            <p className="text-xl font-semibold tracking-tight text-background/40">
              ≈ ${usd(netUsd)}
            </p>
            <p className="text-[12px] text-background/40 pt-1">
              this month · savings rate{" "}
              <span className={balanceColor}>
                {bal.savings_rate_pct > 0 ? "+" : ""}{bal.savings_rate_pct.toFixed(1)}%
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Income */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
              Income
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-0.5">
            <p className="text-4xl font-black tracking-tighter leading-none" style={{ color: "oklch(0.62 0.175 148)" }}>
              {pln(data.avg_monthly_income)}
            </p>
            <p className="text-[13px] text-muted-foreground font-medium">PLN / month</p>
            <p className="text-[12px] text-muted-foreground pt-2">
              {pln(data.total_income)} PLN total
              {hasSalary && (
                <span className="ml-2">
                  · ${usd(data.usd_salary_total)} USD @ {data.implied_fx_rate.toFixed(2)}
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-0.5">
            <p className="text-4xl font-black tracking-tighter leading-none" style={{ color: "oklch(0.58 0.200 25)" }}>
              {pln(data.avg_monthly_expenses)}
            </p>
            <p className="text-[13px] text-muted-foreground font-medium">PLN / month</p>
            <p className="text-[12px] text-muted-foreground pt-2">
              {pln(data.total_expenses)} PLN total · largest {pln(data.largest_single_expense)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Transactions",   value: data.transaction_count.toLocaleString(), sub: `${data.unique_counterparties} merchants` },
          { label: "Largest expense",value: `${pln(data.largest_single_expense)} PLN`, sub: "single payment" },
          { label: "Largest income", value: `${pln(data.largest_single_income)} PLN`, sub: "single payment" },
          { label: "Budget health",  value: `${data.budget_health_score}/100`, sub: data.budget_health_label },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{s.label}</p>
              <p className="text-lg font-bold tabular-nums">{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
