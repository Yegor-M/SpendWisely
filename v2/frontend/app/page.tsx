import { api } from "@/lib/api";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { MonthlyChart } from "@/components/dashboard/MonthlyChart";
import { CategoryPie } from "@/components/dashboard/CategoryPie";
import { RecurringList } from "@/components/dashboard/RecurringList";
import { TopMerchants } from "@/components/dashboard/TopMerchants";
import { UploadCsv } from "@/components/UploadCsv";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [summary, monthly, categories, merchants, recurring] = await Promise.allSettled([
    api.summary(),
    api.monthly(),
    api.categories(),
    api.merchants(10),
    api.recurring(),
  ]);

  const hasSummary =
    summary.status === "fulfilled" &&
    (summary.value as { transaction_count: number })?.transaction_count > 0;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {!hasSummary ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">No data yet</h2>
            <p className="text-muted-foreground text-sm">Upload a Pekao bank CSV to get started.</p>
          </div>
          <UploadCsv />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
              <p className="text-sm text-muted-foreground">Your financial snapshot</p>
            </div>
            <UploadCsv />
          </div>

          {summary.status === "fulfilled" && (
            <SummaryCards data={summary.value} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {monthly.status === "fulfilled" && <MonthlyChart data={monthly.value} />}
            {categories.status === "fulfilled" && <CategoryPie data={categories.value} />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {merchants.status === "fulfilled" && <TopMerchants data={merchants.value} />}
            {recurring.status === "fulfilled" && <RecurringList data={recurring.value} />}
          </div>
        </>
      )}
    </main>
  );
}
