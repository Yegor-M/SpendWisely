import { api } from "@/lib/api";
import { FinancialHealthBar }    from "@/components/insights/FinancialHealthBar";
import { InsightsMonthlyChart }  from "@/components/insights/InsightsMonthlyChart";
import { SpendVelocityCard }     from "@/components/insights/SpendVelocityCard";
import { CategoryDeltasTable }   from "@/components/insights/CategoryDeltasTable";
import { PredictionTable }       from "@/components/insights/PredictionTable";
import { AnomaliesPanel }        from "@/components/insights/AnomaliesPanel";
import { RecurringCostsCard }    from "@/components/insights/RecurringCostsCard";
import { DowChart }              from "@/components/insights/DowChart";
import { IncomeSourcesTable }    from "@/components/insights/IncomeSourcesTable";
import { BusinessPersonalSplit } from "@/components/insights/BusinessPersonalSplit";
import { CategoryTrendsTable }   from "@/components/insights/CategoryTrendsTable";
import { TopTransactionsCard }   from "@/components/insights/TopTransactionsCard";

export const dynamic = "force-dynamic";

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

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground">Deep analytics and predictions</p>
      </div>

      {/* Hero: financial health at a glance */}
      {summaryRes.status === "fulfilled" && Object.keys(summaryRes.value).length > 0 && (
        <FinancialHealthBar data={summaryRes.value} />
      )}

      {/* Full-width monthly P&L chart */}
      {monthlyRes.status === "fulfilled" && monthlyRes.value.length > 0 && (
        <div className="grid grid-cols-1">
          <InsightsMonthlyChart data={monthlyRes.value} />
        </div>
      )}

      {/* Current month + category shifts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {velocity.status === "fulfilled" && Object.keys(velocity.value).length > 0 && (
          <SpendVelocityCard data={velocity.value} />
        )}
        {deltas.status === "fulfilled" && deltas.value.length > 0 && (
          <CategoryDeltasTable data={deltas.value} />
        )}
      </div>

      {/* Next month forecast + anomalies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {predict.status === "fulfilled" && predict.value.length > 0 && (
          <PredictionTable data={predict.value} />
        )}
        {anomalies.status === "fulfilled" && (
          <AnomaliesPanel data={anomalies.value} />
        )}
      </div>

      {/* Recurring costs + day-of-week pattern */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recurringSummary.status === "fulfilled" && recurringSummary.value.item_count > 0 && (
          <RecurringCostsCard data={recurringSummary.value} />
        )}
        {dow.status === "fulfilled" && dow.value.length > 0 && (
          <DowChart data={dow.value} />
        )}
      </div>

      {/* Income sources + business vs personal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {incomeSources.status === "fulfilled" && incomeSources.value.length > 0 && (
          <IncomeSourcesTable data={incomeSources.value} />
        )}
        {businessSplit.status === "fulfilled" && Object.keys(businessSplit.value).length > 0 && (
          <BusinessPersonalSplit data={businessSplit.value} />
        )}
      </div>

      {/* Category trends + biggest expenses ever */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categoryTrends.status === "fulfilled" && categoryTrends.value.length > 0 && (
          <CategoryTrendsTable data={categoryTrends.value} />
        )}
        {topTransactions.status === "fulfilled" && topTransactions.value.length > 0 && (
          <TopTransactionsCard data={topTransactions.value} />
        )}
      </div>
    </main>
  );
}
