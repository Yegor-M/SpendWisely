import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const CATEGORY_COLORS: Record<string, string> = {
  "Groceries":       "bg-green-100 text-green-800",
  "Food & Dining":   "bg-orange-100 text-orange-800",
  "Transport":       "bg-blue-100 text-blue-800",
  "Accounting":      "bg-purple-100 text-purple-800",
  "Rent & Housing":  "bg-red-100 text-red-800",
  "Subscriptions":   "bg-indigo-100 text-indigo-800",
  "Healthcare":      "bg-pink-100 text-pink-800",
  "Travel":          "bg-cyan-100 text-cyan-800",
  "Uncategorized":   "bg-gray-100 text-gray-600",
};

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "bg-slate-100 text-slate-700";
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const txs = await api.transactions({
    limit: 200,
    ...(params.month    ? { month: params.month }       : {}),
    ...(params.category ? { category: params.category } : {}),
  }).catch(() => []);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Transactions</h1>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Counterparty</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Currency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {txs.map((tx) => (
              <TableRow key={tx.id} className={tx.direction === "income" ? "bg-green-50/30" : ""}>
                <TableCell className="text-sm tabular-nums whitespace-nowrap">
                  {tx.booking_date}
                </TableCell>
                <TableCell className="text-sm max-w-[180px] truncate" title={tx.counterparty}>
                  {tx.counterparty || <span className="text-muted-foreground italic">—</span>}
                </TableCell>
                <TableCell className="text-sm max-w-[240px] truncate text-muted-foreground" title={tx.title}>
                  {tx.title}
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs ${catColor(tx.category)}`}>{tx.category}</Badge>
                </TableCell>
                <TableCell className={`text-right tabular-nums font-medium ${tx.direction === "expense" ? "text-red-600" : "text-green-600"}`}>
                  {tx.direction === "expense" ? "−" : "+"}
                  {new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2 }).format(tx.abs_amount)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{tx.currency}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {txs.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No transactions found.</p>
        )}
      </div>
    </main>
  );
}
