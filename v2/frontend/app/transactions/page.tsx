import { api } from "@/lib/api";
import { TransactionsTable } from "@/components/TransactionsTable";

export const dynamic = "force-dynamic";

const PAGE = 200;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const filters: Record<string, string> = {
    ...(params.month    ? { month: params.month }       : {}),
    ...(params.category ? { category: params.category } : {}),
  };

  const txs = await api.transactions({ ...filters, limit: PAGE, offset: 0 }).catch(() => []);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Transactions</h1>
      <TransactionsTable
        initial={txs}
        filters={filters}
        initialHasMore={txs.length === PAGE}
      />
    </main>
  );
}
