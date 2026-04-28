import Link from "next/link";
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
    summary.status === "fulfilled" && (summary.value as { transaction_count: number })?.transaction_count > 0;

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SpendWisely</h1>
          <p className="text-muted-foreground text-sm">Personal finance tracker</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/insights"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Insights →
          </Link>
          <UploadCsv />
        </div>
      </div>

      {!hasSummary ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p className="text-lg">No data yet.</p>
          <p className="text-sm mt-1">Upload a Pekao bank CSV to get started.</p>
        </div>
      ) : (
        <>
          <SummaryCards data={(summary as { status: "fulfilled"; value: Awaited<ReturnType<typeof api.summary>> }).value} />

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
