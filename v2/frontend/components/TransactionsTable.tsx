"use client";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api, type Transaction } from "@/lib/api";

const PAGE = 200;

const CATEGORY_COLORS: Record<string, string> = {
  "Groceries":      "bg-green-100 text-green-800",
  "Food & Dining":  "bg-orange-100 text-orange-800",
  "Transport":      "bg-blue-100 text-blue-800",
  "Accounting":     "bg-purple-100 text-purple-800",
  "Rent & Housing": "bg-red-100 text-red-800",
  "Subscriptions":  "bg-indigo-100 text-indigo-800",
  "Healthcare":     "bg-pink-100 text-pink-800",
  "Travel":         "bg-cyan-100 text-cyan-800",
  "Uncategorized":  "bg-gray-100 text-gray-600",
};

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "bg-slate-100 text-slate-700";
}

function TxRow({ tx }: { tx: Transaction }) {
  return (
    <TableRow key={tx.id} className={tx.direction === "income" ? "bg-green-50/30" : ""}>
      <TableCell className="text-sm tabular-nums whitespace-nowrap">{tx.booking_date}</TableCell>
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
  );
}

export function TransactionsTable({
  initial,
  filters,
  initialHasMore,
}: {
  initial: Transaction[];
  filters: Record<string, string>;
  initialHasMore: boolean;
}) {
  const [txs, setTxs] = useState<Transaction[]>(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    startTransition(async () => {
      const next = await api.transactions({ ...filters, limit: PAGE, offset: txs.length }).catch(() => []);
      setTxs((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE);
    });
  }

  return (
    <div>
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
            {txs.map((tx) => <TxRow key={tx.id} tx={tx} />)}
          </TableBody>
        </Table>
        {txs.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No transactions found.</p>
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={isPending}
            className="px-5 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
          >
            {isPending ? "Loading…" : `Load more`}
          </button>
        </div>
      )}
      <p className="text-center text-[11px] text-muted-foreground mt-3">
        Showing {txs.length} transactions{hasMore ? "" : " · all loaded"}
      </p>
    </div>
  );
}
