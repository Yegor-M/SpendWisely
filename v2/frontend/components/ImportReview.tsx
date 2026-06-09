"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, UncategorizedGroup, BulkCategorizeItem } from "@/lib/api";

type Assignment = { category: string; saveRule: boolean };

type Props = {
  imported: number;
  categorized: number;
  uncategorized: number;
  groups: UncategorizedGroup[];
  onDone: () => void;
};

function AnimatedCheck() {
  return (
    <div className="relative w-20 h-20">
      {/* Circle draws itself clockwise from 12 o'clock */}
      <svg viewBox="0 0 52 52" className="w-full h-full -rotate-90">
        {/* Track */}
        <circle cx="26" cy="26" r="23" fill="none" stroke="currentColor"
          strokeWidth="2" className="text-muted" />
        {/* Animated fill */}
        <circle cx="26" cy="26" r="23" fill="none" stroke="currentColor"
          strokeWidth="2.5" className="text-emerald-500"
          style={{
            strokeDasharray: 145,
            strokeDashoffset: 145,
            animation: "circle-draw 0.65s cubic-bezier(0.4,0,0.2,1) forwards",
          }}
        />
      </svg>
      {/* Check tick — separate SVG so it doesn't rotate */}
      <svg viewBox="0 0 52 52" className="absolute inset-0 w-full h-full">
        <path
          fill="none" stroke="currentColor" strokeWidth="3.5"
          strokeLinecap="round" strokeLinejoin="round"
          d="M15 27 L22 34 L37 19"
          className="text-emerald-500"
          style={{
            strokeDasharray: 32,
            strokeDashoffset: 32,
            animation: "check-draw 0.35s 0.6s cubic-bezier(0.4,0,0.2,1) forwards",
          }}
        />
      </svg>
    </div>
  );
}

export function ImportReview({ imported, categorized, uncategorized, groups, onDone }: Props) {
  const [categories, setCategories] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>(
    Object.fromEntries(groups.map((g) => [g.counterparty, { category: "", saveRule: true }]))
  );
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ updated: number; rules: number; extra: number } | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const router = useRouter();

  useEffect(() => {
    api.listCategories().then(setCategories).catch(() => {});
  }, []);

  const active = imported > 0 ? imported : groups.reduce((s, g) => s + g.count, 0);
  const pct = active > 0 ? Math.round((categorized / active) * 100) : 0;
  const filled = Object.values(assignments).filter((a) => a.category).length;

  const filledTx = groups
    .filter((g) => assignments[g.counterparty]?.category)
    .reduce((s, g) => s + g.count, 0);
  const totalPct = active > 0 ? Math.round(((categorized + filledTx) / active) * 100) : 0;

  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setBarWidth(totalPct), 50);
    return () => clearTimeout(t);
  }, [totalPct]);

  // Auto-dismiss when result is in and coverage >= 80%
  useEffect(() => {
    if (!applyResult) return;
    if (totalPct < 100) return;
    const t1 = setTimeout(() => setIsDismissing(true), 1900);
    const t2 = setTimeout(() => { router.push("/"); onDone(); }, 2500);
    timers.current = [t1, t2];
    return () => timers.current.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyResult]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function handleSuggest() {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const reps = groups.map((g) => ({
        id: g.counterparty,
        counterparty: g.counterparty,
        title: g.sample_title,
        abs_amount: g.count > 0 ? g.total_amount / g.count : 0,
        bank_category: g.bank_category,
        count: g.count,
      }));
      const suggestions = await api.suggestCategories(reps);
      setAssignments((prev) => {
        const next = { ...prev };
        for (const [cp, cat] of Object.entries(suggestions)) {
          if (next[cp] !== undefined) next[cp] = { ...next[cp], category: cat };
        }
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI suggest failed";
      setSuggestError(
        msg.toLowerCase().includes("too many")
          ? msg
          : msg.toLowerCase().includes("quota") || msg.includes("429")
          ? "Quota exceeded — check your API key or try again later"
          : msg.toLowerCase().includes("configured")
          ? "No AI provider configured — add an API key in .env"
          : "AI suggest failed — check your API key"
      );
    } finally {
      setSuggesting(false);
    }
  }

  async function handleApply() {
    setApplying(true);
    try {
      const items: BulkCategorizeItem[] = groups
        .filter((g) => assignments[g.counterparty]?.category)
        .map((g) => ({
          tx_ids: g.tx_ids,
          category: assignments[g.counterparty].category,
          save_rule: assignments[g.counterparty].saveRule,
          counterparty: g.counterparty,
        }));

      if (items.length === 0) { onDone(); return; }

      const result = await api.bulkCategorize(items);
      setApplyResult({ updated: result.updated, rules: result.rules_created, extra: result.additionally_categorized });
    } catch (e) {
      console.error("Apply failed", e);
    } finally {
      setApplying(false);
    }
  }

  function setCategory(counterparty: string, category: string) {
    setAssignments((prev) => ({ ...prev, [counterparty]: { ...prev[counterparty], category } }));
  }

  function setSaveRule(counterparty: string, saveRule: boolean) {
    setAssignments((prev) => ({ ...prev, [counterparty]: { ...prev[counterparty], saveRule } }));
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-500 ${
        isDismissing ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div
        className={`bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transition-all duration-500 ${
          isDismissing ? "scale-95 -translate-y-3" : "scale-100 translate-y-0"
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Import complete — review uncategorized</h2>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{imported} imported</span>
            <span className="text-emerald-600 font-medium">{categorized} categorized</span>
            <span className="text-amber-600 font-medium">{uncategorized} need review</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {totalPct}% categorized
            {totalPct > pct && <span className="text-emerald-600 font-medium"> (+{totalPct - pct}% from review)</span>}
          </p>
        </div>

        {applyResult ? (
          /* ── Success state ── */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10 text-center animate-in fade-in zoom-in-95 duration-300">
            <AnimatedCheck />
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-base">{applyResult.updated} transactions categorized</p>
              {applyResult.rules > 0 && (
                <p className="text-sm text-muted-foreground">
                  {applyResult.rules} rule{applyResult.rules > 1 ? "s" : ""} saved
                  {applyResult.extra > 0 && ` · ${applyResult.extra} older also updated`}
                </p>
              )}
              {totalPct >= 100 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  100% covered — closing automatically…
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">{totalPct}% of import categorized</p>
              )}
            </div>
            {totalPct < 100 && (
              <button
                onClick={onDone}
                className="mt-1 px-5 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Group table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Counterparty</th>
                    <th className="px-2 py-2.5 font-medium text-right">Count</th>
                    <th className="px-2 py-2.5 font-medium text-right">Total</th>
                    <th className="px-3 py-2.5 font-medium">Category</th>
                    <th className="px-3 py-2.5 font-medium text-center">Save rule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {groups.map((g) => {
                    const a = assignments[g.counterparty];
                    return (
                      <tr key={g.counterparty} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-medium truncate max-w-[180px]" title={g.counterparty}>
                            {g.counterparty || "(unknown)"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]" title={g.sample_title}>
                            {g.sample_title}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                          {g.count}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                          {g.total_amount.toFixed(0)} PLN
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={a?.category ?? ""}
                            onChange={(e) => setCategory(g.counterparty, e.target.value)}
                            className="w-full text-xs rounded-md border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="">— pick —</option>
                            {categories.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={a?.saveRule ?? true}
                            disabled={!a?.category}
                            onChange={(e) => setSaveRule(g.counterparty, e.target.checked)}
                            className="h-3.5 w-3.5 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={handleSuggest}
                  disabled={suggesting || applying}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 disabled:opacity-50 transition-colors"
                >
                  {suggesting
                    ? <span className="flex items-center gap-1">Thinking<span className="flex gap-0.5"><span className="animate-bounce [animation-delay:0ms]">.</span><span className="animate-bounce [animation-delay:150ms]">.</span><span className="animate-bounce [animation-delay:300ms]">.</span></span></span>
                    : <span className="flex items-center gap-1.5">✦ Suggest with AI{filled > 0 && <span className="text-emerald-600 font-medium">{totalPct}%</span>}</span>
                  }
                </button>
                {suggestError && (
                  <span className="text-xs text-destructive truncate" title={suggestError}>
                    {suggestError}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onDone}
                  disabled={applying}
                  className="text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleApply}
                  disabled={applying || filled === 0}
                  className="text-xs px-4 py-1.5 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors font-medium"
                >
                  {applying ? "Applying…" : `Apply${filled > 0 ? ` (${filled})` : ""}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
