"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryDelta } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

const RED   = "oklch(0.56 0.200 25)";
const GREEN = "oklch(0.62 0.175 148)";
const MUTED = "oklch(0.50 0.015 255)";

export function CategoryDeltasTable({ data }: { data: CategoryDelta[] }) {
  if (!data.length) return null;
  const { last_month_label, prev_month_label } = data[0];

  // Exclude recurring tax category and tiny noise
  const rows = data.filter(
    (r) => r.category !== "Accounting" && Math.abs(r.delta) >= 100
  );
  if (!rows.length) return null;

  const netDelta = rows.reduce((s, r) => s + r.delta, 0);
  const maxAbs   = Math.max(...rows.map((r) => Math.abs(r.delta)), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle>Changes · {prev_month_label} → {last_month_label}</CardTitle>
          <div className="text-right shrink-0">
            <p
              className="text-base font-semibold tabular-nums"
              style={{ color: netDelta > 0 ? RED : netDelta < 0 ? GREEN : MUTED }}
            >
              {netDelta > 0 ? "+" : ""}{fmt(netDelta)}
            </p>
            <p className="text-[11px] text-muted-foreground">vs last month</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {rows.map((row) => {
            const isNew  = row.prev_month === 0 && row.last_month > 0;
            const isGone = row.last_month === 0 && row.prev_month > 0;
            const up     = row.delta > 0;
            const barPct = (Math.abs(row.delta) / maxAbs) * 100;
            const barColor = up ? "oklch(0.56 0.200 25 / 0.25)" : "oklch(0.62 0.175 148 / 0.25)";

            return (
              <div key={row.category}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="flex-1 text-[12px] font-medium truncate">{row.category}</span>
                  {!isNew && !isGone && (
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {fmt(row.last_month)}
                    </span>
                  )}
                  <span
                    className="text-[12px] font-semibold tabular-nums shrink-0 w-20 text-right"
                    style={{ color: isNew ? GREEN : isGone ? MUTED : up ? RED : GREEN }}
                  >
                    {isNew  ? `+${fmt(row.last_month)} NEW` :
                     isGone ? `−${fmt(row.prev_month)} GONE` :
                     `${up ? "+" : ""}${fmt(row.delta)}`}
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden bg-muted/40">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${barPct}%`, background: barColor.replace("/ 0.25", ""), opacity: 0.5 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
