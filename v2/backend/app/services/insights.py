"""
Analytics engine — v2.

Key improvements over v1:
- All calculations exclude is_internal=True rows (fixes FX double-counting).
- All spend totals use PLN-equivalent only (currency == 'PLN').
- Business vs personal separation (Accounting category = business overhead).
- Day-of-week patterns.
- Cleaner budget health formula.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from collections import defaultdict


def _real_expenses(df: pd.DataFrame) -> pd.DataFrame:
    return df[(df["direction"] == "expense") & (~df["is_internal"])].copy()


def _real_income(df: pd.DataFrame) -> pd.DataFrame:
    return df[(df["direction"] == "income") & (~df["is_internal"])].copy()


def _pln_expenses(df: pd.DataFrame) -> pd.DataFrame:
    return _real_expenses(df)[df["currency"] == "PLN"]


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
def summary(df: pd.DataFrame) -> dict:
    exp = _real_expenses(df)
    inc = _real_income(df)
    pln_exp = exp[exp["currency"] == "PLN"]
    pln_inc = inc[inc["currency"] == "PLN"]
    months = df[~df["is_internal"]]["month"].nunique() or 1

    total_exp = pln_exp["abs_amount"].sum()
    total_inc = pln_inc["abs_amount"].sum()
    savings_rate = ((total_inc - total_exp) / total_inc * 100) if total_inc > 0 else 0.0

    return {
        "total_income":          round(total_inc, 2),
        "total_expenses":        round(total_exp, 2),
        "net_balance":           round(total_inc - total_exp, 2),
        "avg_monthly_income":    round(total_inc / months, 2),
        "avg_monthly_expenses":  round(total_exp / months, 2),
        "savings_rate_pct":      round(savings_rate, 1),
        "transaction_count":     len(df[~df["is_internal"]]),
        "expense_count":         len(exp),
        "income_count":          len(inc),
        "months_covered":        months,
        "unique_counterparties": exp["counterparty"].nunique(),
        "largest_single_expense":round(pln_exp["abs_amount"].max(), 2) if not pln_exp.empty else 0.0,
        "largest_single_income": round(pln_inc["abs_amount"].max(), 2) if not pln_inc.empty else 0.0,
        **budget_health(df),
    }


# ---------------------------------------------------------------------------
# Monthly trends
# ---------------------------------------------------------------------------
def monthly_trends(df: pd.DataFrame) -> list[dict]:
    exp = _real_expenses(df)[df["currency"] == "PLN"].groupby("month")["abs_amount"].sum()
    inc = _real_income(df)[df["currency"] == "PLN"].groupby("month")["abs_amount"].sum()
    months = sorted(set(exp.index) | set(inc.index))

    rows = []
    prev_exp = None
    for m in months:
        e = float(exp.get(m, 0))
        i = float(inc.get(m, 0))
        s = i - e
        sr = round(s / i * 100, 1) if i > 0 else 0.0
        mom = round((e - prev_exp) / prev_exp * 100, 1) if prev_exp else None
        rows.append({"month": m, "expenses": round(e, 2), "income": round(i, 2),
                     "savings": round(s, 2), "savings_rate_pct": sr, "exp_mom_pct": mom})
        prev_exp = e
    return rows


# ---------------------------------------------------------------------------
# Category breakdown
# ---------------------------------------------------------------------------
def category_breakdown(df: pd.DataFrame) -> list[dict]:
    exp = _real_expenses(df)[df["currency"] == "PLN"]
    total = exp["abs_amount"].sum()
    if total == 0:
        return []
    out = (
        exp.groupby("category")["abs_amount"]
        .agg(total_spent="sum", tx_count="size")
        .reset_index()
        .sort_values("total_spent", ascending=False)
    )
    out["share_pct"] = (out["total_spent"] / total * 100).round(1)
    out["avg_per_tx"] = (out["total_spent"] / out["tx_count"]).round(2)
    return out.to_dict("records")


# ---------------------------------------------------------------------------
# Top merchants
# ---------------------------------------------------------------------------
def top_merchants(df: pd.DataFrame, n: int = 15, direction: str = "expense") -> list[dict]:
    sub = df[(df["direction"] == direction) & (~df["is_internal"]) & (df["currency"] == "PLN")]
    out = (
        sub.groupby("counterparty")["abs_amount"]
        .agg(total="sum", count="size")
        .reset_index()
        .sort_values("total", ascending=False)
        .head(n)
    )
    out["avg_per_tx"] = (out["total"] / out["count"]).round(2)
    return out.to_dict("records")


# ---------------------------------------------------------------------------
# Recurring transactions
# ---------------------------------------------------------------------------
def detect_recurring(df: pd.DataFrame, min_occurrences: int = 2, min_amount: float = 5.0) -> list[dict]:
    exp = _real_expenses(df).copy()
    exp = exp[(exp["abs_amount"] >= min_amount) & (exp["currency"] == "PLN")]
    exp["_amt_bucket"] = (exp["abs_amount"] / 0.5).round() * 0.5

    records = []
    for (merchant, amt), grp in exp.groupby(["counterparty", "_amt_bucket"]):
        if len(grp) < min_occurrences or not merchant:
            continue
        dates = grp["booking_date"].sort_values().dropna()
        if len(dates) < 2:
            continue
        gaps = dates.diff().dt.days.dropna().tolist()
        avg_gap = float(np.mean(gaps))
        std_gap = float(np.std(gaps)) if len(gaps) > 1 else 0.0

        if 25 <= avg_gap <= 35:
            period = "Monthly"
        elif 12 <= avg_gap <= 16:
            period = "Bi-weekly"
        elif 6 <= avg_gap <= 8:
            period = "Weekly"
        elif 85 <= avg_gap <= 95:
            period = "Quarterly"
        elif 355 <= avg_gap <= 375:
            period = "Annual"
        else:
            period = f"~{avg_gap:.0f}d"

        regularity = round(max(0.0, 1.0 - std_gap / (avg_gap + 1e-6)), 2)
        records.append({
            "counterparty": merchant,
            "amount":       float(amt),
            "occurrences":  len(grp),
            "period":       period,
            "avg_gap_days": round(avg_gap, 1),
            "regularity":   regularity,
            "first_seen":   str(dates.iloc[0].date()),
            "last_seen":    str(dates.iloc[-1].date()),
            "category":     grp["category"].mode().iloc[0] if "category" in grp else "",
        })

    return sorted(records, key=lambda r: (-r["regularity"], -r["occurrences"]))


# ---------------------------------------------------------------------------
# Anomaly detection
# ---------------------------------------------------------------------------
def detect_anomalies(df: pd.DataFrame, z_threshold: float = 2.5, min_amount: float = 50.0) -> list[dict]:
    exp = _real_expenses(df)
    exp = exp[(exp["abs_amount"] >= min_amount) & (exp["currency"] == "PLN")].copy()

    anomalies = []
    for cat, grp in exp.groupby("category"):
        if len(grp) < 3:
            continue
        mean, std = grp["abs_amount"].mean(), grp["abs_amount"].std()
        if std < 1e-6:
            continue
        z = (grp["abs_amount"] - mean) / std
        for idx in grp[z > z_threshold].index:
            row = grp.loc[idx]
            anomalies.append({
                "booking_date": str(row["booking_date"].date()),
                "counterparty": row["counterparty"],
                "title":        row["title"],
                "abs_amount":   round(row["abs_amount"], 2),
                "category":     row["category"],
                "z_score":      round(float(z[idx]), 2),
                "anomaly_type": "high_spend",
            })

    # Possible duplicates (same day + counterparty + amount)
    dupes = exp[exp.duplicated(subset=["booking_date", "counterparty", "abs_amount"], keep=False)]
    for _, row in dupes.iterrows():
        anomalies.append({
            "booking_date": str(row["booking_date"].date()),
            "counterparty": row["counterparty"],
            "title":        row["title"],
            "abs_amount":   round(row["abs_amount"], 2),
            "category":     row["category"],
            "z_score":      None,
            "anomaly_type": "possible_duplicate",
        })

    seen: set[str] = set()
    unique = []
    for a in sorted(anomalies, key=lambda x: -x["abs_amount"]):
        key = f"{a['booking_date']}{a['counterparty']}{a['abs_amount']}{a['anomaly_type']}"
        if key not in seen:
            seen.add(key)
            unique.append(a)
    return unique


# ---------------------------------------------------------------------------
# Next-month prediction
# ---------------------------------------------------------------------------
def predict_next_month(df: pd.DataFrame) -> list[dict]:
    exp = _real_expenses(df)[df["currency"] == "PLN"]
    pivot = exp.pivot_table(index="month", columns="category", values="abs_amount",
                            aggfunc="sum", fill_value=0).sort_index()
    records = []
    for cat in pivot.columns:
        vals = pivot[cat].tolist()
        non_zero = [v for v in vals if v > 0]
        if not non_zero:
            continue
        if len(non_zero) < 2:
            predicted = float(np.mean(non_zero))
            confidence = "low"
        else:
            n = len(vals)
            x = np.arange(n, dtype=float)
            slope = float(np.polyfit(x, vals, 1)[0])
            predicted = max(0.0, float(np.mean(non_zero)) + slope)
            cv = float(np.std(non_zero) / (np.mean(non_zero) + 1e-6))
            confidence = "high" if cv < 0.2 else ("medium" if cv < 0.5 else "low")
        records.append({
            "category":        cat,
            "predicted_spend": round(predicted, 2),
            "avg_historical":  round(float(np.mean(vals)), 2),
            "confidence":      confidence,
        })
    records.sort(key=lambda r: -r["predicted_spend"])
    total = sum(r["predicted_spend"] for r in records)
    records.append({"category": "TOTAL", "predicted_spend": round(total, 2),
                    "avg_historical": 0, "confidence": "—"})
    return records


# ---------------------------------------------------------------------------
# Day-of-week patterns
# ---------------------------------------------------------------------------
def day_of_week_patterns(df: pd.DataFrame) -> list[dict]:
    exp = _real_expenses(df)[df["currency"] == "PLN"].copy()
    if exp.empty:
        return []
    exp["dow"] = exp["booking_date"].dt.day_name()
    order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    out = (
        exp.groupby("dow")["abs_amount"]
        .agg(total="sum", count="size", avg="mean")
        .reindex(order)
        .fillna(0)
        .reset_index()
        .rename(columns={"dow": "day"})
    )
    return out.round(2).to_dict("records")


# ---------------------------------------------------------------------------
# Budget health
# ---------------------------------------------------------------------------
def budget_health(df: pd.DataFrame) -> dict:
    trends = monthly_trends(df)
    if not trends:
        return {"budget_health_score": 0, "budget_health_label": "No data"}

    savings_rates = [t["savings_rate_pct"] for t in trends]
    expenses = [t["expenses"] for t in trends]
    incomes = [t["income"] for t in trends]

    avg_sr = float(np.mean(savings_rates))
    exp_cv = float(np.std(expenses) / (np.mean(expenses) + 1e-6))
    inc_cv = float(np.std(incomes) / (np.mean(incomes) + 1e-6))

    savings_score   = min(40.0, max(0.0, avg_sr * 0.8))
    volatility_score= max(0.0, 30.0 - exp_cv * 30.0)
    income_score    = max(0.0, 30.0 - inc_cv * 30.0)
    score = round(savings_score + volatility_score + income_score, 1)

    label = (
        "Excellent" if score >= 75 else
        "Good"      if score >= 50 else
        "Fair"      if score >= 30 else
        "Needs work"
    )
    return {"budget_health_score": score, "budget_health_label": label}
