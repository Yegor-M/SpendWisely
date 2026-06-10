"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Summary } from "@/lib/api";

const pln = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

export function SummaryCards({ data, periodLabel }: { data: Summary; periodLabel?: string }) {
  const isPositive   = data.net_balance >= 0;
  const netUsd       = data.implied_fx_rate > 0 ? data.net_balance / data.implied_fx_rate : 0;
  const hasSalary    = data.usd_salary_total > 0;
  const balanceColor = isPositive ? "text-emerald-400" : "text-red-400";

  return (
    <div className="space-y-4">
      {/* ── Hero row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Net Balance */}
        <Card className="md:col-span-1 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
          <CardHeader className="pb-2">
            <CardTitle className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
              Net Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            <p className={`font-mono text-4xl font-normal tracking-tight leading-none ${balanceColor}`}>
              {pln(data.net_balance)}
            </p>
            <p className="text-xl font-semibold tracking-tight text-muted-foreground">
              ≈ ${usd(netUsd)}
            </p>
            <p className="text-[12px] text-muted-foreground pt-1">
              {periodLabel ?? "all time"} · savings rate{" "}
              <span className={balanceColor}>
                {data.savings_rate_pct > 0 ? "+" : ""}{data.savings_rate_pct.toFixed(1)}%
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Income */}
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both delay-75">
          <CardHeader className="pb-2">
            <CardTitle className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
              Income
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-0.5">
            <p className="font-mono text-4xl font-normal tracking-tight leading-none" style={{ color: "oklch(0.62 0.175 148)" }}>
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
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both delay-150">
          <CardHeader className="pb-2">
            <CardTitle className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-0.5">
            <p className="font-mono text-4xl font-normal tracking-tight leading-none" style={{ color: "oklch(0.58 0.200 25)" }}>
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
      <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both delay-200">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              { label: "Transactions",   value: data.transaction_count.toLocaleString(), sub: `${data.unique_counterparties} merchants` },
              { label: "Largest expense",value: `${pln(data.largest_single_expense)} PLN`, sub: "single payment" },
              { label: "Largest income", value: `${pln(data.largest_single_income)} PLN`, sub: "single payment" },
              { label: "Budget health",  value: `${data.budget_health_score}/100`, sub: data.budget_health_label },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`px-4 py-4 border-border/50 ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t" : ""} md:border-t-0 ${i !== 0 ? "md:border-l" : ""}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{s.label}</p>
                <p className="text-lg font-medium tabular-nums">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
