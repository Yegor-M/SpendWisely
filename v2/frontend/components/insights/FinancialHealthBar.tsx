"use client";
import { Card, CardContent } from "@/components/ui/card";
import type { Summary } from "@/lib/api";

const pln = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

const healthColor = (score: number) =>
  score >= 75 ? "oklch(0.62 0.175 148)"
  : score >= 50 ? "oklch(0.70 0.145 90)"
  : score >= 30 ? "oklch(0.65 0.200 50)"
  : "oklch(0.56 0.200 25)";

const savingsColor = (rate: number) =>
  rate >= 30 ? "oklch(0.62 0.175 148)"
  : rate >= 10 ? "oklch(0.70 0.145 90)"
  : "oklch(0.56 0.200 25)";

type StatProps = {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  hero?: boolean;
};

function Stat({ label, value, sub, color, hero }: StatProps) {
  return (
    <div className={`flex flex-col gap-1 ${hero ? "col-span-2" : ""}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`${hero ? "text-3xl" : "text-xl"} font-semibold tabular-nums tracking-tight`}
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-[12px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function FinancialHealthBar({ data }: { data: Summary }) {
  const netPositive = data.net_balance >= 0;
  const runway = data.avg_monthly_expenses > 0
    ? Math.round(data.net_balance / data.avg_monthly_expenses)
    : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
          <Stat
            label="Net Balance"
            value={`${pln(data.net_balance)} PLN`}
            sub={`over ${data.months_covered} months`}
            color={netPositive ? "oklch(0.62 0.175 148)" : "oklch(0.56 0.200 25)"}
          />
          <Stat
            label="Savings Rate"
            value={`${data.savings_rate_pct.toFixed(1)}%`}
            sub={`avg ${pln(data.avg_monthly_income)} PLN/mo income`}
            color={savingsColor(data.savings_rate_pct)}
          />
          <Stat
            label="Budget Health"
            value={`${data.budget_health_score}/100`}
            sub={data.budget_health_label}
            color={healthColor(data.budget_health_score)}
          />
          <Stat
            label="Monthly Burn"
            value={`${pln(data.avg_monthly_expenses)} PLN`}
            sub={runway !== null ? `${runway >= 0 ? runway : "∞"} months runway` : undefined}
          />
        </div>
      </CardContent>
    </Card>
  );
}
