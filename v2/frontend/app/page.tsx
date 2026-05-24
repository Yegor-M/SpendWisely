import { Suspense } from "react";
import { api } from "@/lib/api";
import { SummaryCards }   from "@/components/dashboard/SummaryCards";
import { MonthlyChart }   from "@/components/dashboard/MonthlyChart";
import { CategoryPie }    from "@/components/dashboard/CategoryPie";
import { RecurringList }  from "@/components/dashboard/RecurringList";
import { TopMerchants }   from "@/components/dashboard/TopMerchants";
import { DashboardTabs }      from "@/components/dashboard/DashboardTabs";
import { EarnTab }            from "@/components/dashboard/EarnTab";
import { DailySpendChart }    from "@/components/dashboard/DailySpendChart";
import { UploadCsv }      from "@/components/UploadCsv";
import { DeleteAllTransactions } from "@/components/DeleteAllTransactions";
import { PeriodSelector } from "@/components/insights/PeriodSelector";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const tab    = params.tab    ?? "overview";
  const period = params.period ?? "all";
  const months =
    period === "1m" ? 1 :
    period === "3m" ? 3 :
    period === "6m" ? 6 :
    undefined;

  const [summary, currentMonth, monthly, categories, merchants, recurring] = await Promise.allSettled([
    api.summary(months),
    api.summary(1),
    api.monthly(months),
    api.categories(months),
    api.merchants(10, months),
    api.recurring(months),
  ]);

  const hasSummary =
    summary.status === "fulfilled" &&
    (summary.value as { transaction_count: number })?.transaction_count > 0;

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {!hasSummary ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">No data yet</h2>
            <p className="text-muted-foreground text-sm">Upload your bank CSV or XLSX to get started.</p>
          </div>
          <UploadCsv />
        </div>
      ) : (
        <>
          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
              <p className="text-sm text-muted-foreground">Your financial snapshot</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Suspense><DashboardTabs /></Suspense>
              {tab === "overview" && (
                <Suspense><PeriodSelector /></Suspense>
              )}
              <DeleteAllTransactions />
              <UploadCsv />
            </div>
          </div>

          {/* ── Summary cards (always visible) ─────────────────────── */}
          {summary.status === "fulfilled" && (
            <SummaryCards
              data={summary.value}
              monthData={currentMonth.status === "fulfilled" ? currentMonth.value : undefined}
            />
          )}

          {/* ── Overview tab ───────────────────────────────────────── */}
          {tab === "overview" && (
            <>
              <DailySpendChart />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {monthly.status    === "fulfilled" && <MonthlyChart data={monthly.value} />}
                {categories.status === "fulfilled" && <CategoryPie  data={categories.value} />}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {merchants.status  === "fulfilled" && <TopMerchants data={merchants.value} />}
                {recurring.status  === "fulfilled" && <RecurringList data={recurring.value} />}
              </div>
            </>
          )}

          {/* ── Earn tab ───────────────────────────────────────────── */}
          {tab === "earn" && <EarnTab />}
        </>
      )}
    </main>
  );
}
