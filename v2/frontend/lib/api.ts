// Server components run inside Docker where localhost = this container, not backend.
// API_URL (non-public) points to the Docker service name for SSR; NEXT_PUBLIC_API_URL for browser.
const BASE =
  (typeof window === "undefined" ? process.env.API_URL : undefined) ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000/api/v1";

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
  usd_salary_total: number; usd_salary_pln_equiv: number; implied_fx_rate: number;
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
  category: string;
  predicted_spend: number;
  avg_historical: number;
  confidence: string;
  cv: number;
  last_month_actual: number;
  delta_vs_last: number;
  trend_direction: "up" | "down" | "stable";
  trend_pct: number;
  range_low: number;
  range_high: number;
  months_observed: number;
  history: { month: string; amount: number }[];
};

export type DowPattern = {
  day: string; total: number; count: number; avg: number;
};

export type Anomaly = {
  booking_date: string; counterparty: string; title: string;
  abs_amount: number; category: string;
  z_score: number | null; anomaly_type: string;
};

export type SpendVelocity = {
  current_month: string; has_current_data: boolean;
  spent_so_far: number; projected_eom: number;
  days_elapsed: number; days_in_month: number; day_pct: number;
  avg_prior_months: number; vs_avg_pct: number | null;
};

export type CategoryDelta = {
  category: string;
  last_month: number; prev_month: number;
  delta: number; delta_pct: number | null;
  last_month_label: string; prev_month_label: string;
};

export type IncomeSource = {
  counterparty: string; total_received: number;
  tx_count: number; share_pct: number; avg_per_tx: number;
  currency: string;
};

export type BusinessSplit = {
  total_expenses: number; business_expenses: number; personal_expenses: number;
  business_pct: number; personal_pct: number;
  avg_monthly_business: number; avg_monthly_personal: number;
  business_categories: string[];
};

export type CategoryTrend = {
  category: string; months: string[]; values: number[];
  avg: number; trend: "up" | "down" | "flat";
};

export type NewMerchant = {
  counterparty: string; total: number; count: number;
  category: string; first_seen: string;
};

export type TopTransaction = {
  booking_date: string; counterparty: string; title: string;
  abs_amount: number; category: string; month: string;
};

export type DailySpend = {
  categories: string[];
  days: Array<{ date: string } & Record<string, number>>;
};

export type RecurringSummary = {
  total_monthly_recurring: number;
  item_count: number;
  items: Array<Recurring & { monthly_equiv: number }>;
};

export type CommitmentType = "fixed" | "habit" | "other";

export type BudgetTransaction = {
  id: string; booking_date: string; counterparty: string; title: string;
  category: string; abs_amount: number;
  is_recurring: boolean; recurring_period: string | null;
  commitment_type: CommitmentType;
};

export type ExpectedRecurring = {
  counterparty: string; amount: number; period: string; category: string;
  commitment_type: CommitmentType;
};

export type ThisMonthData = {
  month: string;
  income: number;
  income_expected: number;
  fixed_paid: number;
  habit_paid: number;
  other_paid: number;
  fixed_expected: number;
  habit_expected: number;
  transactions: BudgetTransaction[];
  expected_recurrings: ExpectedRecurring[];
};

export type UncategorizedGroup = {
  counterparty: string;
  sample_title: string;
  count: number;
  total_amount: number;
  tx_ids: string[];
};

export type IngestResult = {
  source_file: string;
  total_rows: number;
  imported: number;
  duplicates_skipped: number;
  internal_marked: number;
  categorized: number;
  uncategorized: number;
  uncategorized_groups: UncategorizedGroup[];
};

export type BulkCategorizeItem = {
  tx_ids: string[];
  category: string;
  save_rule: boolean;
  counterparty: string;
};

export type BulkCategorizeResult = {
  updated: number;
  rules_created: number;
  additionally_categorized: number;
};

export type TransactionAggregate = {
  count: number;
  total_expenses: number;
  total_income: number;
  net: number;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(
    (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1") + path,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(
    (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1") + path,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  summary:         (months?: number) => get<Summary>("/insights/summary", months ? { months } : undefined),
  monthly:         (months?: number) => get<MonthlyTrend[]>("/insights/monthly", months ? { months } : undefined),
  categories:      (months?: number) => get<CategoryBreakdown[]>("/insights/categories", months ? { months } : undefined),
  merchants:       (n = 10, months?: number) => get<Merchant[]>("/insights/merchants", { n, ...(months ? { months } : {}) }),
  recurring:       (months?: number) => get<Recurring[]>("/insights/recurring", months ? { months } : undefined),
  predict:         (months?: number) => get<Prediction[]>("/insights/predict", months ? { months } : undefined),
  dow:             (months?: number) => get<DowPattern[]>("/insights/dow", months ? { months } : undefined),
  anomalies:       (months?: number) => get<Anomaly[]>("/insights/anomalies", months ? { months } : undefined),
  velocity:        ()                => get<SpendVelocity>("/insights/velocity"),
  deltas:          ()                => get<CategoryDelta[]>("/insights/deltas"),
  incomeSources:   (months?: number) => get<IncomeSource[]>("/insights/income-sources", months ? { months } : undefined),
  businessSplit:   (months?: number) => get<BusinessSplit>("/insights/business-split", months ? { months } : undefined),
  categoryTrends:  (months?: number) => get<CategoryTrend[]>("/insights/category-trends", months ? { months } : undefined),
  topTransactions: (n = 10, months?: number) => get<TopTransaction[]>("/insights/top-transactions", { n, ...(months ? { months } : {}) }),
  newMerchants:    ()                => get<NewMerchant[]>("/insights/new-merchants"),
  recurringSummary:(months?: number) => get<RecurringSummary>("/insights/recurring-summary", months ? { months } : undefined),
  dailySpend:      (month: string)   => get<DailySpend>("/insights/daily-spend", { month }),
  thisMonthTx:     (month?: string)  => get<ThisMonthData>("/insights/this-month-transactions", month ? { month } : undefined),
  transactions: (params?: Record<string, string | number | boolean>) =>
    get<Transaction[]>("/transactions", params),
  transactionsAggregate: (params?: Record<string, string | number | boolean>) =>
    get<TransactionAggregate>("/transactions/aggregate", params),
  deleteAllTransactions: () => del<{ deleted: number }>("/transactions"),
  listCategories: () => get<string[]>("/categories"),
  suggestCategories: (items: Array<{ id: string; counterparty: string; title: string; abs_amount: number }>) =>
    post<Record<string, string>>("/categories/suggest", items),
  bulkCategorize: (items: BulkCategorizeItem[]) =>
    post<BulkCategorizeResult>("/transactions/bulk-categorize", items),
};
