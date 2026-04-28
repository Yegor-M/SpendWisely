const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  const url = new URL(BASE + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

export type Summary = {
  total_income: number; total_expenses: number; net_balance: number;
  avg_monthly_income: number; avg_monthly_expenses: number; savings_rate_pct: number;
  transaction_count: number; expense_count: number; income_count: number;
  months_covered: number; unique_counterparties: number;
  largest_single_expense: number; largest_single_income: number;
  budget_health_score: number; budget_health_label: string;
};

export type MonthlyTrend = {
  month: string; expenses: number; income: number;
  savings: number; savings_rate_pct: number; exp_mom_pct: number | null;
};

export type CategoryBreakdown = {
  category: string; total_spent: number; tx_count: number;
  share_pct: number; avg_per_tx: number;
};

export type Merchant = {
  counterparty: string; total: number; count: number; avg_per_tx: number;
};

export type Recurring = {
  counterparty: string; amount: number; occurrences: number; period: string;
  regularity: number; category: string; last_seen: string;
};

export type Transaction = {
  id: string; booking_date: string; month: string; counterparty: string;
  title: string; amount: number; abs_amount: number; currency: string;
  direction: string; category: string; bank_category: string;
  operation_type: string; is_internal: boolean;
};

export type Prediction = {
  category: string; predicted_spend: number; avg_historical: number; confidence: string;
};

export type DowPattern = {
  day: string; total: number; count: number; avg: number;
};

export const api = {
  summary:    ()      => get<Summary>("/insights/summary"),
  monthly:    ()      => get<MonthlyTrend[]>("/insights/monthly"),
  categories: ()      => get<CategoryBreakdown[]>("/insights/categories"),
  merchants:  (n = 10)=> get<Merchant[]>("/insights/merchants", { n }),
  recurring:  ()      => get<Recurring[]>("/insights/recurring"),
  predict:    ()      => get<Prediction[]>("/insights/predict"),
  dow:        ()      => get<DowPattern[]>("/insights/dow"),
  transactions: (params?: Record<string, string | number | boolean>) =>
    get<Transaction[]>("/transactions", params),
};
