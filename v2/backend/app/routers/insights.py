from fastapi import APIRouter
from app.database import db
from app.services import insights as svc
import pandas as pd
import threading
from typing import Optional

router = APIRouter(prefix="/insights", tags=["insights"])

_df_lock = threading.Lock()


def _load_df() -> pd.DataFrame:
    # DuckDB's global connection is not thread-safe; serialize reads.
    with _df_lock:
        with db() as conn:
            df = conn.execute("SELECT * FROM transactions").df()
    if df.empty:
        return df
    df["booking_date"] = pd.to_datetime(df["booking_date"], errors="coerce")
    df["is_internal"] = df["is_internal"].astype(bool)
    df["abs_amount"] = df["abs_amount"].astype(float)
    return df


def _period(df: pd.DataFrame, months: Optional[int]) -> pd.DataFrame:
    if months is None or df.empty:
        return df
    cutoff = (pd.Timestamp.today() - pd.DateOffset(months=months)).strftime("%Y-%m")
    return df[df["month"] >= cutoff]


@router.get("/summary")
def get_summary(months: Optional[int] = None):
    return svc.summary(_period(_load_df(), months))


@router.get("/monthly")
def get_monthly(months: Optional[int] = None):
    return svc.monthly_trends(_period(_load_df(), months))


@router.get("/categories")
def get_categories(months: Optional[int] = None):
    return svc.category_breakdown(_period(_load_df(), months))


@router.get("/merchants")
def get_merchants(n: int = 15, direction: str = "expense", months: Optional[int] = None):
    return svc.top_merchants(_period(_load_df(), months), n=n, direction=direction)


@router.get("/recurring")
def get_recurring(min_amount: float = 5.0, months: Optional[int] = None):
    return svc.detect_recurring(_period(_load_df(), months), min_amount=min_amount)


@router.get("/anomalies")
def get_anomalies(months: Optional[int] = None):
    return svc.detect_anomalies(_period(_load_df(), months))


@router.get("/predict")
def get_predict(months: Optional[int] = None):
    return svc.predict_next_month(_period(_load_df(), months))


@router.get("/dow")
def get_dow(months: Optional[int] = None):
    return svc.day_of_week_patterns(_period(_load_df(), months))


# velocity and deltas are inherently current-month — no period param
@router.get("/velocity")
def get_velocity():
    return svc.spend_velocity(_load_df())


@router.get("/deltas")
def get_deltas():
    return svc.category_deltas(_load_df())


@router.get("/income-sources")
def get_income_sources(months: Optional[int] = None):
    return svc.income_sources(_period(_load_df(), months))


@router.get("/business-split")
def get_business_split(months: Optional[int] = None):
    return svc.business_vs_personal(_period(_load_df(), months))


@router.get("/category-trends")
def get_category_trends(months: Optional[int] = None):
    return svc.category_trends(_period(_load_df(), months))


@router.get("/new-merchants")
def get_new_merchants():
    return svc.new_merchants_this_month(_load_df())


@router.get("/top-transactions")
def get_top_transactions(n: int = 10, months: Optional[int] = None):
    return svc.top_transactions(_period(_load_df(), months), n=n)


@router.get("/recurring-summary")
def get_recurring_summary(months: Optional[int] = None):
    return svc.recurring_summary(_period(_load_df(), months))


@router.get("/daily-spend")
def get_daily_spend(month: Optional[str] = None):
    from datetime import date as _date
    df = _load_df()
    if month is None:
        month = _date.today().strftime("%Y-%m")
    return svc.daily_spend_by_category(df, month)


@router.get("/this-month-transactions")
def get_this_month_transactions(month: Optional[str] = None):
    df = _load_df()
    if df.empty:
        return {"month": month or "", "income": 0, "fixed_paid": 0, "habit_paid": 0,
                "other_paid": 0, "fixed_expected": 0, "habit_expected": 0,
                "transactions": [], "expected_recurrings": []}

    target_month = month or pd.Timestamp.today().strftime("%Y-%m")

    # Build recurring counterparty → full item map from full history
    recurring_items = svc.detect_recurring(df)
    recurring_map: dict = {r["counterparty"].lower(): r for r in recurring_items}

    # Commitment classification:
    # "fixed"       — true bills: rent, subscriptions, utilities, ISP, healthcare
    # "habit"       — habitual spend: always-habit cats + recurring discretionary
    # "other"       — one-time / non-recurring
    FIXED_CATS       = {"Subscriptions", "Rent & Housing", "Utilities", "Healthcare",
                        "Accounting", "Insurance", "Education", "Phone & Internet", "Taxes"}
    # These categories are habitual by nature even without recurring detection
    ALWAYS_HABIT_CATS = {"Groceries", "Transport", "Coffee", "Personal Care"}
    # These need recurring signal to be considered a habit (restaurant visits are often one-time)
    RECURRING_HABIT_CATS = {"Food & Dining", "Online Shopping", "Shopping", "Sports & Fitness"}

    def _commitment(category: str, regularity: float, is_recurring: bool) -> str:
        if category in FIXED_CATS:
            return "fixed"
        if is_recurring and regularity >= 0.80 and category not in ALWAYS_HABIT_CATS and category not in RECURRING_HABIT_CATS:
            return "fixed"
        if category in ALWAYS_HABIT_CATS:
            return "habit"
        if not is_recurring:
            return "other"
        if category in RECURRING_HABIT_CATS:
            return "habit"
        return "habit"  # recurring but uncategorized

    # Income for the month — convert USD salary to PLN using implied FX rate
    rate = svc._implied_fx_rate(df)
    inc = df[
        (df["month"] == target_month) &
        (df["direction"] == "income") &
        (~df["is_internal"])
    ]
    pln_inc = inc[inc["currency"] == "PLN"]["abs_amount"].sum()
    usd_inc = inc[inc["currency"] == "USD"]["abs_amount"].sum()
    income_total = float(pln_inc + usd_inc * rate)

    # PLN expenses for the month
    exp = df[
        (df["month"] == target_month) &
        (df["direction"] == "expense") &
        (~df["is_internal"]) &
        (df["currency"] == "PLN")
    ].sort_values("abs_amount", ascending=False)

    txs = []
    fixed_paid = habit_paid = other_paid = 0.0
    seen_counterparties: set = set()

    for _, row in exp.iterrows():
        cp  = row["counterparty"]
        cat = row["category"]
        rec = recurring_map.get(cp.lower())
        is_recurring = rec is not None
        period       = rec["period"] if rec else None
        regularity   = float(rec["regularity"]) if rec else 0.0
        amount       = float(row["abs_amount"])
        ctype        = _commitment(cat, regularity, is_recurring)

        if   ctype == "fixed": fixed_paid += amount
        elif ctype == "habit": habit_paid += amount
        else:                  other_paid += amount

        seen_counterparties.add(cp.lower())
        txs.append({
            "id":               row["id"],
            "booking_date":     str(row["booking_date"])[:10],
            "counterparty":     cp,
            "title":            row["title"],
            "category":         cat,
            "abs_amount":       round(amount, 2),
            "is_recurring":     is_recurring,
            "recurring_period": period,
            "commitment_type":  ctype,
        })

    # Expected: monthly/bi-weekly items not yet fired this month, classified
    monthly_periods = {"Monthly", "Bi-weekly"}
    expected = []
    for r in recurring_items:
        if r["period"] not in monthly_periods or r["counterparty"].lower() in seen_counterparties:
            continue
        ctype = _commitment(r["category"], float(r["regularity"]), True)
        expected.append({
            "counterparty":    r["counterparty"],
            "amount":          r["amount"],
            "period":          r["period"],
            "category":        r["category"],
            "commitment_type": ctype,
        })
    # Sort: largest first so rent surfaces immediately
    expected.sort(key=lambda e: -e["amount"])

    fixed_expected = sum(e["amount"] for e in expected if e["commitment_type"] == "fixed")
    habit_expected = sum(e["amount"] for e in expected if e["commitment_type"] == "habit")

    # ── Expected income ──────────────────────────────────────────────────────
    # Detect recurring income sources (salary etc.) and flag those not yet
    # received this month.
    real_inc = df[
        (df["direction"] == "income") &
        (~df["is_internal"]) &
        (df["abs_amount"] >= 50)   # skip micro bank credits / interest
    ].copy()

    inc_received_this_month = inc[inc["abs_amount"] >= 50].copy()
    paid_income_cps = set(inc_received_this_month["counterparty"].str.lower())

    income_transactions = []
    for _, row in inc_received_this_month.sort_values("booking_date").iterrows():
        pln = float(row["abs_amount"]) * (rate if row["currency"] == "USD" else 1.0)
        income_transactions.append({
            "id":           row["id"],
            "booking_date": str(row["booking_date"])[:10],
            "counterparty": row["counterparty"],
            "amount":       round(float(row["abs_amount"]), 2),
            "currency":     row["currency"],
            "pln_equiv":    round(pln, 0),
            "category":     row["category"],
        })

    # Detect recurring income counterparties from history
    all_months_inc = max(1, real_inc["month"].nunique())
    min_months_inc = max(2, min(3, int(all_months_inc * 0.4)))

    expected_income = []
    for cp, grp in real_inc.groupby("counterparty"):
        if not cp or len(grp) < 2:
            continue
        if grp["month"].nunique() < min_months_inc:
            continue
        dates = grp["booking_date"].sort_values().dropna()
        if len(dates) < 2:
            continue
        gaps = dates.diff().dt.days.dropna().tolist()
        avg_gap = float(pd.Series(gaps).mean())
        period = svc._period_label(avg_gap)
        if period not in monthly_periods:
            continue

        # How many payments expected per month vs received so far
        expected_per_month = 2 if period == "Bi-weekly" else 1
        received_count = int((inc_received_this_month["counterparty"].str.lower() == cp.lower()).sum())
        remaining = max(0, expected_per_month - received_count)
        if remaining == 0:
            continue

        median_amount = round(float(grp["abs_amount"].median()), 2)
        currency = grp["currency"].mode().iloc[0]
        pln_equiv = round(median_amount * (rate if currency == "USD" else 1.0), 0)

        for _ in range(remaining):
            expected_income.append({
                "counterparty": cp,
                "amount":       median_amount,
                "currency":     currency,
                "pln_equiv":    pln_equiv,
                "period":       period,
            })

    expected_income.sort(key=lambda e: -e["pln_equiv"])
    income_expected_pln = sum(e["pln_equiv"] for e in expected_income)

    return {
        "month":               target_month,
        "income":              round(income_total, 2),
        "income_expected_pln": round(income_expected_pln, 2),
        "fixed_paid":          round(fixed_paid, 2),
        "habit_paid":          round(habit_paid, 2),
        "other_paid":          round(other_paid, 2),
        "fixed_expected":      round(fixed_expected, 2),
        "habit_expected":      round(habit_expected, 2),
        "income_transactions": income_transactions,
        "expected_income":     expected_income,
        "transactions":        txs,
        "expected_recurrings": expected,
    }
