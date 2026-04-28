import { api } from "@/lib/api";
import Link from "next/link";
import { SpendVelocityCard } from "@/components/insights/SpendVelocityCard";
import { CategoryDeltasTable } from "@/components/insights/CategoryDeltasTable";
import { PredictionTable } from "@/components/insights/PredictionTable";
import { AnomaliesPanel } from "@/components/insights/AnomaliesPanel";
import { DowChart } from "@/components/insights/DowChart";
import { BusinessPersonalSplit } from "@/components/insights/BusinessPersonalSplit";
import { IncomeSourcesTable } from "@/components/insights/IncomeSourcesTable";
import { CategoryTrendsTable } from "@/components/insights/CategoryTrendsTable";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const [
    velocity,
    deltas,
    predict,
    anomalies,
    dow,
    businessSplit,
    incomeSources,
    categoryTrends,
  ] = await Promise.allSettled([
    api.velocity(),
    api.deltas(),
    api.predict(),
    api.anomalies(),
    api.dow(),
    api.businessSplit(),
    api.incomeSources(),
    api.categoryTrends(),
  ]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Insights</h1>
          <p className="text-muted-foreground text-sm">Deep analytics and predictions</p>
        </div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Dashboard
        </Link>
      </div>

      {/* This Month + Deltas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {velocity.status === "fulfilled" && Object.keys(velocity.value).length > 0 && (
          <SpendVelocityCard data={velocity.value} />
        )}
        {deltas.status === "fulfilled" && deltas.value.length > 0 && (
          <CategoryDeltasTable data={deltas.value} />
        )}
      </div>

      {/* Predictions + Anomalies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {predict.status === "fulfilled" && predict.value.length > 0 && (
          <PredictionTable data={predict.value} />
        )}
        {anomalies.status === "fulfilled" && (
          <AnomaliesPanel data={anomalies.value} />
        )}
      </div>

      {/* Patterns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dow.status === "fulfilled" && dow.value.length > 0 && (
          <DowChart data={dow.value} />
        )}
        {businessSplit.status === "fulfilled" && Object.keys(businessSplit.value).length > 0 && (
          <BusinessPersonalSplit data={businessSplit.value} />
        )}
      </div>

      {/* Income + Category Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {incomeSources.status === "fulfilled" && incomeSources.value.length > 0 && (
          <IncomeSourcesTable data={incomeSources.value} />
        )}
        {categoryTrends.status === "fulfilled" && categoryTrends.value.length > 0 && (
          <CategoryTrendsTable data={categoryTrends.value} />
        )}
      </div>
    </main>
  );
}
