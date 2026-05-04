"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopTransaction } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

export function TopTransactionsCard({ data }: { data: TopTransaction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Biggest Expenses Ever</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50">
          {data.map((tx, i) => (
            <div key={i} className="flex items-center py-2.5 first:pt-0 last:pb-0 gap-3">
              <span className="text-[12px] font-mono text-muted-foreground w-5 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{tx.counterparty || tx.title}</p>
                <p className="text-[11px] text-muted-foreground">{tx.booking_date} · {tx.category}</p>
              </div>
              <p className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: "oklch(0.56 0.200 25)" }}>
                {fmt(tx.abs_amount)} PLN
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
