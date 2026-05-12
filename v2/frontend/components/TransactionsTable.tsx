"use client";
import { useState, useTransition, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api, type Transaction, type TransactionAggregate } from "@/lib/api";

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

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2 }).format(n);

function TxRow({ tx }: { tx: Transaction }) {
  return (
    <TableRow className={tx.direction === "income" ? "bg-green-50/30" : ""}>
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
        {fmt(tx.abs_amount)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{tx.currency}</TableCell>
    </TableRow>
  );
}

type Filters = {
  month?: string;
  category?: string;
  currency?: string;
  direction?: string;
  search?: string;
  min_amount?: string;
  max_amount?: string;
};

function buildApiParams(f: Filters): Record<string, string | number | boolean> {
  const p: Record<string, string | number | boolean> = {};
  if (f.month)      p.month     = f.month;
  if (f.category)   p.category  = f.category;
  if (f.currency)   p.currency  = f.currency;
  if (f.direction)  p.direction = f.direction;
  if (f.search)     p.search    = f.search;
  if (f.min_amount) p.min_amount = parseFloat(f.min_amount);
  if (f.max_amount) p.max_amount = parseFloat(f.max_amount);
  return p;
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
  const [f, setF] = useState<Filters>({
    month:    filters.month    ?? "",
    category: filters.category ?? "",
    currency: "",
    direction: "",
    search: "",
    min_amount: "",
    max_amount: "",
  });
  const [txs, setTxs]           = useState<Transaction[]>(initial);
  const [hasMore, setHasMore]   = useState(initialHasMore);
  const [loading, setLoading]   = useState(false);
  const [agg, setAgg]           = useState<TransactionAggregate | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const isFirstRender = useRef(true);

  // Load category list once
  useEffect(() => {
    api.listCategories().then(setCategories).catch(() => {});
  }, []);

  // On mount: fetch aggregate for initial filters only
  useEffect(() => {
    api.transactionsAggregate(buildApiParams(f)).then(setAgg).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On filter change: re-fetch transactions + aggregate (debounced)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    let stale = false;
    setLoading(true);
    const timer = setTimeout(() => {
      const params = buildApiParams(f);
      Promise.all([
        api.transactions({ ...params, limit: PAGE, offset: 0 }),
        api.transactionsAggregate(params),
      ])
        .then(([data, aggData]) => {
          if (stale) return;
          setTxs(data);
          setHasMore(data.length === PAGE);
          setAgg(aggData);
        })
        .catch(() => {})
        .finally(() => { if (!stale) setLoading(false); });
    }, 350);
    return () => { stale = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.search, f.category, f.currency, f.direction, f.month, f.min_amount, f.max_amount]);

  function loadMore() {
    startTransition(async () => {
      const params = buildApiParams(f);
      const next = await api.transactions({ ...params, limit: PAGE, offset: txs.length }).catch(() => []);
      setTxs((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE);
    });
  }

  function clearFilters() {
    setF({
      month:    filters.month    ?? "",
      category: "",
      currency: "",
      direction: "",
      search: "",
      min_amount: "",
      max_amount: "",
    });
  }

  const hasActiveFilters = !!(f.search || f.category || f.currency || f.direction || f.min_amount || f.max_amount);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          placeholder="Search counterparty or title…"
          value={f.search}
          onChange={(e) => setF((prev) => ({ ...prev, search: e.target.value }))}
          className="h-8 flex-1 min-w-[200px] rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
        />

        <Select
          value={f.category || "_all"}
          onValueChange={(v: string | null) => setF((prev) => ({ ...prev, category: !v || v === "_all" ? "" : v }))}
        >
          <SelectTrigger className="min-w-[160px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={f.direction || "_all"}
          onValueChange={(v: string | null) => setF((prev) => ({ ...prev, direction: !v || v === "_all" ? "" : v }))}
        >
          <SelectTrigger className="min-w-[120px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All types</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={f.currency || "_all"}
          onValueChange={(v: string | null) => setF((prev) => ({ ...prev, currency: !v || v === "_all" ? "" : v }))}
        >
          <SelectTrigger className="min-w-[90px]">
            <SelectValue placeholder="Currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All</SelectItem>
            <SelectItem value="PLN">PLN</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>

        <input
          type="number"
          placeholder="Min"
          value={f.min_amount}
          onChange={(e) => setF((prev) => ({ ...prev, min_amount: e.target.value }))}
          className="h-8 w-[90px] rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground tabular-nums"
        />
        <input
          type="number"
          placeholder="Max"
          value={f.max_amount}
          onChange={(e) => setF((prev) => ({ ...prev, max_amount: e.target.value }))}
          className="h-8 w-[90px] rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground tabular-nums"
        />

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="h-8 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground border border-border hover:border-foreground/40 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
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
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : txs.map((tx) => <TxRow key={tx.id} tx={tx} />)
            }
          </TableBody>
        </Table>
        {!loading && txs.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No transactions found.</p>
        )}
      </div>

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center mt-4">
          <button
            onClick={loadMore}
            disabled={isPending}
            className="px-5 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
          >
            {isPending ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {/* Footer: count + sums */}
      <div className="flex justify-center gap-4 mt-3 text-[11px] text-muted-foreground">
        {agg ? (
          <>
            <span>{agg.count.toLocaleString()} transactions</span>
            {agg.total_expenses > 0 && (
              <span className="text-red-500">−{fmt(agg.total_expenses)}</span>
            )}
            {agg.total_income > 0 && (
              <span className="text-green-600">+{fmt(agg.total_income)}</span>
            )}
            {agg.total_expenses > 0 && agg.total_income > 0 && (
              <span className={agg.net >= 0 ? "text-green-600" : "text-red-500"}>
                net {agg.net >= 0 ? "+" : "−"}{fmt(Math.abs(agg.net))}
              </span>
            )}
            {hasMore && <span>· showing {txs.length} loaded</span>}
            {!hasMore && <span>· all loaded</span>}
          </>
        ) : (
          <span>Showing {txs.length} transactions{hasMore ? "" : " · all loaded"}</span>
        )}
      </div>
    </div>
  );
}
