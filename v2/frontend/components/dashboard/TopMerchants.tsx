"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Merchant } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

export function TopMerchants({ data }: { data: Merchant[] }) {
  const max = data[0]?.total ?? 1;
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Merchants</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.slice(0, 10).map((m, i) => (
            <div key={m.counterparty} className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground w-4 tabular-nums shrink-0">
                {i + 1}
              </span>
              <span className="w-28 truncate text-[13px] font-medium shrink-0">
                {m.counterparty || "(blank)"}
              </span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
                  style={{
                    width: grown ? `${(m.total / max) * 100}%` : "0%",
                    transitionDelay: `${i * 40}ms`,
                  }}
                />
              </div>
              <span className="text-[13px] tabular-nums text-right w-20 shrink-0">
                {fmt(m.total)}
              </span>
              <span className="text-[11px] text-muted-foreground w-6 text-right shrink-0">
                ×{m.count}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
