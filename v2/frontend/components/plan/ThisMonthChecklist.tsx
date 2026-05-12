"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ThisMonthData, BudgetTransaction, ExpectedRecurring, IncomeTransaction, ExpectedIncome } from "@/lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) => {
  const [, m, day] = d.split("-");
  return `${day}.${m}`;
};


function groupByCategory(txs: BudgetTransaction[]) {
  const map = new Map<string, BudgetTransaction[]>();
  for (const tx of txs) {
    map.set(tx.category, [...(map.get(tx.category) ?? []), tx]);
  }
  return [...map.entries()]
    .map(([cat, items]) => ({ cat, items, total: items.reduce((s, t) => s + t.abs_amount, 0) }))
    .sort((a, b) => b.total - a.total);
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ data }: { data: ThisMonthData }) {
  const totalIncome  = data.income + (data.income_expected_pln ?? 0);
  const spent        = data.fixed_paid + data.habit_paid + data.other_paid;
  const expected     = data.fixed_expected + data.habit_expected;
  const net          = totalIncome - spent - expected;

  const tiles = [
    { label: "Income",   value: totalIncome,                          color: "oklch(0.52 0.185 155)" },
    { label: "Bills",    value: data.fixed_paid + data.fixed_expected, color: "oklch(0.58 0.200 25)"  },
    { label: "Spending", value: data.habit_paid + data.other_paid,     color: "oklch(0.55 0.195 265)" },
    { label: "Free",     value: net, color: net < 0 ? "oklch(0.58 0.200 25)" : "oklch(0.52 0.185 155)" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {tiles.map(({ label, value, color }) => (
        <div key={label} className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
          <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
          <p className="text-[18px] font-semibold tabular-nums leading-tight" style={{ color }}>
            {label === "Free" && value > 0 ? "+" : ""}{fmt(value)}
            <span className="text-[11px] font-normal text-muted-foreground ml-1">PLN</span>
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Row primitives ────────────────────────────────────────────────────────────

function PaidRow({ tx }: { tx: BudgetTransaction }) {
  return (
    <div className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <span
        className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold"
        style={{ background: "oklch(0.62 0.175 148 / 0.15)", color: "oklch(0.44 0.165 158)" }}
      >✓</span>
      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-8">
        {fmtDate(tx.booking_date)}
      </span>
      <span className="flex-1 text-[13px] truncate">{tx.counterparty}</span>
      <span className="text-[11px] text-muted-foreground/70 shrink-0 hidden sm:inline truncate max-w-[120px]">
        {tx.category}
      </span>
      <span className="text-[13px] font-semibold tabular-nums shrink-0 w-20 text-right">
        {fmt(tx.abs_amount)} PLN
      </span>
    </div>
  );
}

function ExpectedRow({ item }: { item: ExpectedRecurring }) {
  return (
    <div className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <span className="w-4 h-4 rounded-full shrink-0 border border-dashed border-border/60" />
      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-8" />
      <span className="flex-1 text-[13px] truncate">{item.counterparty}</span>
      <span className="text-[11px] text-muted-foreground/70 shrink-0 hidden sm:inline truncate max-w-[120px]">
        {item.category}
      </span>
      <span className="text-[13px] tabular-nums shrink-0 w-20 text-right">
        ~{fmt(item.amount)} PLN
      </span>
    </div>
  );
}

function ReceivedIncomeRow({ tx }: { tx: IncomeTransaction }) {
  const label = tx.currency === "USD"
    ? `${fmt(tx.amount)} USD ≈ ${fmt(tx.pln_equiv)} PLN`
    : `${fmt(tx.pln_equiv)} PLN`;
  return (
    <div className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <span
        className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold"
        style={{ background: "oklch(0.62 0.175 148 / 0.15)", color: "oklch(0.44 0.165 158)" }}
      >✓</span>
      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-8">
        {fmtDate(tx.booking_date)}
      </span>
      <span className="flex-1 text-[13px] truncate">{tx.counterparty}</span>
      <span className="text-[13px] font-semibold tabular-nums shrink-0 text-right" style={{ color: "oklch(0.52 0.185 155)" }}>
        +{label}
      </span>
    </div>
  );
}

function ExpectedIncomeRow({ item }: { item: ExpectedIncome }) {
  const label = item.currency === "USD"
    ? `~${fmt(item.amount)} USD ≈ ${fmt(item.pln_equiv)} PLN`
    : `~${fmt(item.pln_equiv)} PLN`;
  return (
    <div className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <span className="w-4 h-4 rounded-full shrink-0 border border-dashed border-border/60" />
      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-8" />
      <span className="flex-1 text-[13px] truncate">{item.counterparty}</span>
      <span className="text-[11px] text-muted-foreground/60 shrink-0 hidden sm:inline">{item.period}</span>
      <span className="text-[13px] tabular-nums shrink-0 text-right" style={{ color: "oklch(0.52 0.185 155 / 0.7)" }}>
        +{label}
      </span>
    </div>
  );
}

// ── Category group (for Daily / One-time) ─────────────────────────────────────
// Single-item categories render flat — no pointless toggle.

function CatGroup({ cat, items }: { cat: string; items: BudgetTransaction[] }) {
  const [open, setOpen] = useState(false);
  const total = items.reduce((s, t) => s + t.abs_amount, 0);

  if (items.length === 1) {
    return (
      <div className="border-t border-border/30 first:border-t-0">
        <PaidRow tx={items[0]} />
      </div>
    );
  }

  return (
    <div className="border-t border-border/30 first:border-t-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-muted/30 rounded-lg px-1 -mx-1 transition-colors"
      >
        <span className="w-4 h-4 shrink-0" />
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-8" />
        <span className="flex-1 text-[13px] font-medium">{cat}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{items.length}×</span>
        <span className="text-[13px] font-semibold tabular-nums shrink-0 w-20 text-right">
          {fmt(total)} PLN
        </span>
        <span className="text-[10px] text-muted-foreground ml-1 w-3">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="pl-7 pb-1">
          {items.map((tx) => <PaidRow key={tx.id} tx={tx} />)}
        </div>
      )}
    </div>
  );
}

// ── Top-level collapsible section ─────────────────────────────────────────────

function Section({
  label, sublabel, total, totalColor, paid, badge, defaultOpen = true, children,
}: {
  label: string; sublabel?: string; total: number; totalColor?: string;
  paid?: number; badge?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border/50 pt-4 first:border-t-0 first:pt-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-left mb-3"
      >
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {sublabel && (
          <span className="text-[11px] text-muted-foreground/50">{sublabel}</span>
        )}
        {badge && (
          <span className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
            {badge}
          </span>
        )}
        <div className="flex-1 h-px bg-border/40" />
        <span className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: totalColor }}>
          {paid !== undefined ? `${fmt(paid)}/${fmt(total)}` : fmt(total)} PLN
        </span>
        <span className="text-[10px] text-muted-foreground ml-1">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ThisMonthChecklist({ data }: { data: ThisMonthData }) {
  const incomeReceived = data.income_transactions ?? [];
  const incomeExpected = data.expected_income ?? [];
  const hasIncome      = incomeReceived.length > 0 || incomeExpected.length > 0;
  const incomeTotal    = data.income + (data.income_expected_pln ?? 0);

  const fixed   = data.transactions.filter((t) => t.commitment_type === "fixed");
  const habits  = data.transactions.filter((t) => t.commitment_type === "habit");
  const oneTime = data.transactions.filter((t) => t.commitment_type === "other");

  const fixedExpected = data.expected_recurrings.filter((e) => e.commitment_type === "fixed");
  const habitExpected = data.expected_recurrings.filter((e) => e.commitment_type === "habit");

  const billsPaid = [...fixed].sort((a, b) => b.abs_amount - a.abs_amount);
  const habitGroups = groupByCategory(habits);
  const otherGroups = groupByCategory(oneTime);

  const hasExpected = fixedExpected.length + habitExpected.length > 0;
  const billsTotal  = data.fixed_paid + data.fixed_expected;
  const dailyTotal  = data.habit_paid + data.habit_expected;

  const monthLabel = (() => {
    const [y, m] = data.month.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending breakdown</CardTitle>
        <p className="text-[12px] text-muted-foreground">
          {monthLabel} · {data.transactions.length} transactions
        </p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* ① Income — received ✓ + expected ○ */}
        {hasIncome && (
          <Section
            label="Income"
            sublabel="this month"
            total={incomeTotal}
            totalColor="oklch(0.52 0.185 155)"
            paid={data.income}
            defaultOpen={true}
          >
            <div className="divide-y divide-border/30">
              {incomeReceived.map((tx) => <ReceivedIncomeRow key={tx.id} tx={tx} />)}
            </div>
            {incomeExpected.length > 0 && (
              <>
                {incomeReceived.length > 0 && (
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-border/30" />
                    <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">expected</span>
                    <div className="flex-1 h-px bg-border/30" />
                  </div>
                )}
                <div className="divide-y divide-border/30">
                  {incomeExpected.map((item, i) => <ExpectedIncomeRow key={i} item={item} />)}
                </div>
              </>
            )}
          </Section>
        )}

        {/* ② Bills — paid ✓ + coming up ○ in one place */}
        {(billsPaid.length > 0 || hasExpected) && (
          <Section
            label="Bills"
            sublabel="committed this month"
            total={billsTotal}
            totalColor="oklch(0.58 0.200 25)"
            paid={data.fixed_paid}
            defaultOpen={true}
          >
            <div className="divide-y divide-border/30">
              {billsPaid.map((tx) => <PaidRow key={tx.id} tx={tx} />)}
            </div>

            {hasExpected && (
              <>
                {billsPaid.length > 0 && (
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-border/30" />
                    <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">coming up</span>
                    <div className="flex-1 h-px bg-border/30" />
                  </div>
                )}
                <div className="divide-y divide-border/30">
                  {[...fixedExpected, ...habitExpected].map((item, i) => (
                    <ExpectedRow key={i} item={item} />
                  ))}
                </div>
              </>
            )}
          </Section>
        )}

        {/* ② Daily — habit categories, collapsed, grouped */}
        {habitGroups.length > 0 && (
          <Section
            label="Daily"
            sublabel="regular discretionary"
            total={dailyTotal}
            totalColor="oklch(0.55 0.195 265)"
            paid={data.habit_paid}
            badge={`${habits.length}×`}
            defaultOpen={false}
          >
            <div>
              {habitGroups.map(({ cat, items }) => (
                <CatGroup key={cat} cat={cat} items={items} />
              ))}
            </div>
          </Section>
        )}

        {/* ③ One-time — everything else, collapsed, grouped */}
        {otherGroups.length > 0 && (
          <Section
            label="One-time"
            sublabel="non-recurring"
            total={data.other_paid}
            totalColor="oklch(0.50 0.130 265)"
            paid={data.other_paid}
            badge={`${oneTime.length}×`}
            defaultOpen={false}
          >
            <div>
              {otherGroups.map(({ cat, items }) => (
                <CatGroup key={cat} cat={cat} items={items} />
              ))}
            </div>
          </Section>
        )}

      </CardContent>
    </Card>
  );
}
