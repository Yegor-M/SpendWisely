import { api } from "@/lib/api";
import { Suspense } from "react";
import { PeriodSelector }            from "@/components/insights/PeriodSelector";
import { LifestyleInflationCard }    from "@/components/insights/LifestyleInflationCard";
import { CategoryDeltasTable }       from "@/components/insights/CategoryDeltasTable";
import { NewMerchantsCard }          from "@/components/insights/NewMerchantsCard";
import { RecurringCostsCard }        from "@/components/insights/RecurringCostsCard";
import { DowChart }                  from "@/components/insights/DowChart";
import { CategoryTrendsTable }       from "@/components/insights/CategoryTrendsTable";
import { TopTransactionsCard }       from "@/components/insights/TopTransactionsCard";
import { MonthlyBreakdownChart }     from "@/components/insights/MonthlyBreakdownChart";
import { MonthlyBreakdownTable }     from "@/components/insights/MonthlyBreakdownTable";

export const dynamic = "force-dynamic";

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
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

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const period = params.period ?? "all";
  const months =
    period === "1m" ? 1 :
    period === "3m" ? 3 :
    period === "6m" ? 6 :
    undefined;

  const [
    summaryRes, monthlyRes,
    deltas, dow, categoryTrends,
    recurringSummary, topTransactions, newMerchants,
    breakdownRes,
  ] = await Promise.allSettled([
    api.summary(months), api.monthly(months),
    api.deltas(), api.dow(months), api.categoryTrends(months),
    api.recurringSummary(months), api.topTransactions(10, months),
    api.newMerchants(),
    api.monthlyBreakdown(months),
  ]);

  const hasSummary   = summaryRes.status   === "fulfilled" && Object.keys(summaryRes.value).length > 0;
  const hasMonthly   = monthlyRes.status   === "fulfilled" && monthlyRes.value.length > 0;
  const hasRecurring = recurringSummary.status === "fulfilled" && recurringSummary.value.item_count > 0;
  const hasBreakdown = breakdownRes.status === "fulfilled" && breakdownRes.value.length > 0;

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground">Your money, broken down</p>
        </div>
        <Suspense>
          <PeriodSelector />
        </Suspense>
      </div>

      {/* ── STRUCTURAL BASELINE ─────────────────────────────────────── */}
      {hasRecurring && (
        <Section title="Structural Baseline" subtitle="What your normal looks like every month">
          <RecurringCostsCard
            data={recurringSummary.value}
            summary={hasSummary ? summaryRes.value : undefined}
          />
        </Section>
      )}

      {/* ── MONTHLY BREAKDOWN ───────────────────────────────────────── */}
      {hasBreakdown && (
        <Section title="Monthly Breakdown" subtitle="Where does your money go each month?">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MonthlyBreakdownChart data={breakdownRes.value} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MonthlyBreakdownTable data={breakdownRes.value} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasMonthly && <LifestyleInflationCard data={monthlyRes.value} />}
            {deltas.status === "fulfilled" && deltas.value.length > 0 && (
              <CategoryDeltasTable data={deltas.value} />
            )}
            {categoryTrends.status === "fulfilled" && categoryTrends.value.length > 0 && (
              <CategoryTrendsTable data={categoryTrends.value} />
            )}
          </div>
        </Section>
      )}

      {/* ── BEHAVIORAL PATTERNS ─────────────────────────────────────── */}
      {dow.status === "fulfilled" && dow.value.length > 0 && (
        <Section title="Behavioral Patterns" subtitle="When and how you spend">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DowChart data={dow.value} />
          </div>
        </Section>
      )}

      {/* ── EVENTS & ALERTS ─────────────────────────────────────────── */}
      {(topTransactions.status === "fulfilled" || newMerchants.status === "fulfilled") && (
        <Section title="Events & Alerts" subtitle="Unusual, notable, or one-off transactions worth reviewing">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topTransactions.status === "fulfilled" && topTransactions.value.length > 0 && (
              <TopTransactionsCard data={topTransactions.value} />
            )}
            {newMerchants.status === "fulfilled" && newMerchants.value.length > 0 && (
              <NewMerchantsCard data={newMerchants.value} />
            )}
          </div>
        </Section>
      )}
    </main>
  );
}
