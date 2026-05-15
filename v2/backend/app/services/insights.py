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

import re
import numpy as np
import pandas as pd
from datetime import date
from collections import defaultdict


_FALLBACK_RATE = 4.0  # PLN per USD when no FX data available


def _implied_fx_rate(df: pd.DataFrame) -> float:
    """Derive PLN/USD rate from FX pairs already in the dataset."""
    fx = df[df["title"].str.contains("wymiana walut", case=False, na=False)]
    pln_in  = float(fx[(fx["currency"] == "PLN") & (fx["amount"] > 0)]["abs_amount"].sum())
    usd_out = float(fx[(fx["currency"] == "USD") & (fx["amount"] < 0)]["abs_amount"].sum())
    return round(pln_in / usd_out, 4) if usd_out > 0 else _FALLBACK_RATE


def _real_expenses(df: pd.DataFrame) -> pd.DataFrame:
    return df[(df["direction"] == "expense") & (~df["is_internal"])].copy()


def _real_income(df: pd.DataFrame) -> pd.DataFrame:
    return df[(df["direction"] == "income") & (~df["is_internal"])].copy()


def _pln_expenses(df: pd.DataFrame) -> pd.DataFrame:
    exp = _real_expenses(df)
    return exp[exp["currency"] == "PLN"]


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
def summary(df: pd.DataFrame) -> dict:
    exp = _real_expenses(df)
    inc = _real_income(df)
    pln_exp = exp[exp["currency"] == "PLN"]
    pln_inc = inc[inc["currency"] == "PLN"]
    usd_inc = inc[inc["currency"] == "USD"]
    months = df[~df["is_internal"]]["month"].nunique() or 1

    rate = _implied_fx_rate(df)
    usd_total_usd = float(usd_inc["abs_amount"].sum())
    usd_as_pln    = round(usd_total_usd * rate, 2)

    total_exp = float(pln_exp["abs_amount"].sum())
    total_inc = float(pln_inc["abs_amount"].sum()) + usd_as_pln
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
        "usd_salary_total":      round(usd_total_usd, 2),
        "usd_salary_pln_equiv":  usd_as_pln,
        "implied_fx_rate":       rate,
        **budget_health(df),
    }


# ---------------------------------------------------------------------------
# Monthly trends
# ---------------------------------------------------------------------------
def monthly_trends(df: pd.DataFrame) -> list[dict]:
    rate = _implied_fx_rate(df)
    _exp = _real_expenses(df)
    _inc = _real_income(df)

    pln_exp = _exp[_exp["currency"] == "PLN"].groupby("month")["abs_amount"].sum()
    pln_inc = _inc[_inc["currency"] == "PLN"].groupby("month")["abs_amount"].sum()
    usd_inc = (_inc[_inc["currency"] == "USD"].groupby("month")["abs_amount"].sum() * rate)

    months = sorted(set(pln_exp.index) | set(pln_inc.index) | set(usd_inc.index))

    rows = []
    prev_exp = None
    for m in months:
        e = float(pln_exp.get(m, 0))
        i = float(pln_inc.get(m, 0)) + float(usd_inc.get(m, 0))
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
def _amount_bucket(a: float) -> float:
    """Tiered bucketing so variable-amount recurring items (e.g. tax) still group."""
    if a < 50:    return round(a / 0.5) * 0.5
    if a < 200:   return round(a / 5)   * 5
    if a < 1000:  return (a // 100) * 100   # floor: ±100 PLN tolerance keeps price variations together
    return             round(a / 500)   * 500  # ±250 PLN tolerance separates distinct large bills


def _period_label(avg_gap: float) -> str | None:
    if 25 <= avg_gap <= 35:   return "Monthly"
    if 12 <= avg_gap <= 16:   return "Bi-weekly"
    if 6  <= avg_gap <= 8:    return "Weekly"
    if 85 <= avg_gap <= 95:   return "Quarterly"
    if 355 <= avg_gap <= 375: return "Annual"
    return None


# Strips dates, reference numbers, and other per-occurrence variable parts from titles.
_DATE_PATTERNS = re.compile(
    r'\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b'  # DD.MM.YYYY / DD-MM-YY
    r'|\b\d{1,2}[./]\d{4}\b'                  # MM/YYYY
    r'|\b\d{4}[-/]\d{2}\b'                    # YYYY-MM
    r'|\b\d{8,}\b'                             # long reference numbers
)


def _title_key(title: str) -> str:
    t = _DATE_PATTERNS.sub('', str(title).lower())
    return re.sub(r'\s+', ' ', t).strip()[:50]


def _recurring_entry(grp: pd.DataFrame, cp: str, dates: pd.Series,
                     gaps: list[float]) -> dict:
    avg_gap = float(np.mean(gaps))
    std_gap = float(np.std(gaps)) if len(gaps) > 1 else 0.0
    return {
        "counterparty": cp,
        "amount":       round(float(grp["abs_amount"].median()), 2),
        "amount_min":   round(float(grp["abs_amount"].min()), 2),
        "amount_max":   round(float(grp["abs_amount"].max()), 2),
        "occurrences":  len(grp),
        "period":       _period_label(avg_gap) or f"~{avg_gap:.0f}d",
        "avg_gap_days": round(avg_gap, 1),
        "regularity":   round(max(0.0, 1.0 - std_gap / (avg_gap + 1e-6)), 2),
        "first_seen":   str(dates.iloc[0].date()),
        "last_seen":    str(dates.iloc[-1].date()),
        "category":     grp["category"].mode().iloc[0] if not grp.empty else "",
    }


def detect_recurring(df: pd.DataFrame, min_occurrences: int = 2, min_amount: float = 5.0) -> list[dict]:
    exp = _real_expenses(df).copy()
    exp = exp[(exp["abs_amount"] >= min_amount) & (exp["currency"] == "PLN")]
    exp["_title_key"] = exp["title"].fillna("").apply(_title_key)

    records = []
    seen_idx: set[int] = set()
    all_months_n = max(1, exp["month"].nunique())
    # Cap at 3: avoids requiring 4+ months for large datasets while staying strict enough
    min_months = max(2, min(3, int(all_months_n * 0.4)))

    # Pass 1 — group by (counterparty, normalised title).
    # Strips dates/refs from the title so "ZUS 01/2025" and "ZUS 02/2025" cluster
    # together, while "ZUS SPOŁECZNE" and "ZUS ZDROWOTNE" stay separate.
    # When a group straddles the 1 000 PLN boundary (payment-gateway entries that
    # carry multiple distinct bills, e.g. AUTOPAY BLIK), sub-split by amount bucket
    # so each bill gets its own recurring entry.
    for (cp, tkey), grp in exp.groupby(["counterparty", "_title_key"]):
        if not cp or len(grp) < min_occurrences:
            continue

        # Sub-split by amount bucket only for payment-gateway groups whose amounts
        # span both sub-1 000 and 1 000+ PLN tiers (distinct bills, not price variation).
        if grp["abs_amount"].max() >= 1000 and grp["abs_amount"].min() < 1000:
            sub_groups = list(grp.groupby(grp["abs_amount"].apply(_amount_bucket)))
        else:
            sub_groups = [(None, grp)]

        for _bk, sgrp in sub_groups:
            if len(sgrp) < min_occurrences:
                continue
            if sgrp["month"].nunique() < min_months:
                continue
            dates = sgrp["booking_date"].sort_values().dropna()
            if len(dates) < 2:
                continue
            gaps = dates.diff().dt.days.dropna().tolist()
            if not gaps:
                continue
            entry = _recurring_entry(sgrp, cp, dates, gaps)
            if _period_label(float(np.mean(gaps))) is None and float(np.mean(gaps)) > 40:
                continue  # skip clearly irregular
            records.append(entry)
            seen_idx.update(sgrp.index.tolist())

    # Pass 2 — fallback for transactions not captured above (blank/generic titles).
    # Group solely by counterparty; require monthly cadence and coverage.
    for cp, grp in exp.groupby("counterparty"):
        if not cp:
            continue
        unc = grp[~grp.index.isin(seen_idx)]
        if len(unc) < min_occurrences:
            continue
        if unc["month"].nunique() < min_months:
            continue
        dates = unc["booking_date"].sort_values().dropna()
        if len(dates) < 2:
            continue
        gaps = dates.diff().dt.days.dropna().tolist()
        if not gaps:
            continue
        avg_gap = float(np.mean(gaps))
        if _period_label(avg_gap) is None:
            continue
        records.append(_recurring_entry(unc, cp, dates, gaps))

    # Deduplicate name variants: same merchant registered under slightly different
    # counterparty strings (e.g. "IMPLANT ART SP Z OO 00670 WARSZA" vs
    # "IMPLANT ART WARSZAWA").  Key on first 10 chars after whitespace collapse +
    # category + amount bucket — tight enough to avoid merging different merchants.
    def _dedup_key(r: dict) -> tuple:
        cp = re.sub(r'\s+', ' ', r["counterparty"]).strip()[:10].lower()
        return (cp, r["category"], _amount_bucket(r["amount"]))

    seen_keys: dict[tuple, int] = {}  # key → index in deduped
    deduped: list[dict] = []
    for r in sorted(records, key=lambda r: (-r["regularity"], -r["occurrences"])):
        key = _dedup_key(r)
        if key not in seen_keys:
            seen_keys[key] = len(deduped)
            deduped.append(r)
        # else: discard the variant with fewer occurrences (already sorted lower)

    return deduped


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
    months_index = list(pivot.index)
    records = []
    for cat in pivot.columns:
        vals = pivot[cat].tolist()
        non_zero = [v for v in vals if v > 0]
        if not non_zero:
            continue

        avg = float(np.mean(non_zero))
        last_month_actual = float(vals[-1]) if vals else 0.0
        months_observed = len(non_zero)

        # per-month history for sparkline (last 6 months)
        history = [
            {"month": m, "amount": round(float(v), 2)}
            for m, v in zip(months_index, vals)
        ][-6:]

        if len(non_zero) < 2:
            predicted = avg
            slope = 0.0
            cv = 0.0
            confidence = "low"
            range_low = predicted
            range_high = predicted
        else:
            n = len(vals)
            x = np.arange(n, dtype=float)
            slope = float(np.polyfit(x, vals, 1)[0])
            predicted = max(0.0, avg + slope)
            cv = float(np.std(non_zero) / (avg + 1e-6))
            confidence = "high" if cv < 0.2 else ("medium" if cv < 0.5 else "low")
            std = float(np.std(non_zero))
            range_low  = max(0.0, predicted - std)
            range_high = predicted + std

        # trend: slope as % of mean, bucketed
        trend_pct = round(slope / (avg + 1e-6) * 100, 1)
        if trend_pct > 5:
            trend_direction = "up"
        elif trend_pct < -5:
            trend_direction = "down"
        else:
            trend_direction = "stable"

        delta_vs_last = round(predicted - last_month_actual, 2)

        records.append({
            "category":           cat,
            "predicted_spend":    round(predicted, 2),
            "avg_historical":     round(avg, 2),
            "confidence":         confidence,
            "cv":                 round(cv, 3),
            "last_month_actual":  round(last_month_actual, 2),
            "delta_vs_last":      delta_vs_last,
            "trend_direction":    trend_direction,
            "trend_pct":          trend_pct,
            "range_low":          round(range_low, 2),
            "range_high":         round(range_high, 2),
            "months_observed":    months_observed,
            "history":            history,
        })

    records.sort(key=lambda r: -r["predicted_spend"])
    total_predicted   = sum(r["predicted_spend"] for r in records)
    total_last_month  = sum(r["last_month_actual"] for r in records)
    records.append({
        "category":           "TOTAL",
        "predicted_spend":    round(total_predicted, 2),
        "avg_historical":     0,
        "confidence":         "—",
        "cv":                 0,
        "last_month_actual":  round(total_last_month, 2),
        "delta_vs_last":      round(total_predicted - total_last_month, 2),
        "trend_direction":    "stable",
        "trend_pct":          0,
        "range_low":          0,
        "range_high":         0,
        "months_observed":    0,
        "history":            [],
    })
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
# Spend velocity (current month projection)
# ---------------------------------------------------------------------------
def spend_velocity(df: pd.DataFrame) -> dict:
    """How far into the month are we, and what's the EOM projection?"""
    _exp = _real_expenses(df)
    exp = _exp[_exp["currency"] == "PLN"].copy()
    if exp.empty:
        return {}

    today = pd.Timestamp.today().normalize()
    current_month = today.strftime("%Y-%m")

    current = exp[exp["month"] == current_month]
    prior = exp[exp["month"] != current_month]

    if current.empty:
        return {"current_month": current_month, "has_current_data": False}

    days_elapsed = (today - today.replace(day=1)).days + 1
    days_in_month = today.days_in_month
    day_pct = days_elapsed / days_in_month

    spent_so_far = float(current["abs_amount"].sum())

    # Split current spend into fixed bills vs variable daily spending.
    # Fixed bills are one-shots that won't repeat linearly; only project variable.
    FIXED_CATS = {"Subscriptions", "Rent & Housing", "Utilities", "Healthcare",
                  "Accounting", "Insurance", "Education", "Phone & Internet", "Taxes"}
    recurring_items = detect_recurring(df)
    monthly_recurring = [r for r in recurring_items if r["period"] in {"Monthly", "Bi-weekly"}]
    paid_cps = set(current["counterparty"].str.lower())

    # Bills paid so far this month that are fixed-category recurring items
    rec_cps_lower = {r["counterparty"].lower() for r in monthly_recurring}
    current["_fixed"] = (
        current["category"].isin(FIXED_CATS) |
        current["counterparty"].str.lower().isin(rec_cps_lower)
    )
    fixed_paid   = float(current[current["_fixed"]]["abs_amount"].sum())
    variable_paid = float(current[~current["_fixed"]]["abs_amount"].sum())

    # Expected fixed bills not yet paid this month
    expected_fixed = sum(
        r["amount"] for r in monthly_recurring
        if r["category"] in FIXED_CATS and r["counterparty"].lower() not in paid_cps
    )

    # Project only variable spend linearly; add known fixed obligations
    variable_projected = (variable_paid / day_pct) if day_pct > 0 else 0.0
    projected_eom = round(fixed_paid + expected_fixed + variable_projected, 2)

    avg_prior = float(prior.groupby("month")["abs_amount"].sum().mean()) if not prior.empty else 0.0
    vs_avg_pct = round((projected_eom - avg_prior) / avg_prior * 100, 1) if avg_prior > 0 else None

    return {
        "current_month":    current_month,
        "has_current_data": True,
        "spent_so_far":     round(spent_so_far, 2),
        "projected_eom":    projected_eom,
        "days_elapsed":     days_elapsed,
        "days_in_month":    days_in_month,
        "day_pct":          round(day_pct * 100, 1),
        "avg_prior_months": round(avg_prior, 2),
        "vs_avg_pct":       vs_avg_pct,
    }


# ---------------------------------------------------------------------------
# Category MoM deltas
# ---------------------------------------------------------------------------
def category_deltas(df: pd.DataFrame) -> list[dict]:
    """For each category: last month spend, prior month spend, absolute and % delta."""
    exp = _real_expenses(df)[df["currency"] == "PLN"]
    months = sorted(exp["month"].unique())
    if len(months) < 2:
        return []

    last, prev = months[-1], months[-2]
    last_data = exp[exp["month"] == last].groupby("category")["abs_amount"].sum()
    prev_data = exp[exp["month"] == prev].groupby("category")["abs_amount"].sum()
    all_cats = sorted(set(last_data.index) | set(prev_data.index))

    records = []
    for cat in all_cats:
        l = float(last_data.get(cat, 0))
        p = float(prev_data.get(cat, 0))
        delta = l - p
        delta_pct = round(delta / p * 100, 1) if p > 0 else None
        records.append({
            "category":   cat,
            "last_month": round(l, 2),
            "prev_month": round(p, 2),
            "delta":      round(delta, 2),
            "delta_pct":  delta_pct,
            "last_month_label": last,
            "prev_month_label": prev,
        })

    records.sort(key=lambda r: -abs(r["delta"]))
    return records


# ---------------------------------------------------------------------------
# Income sources
# ---------------------------------------------------------------------------
def income_sources(df: pd.DataFrame) -> list[dict]:
    inc = _real_income(df)
    if inc.empty:
        return []

    rate = _implied_fx_rate(df)

    # Convert everything to PLN equivalent for ranking
    inc = inc.copy()
    inc["pln_equiv"] = inc.apply(
        lambda r: r["abs_amount"] * rate if r["currency"] == "USD" else r["abs_amount"],
        axis=1,
    )

    total = float(inc["pln_equiv"].sum())
    out = (
        inc.groupby("counterparty")
        .agg(
            total_received=("pln_equiv", "sum"),
            tx_count=("pln_equiv", "size"),
            currency=("currency", "first"),
        )
        .reset_index()
        .sort_values("total_received", ascending=False)
    )
    out["share_pct"] = (out["total_received"] / total * 100).round(1)
    out["avg_per_tx"] = (out["total_received"] / out["tx_count"]).round(2)
    return out.to_dict("records")


# ---------------------------------------------------------------------------
# Business vs personal split
# ---------------------------------------------------------------------------
BUSINESS_CATEGORIES = {"Accounting", "Banking Fees"}


def business_vs_personal(df: pd.DataFrame) -> dict:
    exp = _real_expenses(df)[df["currency"] == "PLN"]
    if exp.empty:
        return {}
    total = float(exp["abs_amount"].sum())
    biz = float(exp[exp["category"].isin(BUSINESS_CATEGORIES)]["abs_amount"].sum())
    personal = total - biz
    months = df[~df["is_internal"]]["month"].nunique() or 1
    return {
        "total_expenses":       round(total, 2),
        "business_expenses":    round(biz, 2),
        "personal_expenses":    round(personal, 2),
        "business_pct":         round(biz / total * 100, 1) if total > 0 else 0.0,
        "personal_pct":         round(personal / total * 100, 1) if total > 0 else 0.0,
        "avg_monthly_business": round(biz / months, 2),
        "avg_monthly_personal": round(personal / months, 2),
        "business_categories":  sorted(BUSINESS_CATEGORIES),
    }


# ---------------------------------------------------------------------------
# Category trends (per-category monthly series for sparklines)
# ---------------------------------------------------------------------------
def category_trends(df: pd.DataFrame) -> list[dict]:
    exp = _real_expenses(df)[df["currency"] == "PLN"]
    pivot = (
        exp.pivot_table(index="month", columns="category", values="abs_amount",
                        aggfunc="sum", fill_value=0)
        .sort_index()
    )
    months = pivot.index.tolist()
    records = []
    for cat in pivot.columns:
        vals = [round(float(v), 2) for v in pivot[cat]]
        non_zero = [v for v in vals if v > 0]
        if not non_zero:
            continue
        trend_dir = "up" if len(vals) >= 2 and vals[-1] > vals[-2] else "down" if len(vals) >= 2 and vals[-1] < vals[-2] else "flat"
        records.append({
            "category":  cat,
            "months":    months,
            "values":    vals,
            "avg":       round(float(np.mean(non_zero)), 2),
            "trend":     trend_dir,
        })
    records.sort(key=lambda r: -r["avg"])
    return records


# ---------------------------------------------------------------------------
# New merchants this month (counterparties seen for the first time)
# ---------------------------------------------------------------------------
def new_merchants_this_month(df: pd.DataFrame) -> list[dict]:
    exp = _real_expenses(df)
    exp = exp[exp["currency"] == "PLN"].copy()
    if exp.empty:
        return []

    current_month = pd.Timestamp.today().strftime("%Y-%m")
    first_seen = exp.groupby("counterparty")["booking_date"].min()
    new_cps = first_seen[first_seen.dt.strftime("%Y-%m") == current_month].index

    if new_cps.empty:
        return []

    new_txs = exp[exp["counterparty"].isin(new_cps) & (exp["month"] == current_month)]
    out = (
        new_txs.groupby("counterparty")
        .agg(
            total=("abs_amount", "sum"),
            count=("abs_amount", "size"),
            category=("category", lambda x: x.mode().iloc[0] if len(x) > 0 else ""),
            first_seen=("booking_date", "min"),
        )
        .reset_index()
        .sort_values("total", ascending=False)
    )
    out["first_seen"] = out["first_seen"].dt.strftime("%Y-%m-%d")
    return out.to_dict("records")


# ---------------------------------------------------------------------------
# Top individual transactions (biggest single expenses)
# ---------------------------------------------------------------------------
def top_transactions(df: pd.DataFrame, n: int = 10) -> list[dict]:
    exp = _real_expenses(df)
    exp = exp[exp["currency"] == "PLN"].copy()
    if exp.empty:
        return []
    top = exp.nlargest(n, "abs_amount")[
        ["booking_date", "counterparty", "title", "abs_amount", "category", "month"]
    ].copy()
    top["booking_date"] = top["booking_date"].dt.strftime("%Y-%m-%d")
    return top.to_dict("records")


# ---------------------------------------------------------------------------
# Recurring cost summary (total monthly committed spend)
# ---------------------------------------------------------------------------
def recurring_summary(df: pd.DataFrame) -> dict:
    items = detect_recurring(df)

    # Drop monthly/bi-weekly entries not seen in the last 75 days — these are
    # superseded rates (e.g. old ZUS tier) that are no longer active.
    cutoff = (pd.Timestamp.today() - pd.Timedelta(days=75)).date()
    active_periods = {"Monthly", "Bi-weekly"}
    items = [
        r for r in items
        if r["period"] not in active_periods
        or date.fromisoformat(r["last_seen"]) >= cutoff
    ]

    monthly_items = [r for r in items if r["period"] == "Monthly"]
    biweekly_items = [r for r in items if r["period"] == "Bi-weekly"]

    # Normalize to monthly equivalent
    monthly_total = sum(r["amount"] for r in monthly_items)
    biweekly_total = sum(r["amount"] * 2 for r in biweekly_items)  # ~2x per month
    total = round(monthly_total + biweekly_total, 2)

    # All items sorted by amount desc (with monthly-equivalent amount)
    all_items = []
    for r in items:
        monthly_equiv = r["amount"] * 2 if r["period"] == "Bi-weekly" else r["amount"]
        all_items.append({**r, "monthly_equiv": round(monthly_equiv, 2)})
    all_items.sort(key=lambda x: -x["monthly_equiv"])

    return {
        "total_monthly_recurring": total,
        "item_count": len(items),
        "items": all_items,
    }


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


def monthly_breakdown(df: pd.DataFrame) -> list[dict]:
    rate = _implied_fx_rate(df)
    exp = _real_expenses(df)
    inc = _real_income(df)

    recurring_items = detect_recurring(df)
    recurring_cps = {r["counterparty"].lower() for r in recurring_items}

    pln_exp = exp[exp["currency"] == "PLN"].copy()
    pln_exp["is_recurring"] = pln_exp["counterparty"].str.lower().isin(recurring_cps)

    rec_by_month = pln_exp[pln_exp["is_recurring"]].groupby("month")["abs_amount"].sum()
    var_by_month = pln_exp[~pln_exp["is_recurring"]].groupby("month")["abs_amount"].sum()

    pln_inc = inc[inc["currency"] == "PLN"].groupby("month")["abs_amount"].sum()
    usd_inc = (inc[inc["currency"] == "USD"].groupby("month")["abs_amount"].sum() * rate)

    months = sorted(set(pln_exp["month"]) | set(pln_inc.index) | set(usd_inc.index))

    rows = []
    for m in months:
        recurring = round(float(rec_by_month.get(m, 0)), 2)
        variable = round(float(var_by_month.get(m, 0)), 2)
        income = round(float(pln_inc.get(m, 0)) + float(usd_inc.get(m, 0)), 2)
        net = round(income - recurring - variable, 2)
        rows.append({"month": m, "income": income, "recurring": recurring, "variable": variable, "net": net})
    return rows


def daily_spend_by_category(df: pd.DataFrame, month: str, top_n: int = 6) -> dict:
    exp = _real_expenses(df)
    exp = exp[(exp["month"] == month) & (exp["currency"] == "PLN")].copy()

    if exp.empty:
        return {"categories": [], "days": []}

    cat_totals = exp.groupby("category")["abs_amount"].sum().sort_values(ascending=False)
    top_cats = cat_totals.head(top_n).index.tolist()

    exp["_cat"] = exp["category"].apply(lambda c: c if c in top_cats else "Other")

    daily = exp.groupby(["booking_date", "_cat"])["abs_amount"].sum().reset_index()
    pivot = daily.pivot(index="booking_date", columns="_cat", values="abs_amount").fillna(0)
    pivot.index = pd.to_datetime(pivot.index).strftime("%Y-%m-%d")

    month_start = pd.Timestamp(month + "-01")
    month_end = month_start + pd.offsets.MonthEnd(0)
    all_days = pd.date_range(month_start, month_end, freq="D").strftime("%Y-%m-%d")
    pivot = pivot.reindex(all_days, fill_value=0)

    ordered_cats = [c for c in top_cats if c in pivot.columns]
    if "Other" in pivot.columns:
        ordered_cats.append("Other")

    pivot = pivot[ordered_cats].round(0)

    days = [{"date": date, **{c: float(row[c]) for c in ordered_cats}} for date, row in pivot.iterrows()]

    return {"categories": ordered_cats, "days": days}
