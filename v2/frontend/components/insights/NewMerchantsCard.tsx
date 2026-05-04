"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NewMerchant } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

export function NewMerchantsCard({ data }: { data: NewMerchant[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>New This Month</CardTitle>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "oklch(0.95 0.04 152)", color: "oklch(0.54 0.190 152)" }}
          >
            {data.length} new merchant{data.length !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground">
          First time ever seeing these counterparties
        </p>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50">
          {data.map((m, i) => (
            <div key={i} className="flex items-center py-2.5 first:pt-0 last:pb-0 gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{m.counterparty}</p>
                <p className="text-[11px] text-muted-foreground">
                  {m.category} · {m.count}× · first {m.first_seen}
                </p>
              </div>
              <p className="text-[13px] font-semibold tabular-nums shrink-0">
                {fmt(m.total)} PLN
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
