import { api } from "@/lib/api";
import { Suspense } from "react";
import { SpendVelocityCard }  from "@/components/insights/SpendVelocityCard";
import { PredictionTable }    from "@/components/insights/PredictionTable";
import { ThisMonthChecklist } from "@/components/plan/ThisMonthChecklist";

export const dynamic = "force-dynamic";

function Section({ title, subtitle, children }: {
  title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
        <span className="text-[12px] text-muted-foreground/60">{subtitle}</span>
        <div className="flex-1 h-px bg-border/60 ml-1" />
      </div>
      {children}
    </section>
  );
}

export default async function PlanPage() {
  const [velocityRes, thisMonthRes, predictRes] = await Promise.allSettled([
    api.velocity(),
    api.thisMonthTx(),
    api.predict(),
  ]);

  const hasVelocity   = velocityRes.status   === "fulfilled" && velocityRes.value.has_current_data;
  const hasThisMonth  = thisMonthRes.status  === "fulfilled";
  const hasPredict    = predictRes.status    === "fulfilled" && predictRes.value.length > 0;

  const velocity = velocityRes.status === "fulfilled" ? velocityRes.value : null;
  const monthLabel = velocity?.current_month
    ? new Date(velocity.current_month + "-01").toLocaleString("en-US", { month: "long", year: "numeric" })
    : null;
  const daysLeft = velocity ? velocity.days_in_month - velocity.days_elapsed : null;

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Plan{monthLabel ? ` · ${monthLabel}` : ""}
          </h1>
          {velocity && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Day {velocity.days_elapsed} of {velocity.days_in_month}
              {daysLeft !== null && daysLeft > 0 && ` · ${daysLeft} days left`}
              {velocity.vs_avg_pct !== null && (
                <span
                  className="ml-2 font-medium"
                  style={{ color: velocity.vs_avg_pct > 10 ? "oklch(0.58 0.200 25)" : "oklch(0.52 0.185 155)" }}
                >
                  {velocity.vs_avg_pct > 0 ? "+" : ""}{Math.round(velocity.vs_avg_pct)}% vs avg pace
                </span>
              )}
            </p>
          )}
        </div>
        {velocity && (
          <div className="flex items-center gap-2">
            <div className="h-2 rounded-full bg-muted overflow-hidden w-32">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(Math.round(velocity.day_pct), 100)}%`,
                  background: "oklch(0.62 0.175 148)",
                }}
              />
            </div>
            <span className="text-[12px] text-muted-foreground tabular-nums">
              {Math.round(velocity.day_pct)}% of month
            </span>
          </div>
        )}
      </div>

      {/* ── THIS MONTH ──────────────────────────────────────────────── */}
      {(hasVelocity || hasThisMonth) && (
        <Section title="This Month" subtitle="Recurring vs other spending, and your pace">
          {hasVelocity && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SpendVelocityCard data={velocityRes.value} />
              {hasThisMonth && (
                <div className="rounded-xl border border-border/50 bg-muted/30 px-5 py-4 flex flex-col gap-2 justify-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Breakdown</p>
                  {(() => {
                    const d = thisMonthRes.value;
                    const fmt = (n: number) => new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);
                    const incomeReceived = d.income > 0;
                    const rows = [
                      incomeReceived
                        ? { label: "Salary received",  value: d.income,             color: "oklch(0.44 0.165 158)", prefix: "" }
                        : { label: "Salary expected",  value: d.income_expected,    color: "oklch(0.70 0.145 90)",  prefix: "~" },
                      { label: "Bills paid",           value: d.fixed_paid,         color: "oklch(0.44 0.165 158)", prefix: "" },
                      { label: "Bills expected",       value: d.fixed_expected,     color: "oklch(0.70 0.145 90)",  prefix: "" },
                      { label: "Daily & other",        value: d.habit_paid + d.other_paid, color: "oklch(0.55 0.195 265)", prefix: "" },
                    ];
                    const income = incomeReceived ? d.income : d.income_expected;
                    const net = income - d.fixed_paid - d.habit_paid - d.other_paid - d.fixed_expected - d.habit_expected;
                    const isNeg = net < 0;
                    return (
                      <>
                        {rows.map(({ label, value, color, prefix }) => (
                          <div key={label} className="flex items-center justify-between gap-3">
                            <span className="text-[12px] text-muted-foreground">{label}</span>
                            <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
                              {prefix}{fmt(value)} PLN
                            </span>
                          </div>
                        ))}
                        <div className="h-px bg-border/50 my-1" />
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[12px] font-semibold">Net left to allocate</span>
                          <span className="text-[15px] font-bold tabular-nums"
                            style={{ color: isNeg ? "oklch(0.58 0.200 25)" : "oklch(0.52 0.185 155)" }}>
                            {net >= 0 ? "+" : ""}{fmt(net)} PLN
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
          {hasThisMonth && (
            <ThisMonthChecklist data={thisMonthRes.value} />
          )}
        </Section>
      )}

      {/* ── NEXT MONTH FORECAST ─────────────────────────────────────── */}
      {hasPredict && (
        <Section title="Next Month Forecast" subtitle="Predicted spend by category based on your history">
          <PredictionTable data={predictRes.value} />
        </Section>
      )}
    </main>
  );
}
