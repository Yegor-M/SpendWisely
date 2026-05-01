import { api } from "@/lib/api";
import { InsightsMonthlyChart }  from "@/components/insights/InsightsMonthlyChart";
import { SavingsRateTrendCard }  from "@/components/insights/SavingsRateTrendCard";
import { SpendVelocityCard }     from "@/components/insights/SpendVelocityCard";
import { CategoryDeltasTable }   from "@/components/insights/CategoryDeltasTable";
import { PredictionTable }       from "@/components/insights/PredictionTable";
import { AnomaliesPanel }        from "@/components/insights/AnomaliesPanel";
import { RecurringCostsCard }    from "@/components/insights/RecurringCostsCard";
import { FixedVsVariableCard }   from "@/components/insights/FixedVsVariableCard";
import { DowChart }              from "@/components/insights/DowChart";
import { IncomeSourcesTable }    from "@/components/insights/IncomeSourcesTable";
import { BusinessPersonalSplit } from "@/components/insights/BusinessPersonalSplit";
import { CategoryTrendsTable }   from "@/components/insights/CategoryTrendsTable";
import { TopTransactionsCard }   from "@/components/insights/TopTransactionsCard";

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

export default async function InsightsPage() {
  const [
    summaryRes, monthlyRes,
    velocity, deltas, predict, anomalies,
    dow, businessSplit, incomeSources, categoryTrends,
    recurringSummary, topTransactions,
  ] = await Promise.allSettled([
    api.summary(), api.monthly(),
    api.velocity(), api.deltas(), api.predict(), api.anomalies(),
    api.dow(), api.businessSplit(), api.incomeSources(), api.categoryTrends(),
    api.recurringSummary(), api.topTransactions(10),
  ]);

  const hasSummary   = summaryRes.status === "fulfilled" && Object.keys(summaryRes.value).length > 0;
  const hasMonthly   = monthlyRes.status === "fulfilled" && monthlyRes.value.length > 0;
  const hasRecurring = recurringSummary.status === "fulfilled" && recurringSummary.value.item_count > 0;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground">Your money, broken down</p>
      </div>

      {/* ── THIS MONTH ──────────────────────────────────────────────── */}
      {(velocity.status === "fulfilled" || deltas.status === "fulfilled") && (
        <Section title="This Month" subtitle="How you're tracking right now">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {velocity.status === "fulfilled" && Object.keys(velocity.value).length > 0 && (
              <SpendVelocityCard data={velocity.value} />
            )}
            {deltas.status === "fulfilled" && deltas.value.length > 0 && (
              <CategoryDeltasTable data={deltas.value} />
            )}
          </div>
        </Section>
      )}

      {/* ── STRUCTURAL BASELINE ─────────────────────────────────────── */}
      {(hasRecurring || incomeSources.status === "fulfilled" || businessSplit.status === "fulfilled") && (
        <Section title="Structural Baseline" subtitle="What your normal looks like every month">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasRecurring && (
              <RecurringCostsCard data={recurringSummary.value} />
            )}
            {hasRecurring && hasSummary && (
              <FixedVsVariableCard summary={summaryRes.value} recurring={recurringSummary.value} />
            )}
            {incomeSources.status === "fulfilled" && incomeSources.value.length > 0 && (
              <IncomeSourcesTable data={incomeSources.value} />
            )}
            {businessSplit.status === "fulfilled" && Object.keys(businessSplit.value).length > 0 && (
              <BusinessPersonalSplit data={businessSplit.value} />
            )}
          </div>
        </Section>
      )}

      {/* ── TRENDS ──────────────────────────────────────────────────── */}
      {(hasMonthly || categoryTrends.status === "fulfilled" || predict.status === "fulfilled") && (
        <Section title="Trends" subtitle="Is your situation improving or deteriorating?">
          {hasMonthly && <InsightsMonthlyChart data={monthlyRes.value} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasMonthly && <SavingsRateTrendCard data={monthlyRes.value} />}
            {categoryTrends.status === "fulfilled" && categoryTrends.value.length > 0 && (
              <CategoryTrendsTable data={categoryTrends.value} />
            )}
            {predict.status === "fulfilled" && predict.value.length > 0 && (
              <PredictionTable data={predict.value} />
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
      {(anomalies.status === "fulfilled" || topTransactions.status === "fulfilled") && (
        <Section title="Events & Alerts" subtitle="Unusual or one-off transactions worth reviewing">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {anomalies.status === "fulfilled" && (
              <AnomaliesPanel data={anomalies.value} />
            )}
            {topTransactions.status === "fulfilled" && topTransactions.value.length > 0 && (
              <TopTransactionsCard data={topTransactions.value} />
            )}
          </div>
        </Section>
      )}
    </main>
  );
}
