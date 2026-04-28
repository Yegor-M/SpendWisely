"""
bank_insights.py
================
Derives rich insights from an enriched bank DataFrame:
  - Monthly / category summaries
  - Top merchants, trends, anomalies
  - Pattern detection (recurring, seasonal)
  - Next-month spend prediction (linear + seasonal model)
  - Formatted text report

Usage
-----
    from bank_insights import BankInsights

    df = pd.read_parquet("output/enriched.parquet")
    ins = BankInsights(df)

    print(ins.summary())
    print(ins.monthly_pivot())
    print(ins.top_merchants())
    print(ins.detect_recurring())
    print(ins.predict_next_month())
    ins.full_report()
    ins.save_report("output/report.txt")
"""

from __future__ import annotations

import math
import re
import warnings
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=FutureWarning)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_cols(df: pd.DataFrame, *cols: str) -> None:
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise ValueError(f"DataFrame is missing required columns: {missing}")


def _expenses(df: pd.DataFrame) -> pd.DataFrame:
    return df[df["direction"] == "expense"].copy()


def _income(df: pd.DataFrame) -> pd.DataFrame:
    return df[df["direction"] == "income"].copy()


# ---------------------------------------------------------------------------
# Prediction models (no scikit-learn dependency)
# ---------------------------------------------------------------------------

def _linear_trend(values: list[float]) -> tuple[float, float]:
    """Ordinary least squares on 1-D index. Returns (slope, intercept)."""
    n = len(values)
    if n < 2:
        return 0.0, values[0] if values else 0.0
    x = np.arange(n, dtype=float)
    y = np.array(values, dtype=float)
    x_mean, y_mean = x.mean(), y.mean()
    slope = np.dot(x - x_mean, y - y_mean) / (np.dot(x - x_mean, x - x_mean) + 1e-12)
    intercept = y_mean - slope * x_mean
    return float(slope), float(intercept)


def _seasonal_decompose_simple(values: list[float], period: int = 12) -> dict:
    """
    Very simple seasonal decomposition without statsmodels:
    trend (linear), seasonal indices (avg deviation from trend), residual.
    Returns dict with keys: trend, seasonal_indices, next_value.
    """
    n = len(values)
    slope, intercept = _linear_trend(values)
    trend = [intercept + slope * i for i in range(n)]
    detrended = [values[i] - trend[i] for i in range(n)]

    # Seasonal indices by position in cycle
    seasonal_sums: dict[int, list[float]] = defaultdict(list)
    for i, v in enumerate(detrended):
        seasonal_sums[i % period].append(v)
    seasonal_indices = {k: np.mean(v) for k, v in seasonal_sums.items()}

    # Predict next step
    next_trend = intercept + slope * n
    next_seasonal = seasonal_indices.get(n % period, 0.0)
    next_value = next_trend + next_seasonal

    return {
        "trend_slope": slope,
        "trend_intercept": intercept,
        "seasonal_indices": seasonal_indices,
        "next_value": next_value,
    }


# ---------------------------------------------------------------------------
# Core insights class
# ---------------------------------------------------------------------------

@dataclass
class BankInsights:
    """
    Rich insights from a categorised bank DataFrame.

    Parameters
    ----------
    df       : enriched DataFrame from BankEnricher (must have 'direction',
               'amount', 'abs_amount', 'category', 'booking_date', 'month').
    currency : Override currency label (default: auto-detected from data).
    """

    df: pd.DataFrame
    currency: str = field(default="")

    def __post_init__(self):
        _require_cols(self.df, "direction", "amount", "abs_amount", "booking_date")
        if not self.currency:
            if "currency" in self.df.columns:
                mode = self.df["currency"].dropna().mode()
                self.currency = mode.iloc[0] if not mode.empty else "PLN"
            else:
                self.currency = "PLN"

        # Ensure month col
        if "month" not in self.df.columns:
            self.df = self.df.copy()
            self.df["month"] = self.df["booking_date"].dt.to_period("M").astype(str)

        if "category" not in self.df.columns:
            self.df = self.df.copy()
            self.df["category"] = "Uncategorized"

    # ------------------------------------------------------------------
    # 1. Summary statistics
    # ------------------------------------------------------------------

    def summary(self) -> pd.Series:
        """High-level overview: totals, averages, counts."""
        exp = _expenses(self.df)
        inc = _income(self.df)
        months = self.df["month"].nunique()

        data = {
            "total_income":            inc["abs_amount"].sum(),
            "total_expenses":          exp["abs_amount"].sum(),
            "net_balance":             inc["abs_amount"].sum() - exp["abs_amount"].sum(),
            "avg_monthly_income":      inc["abs_amount"].sum() / max(months, 1),
            "avg_monthly_expenses":    exp["abs_amount"].sum() / max(months, 1),
            "transaction_count":       len(self.df),
            "expense_count":           len(exp),
            "income_count":            len(inc),
            "months_covered":          months,
            "unique_categories":       exp["category"].nunique(),
            "unique_counterparties":   self.df["counterparty"].nunique(),
            "largest_single_expense":  exp["abs_amount"].max() if not exp.empty else 0.0,
            "largest_single_income":   inc["abs_amount"].max() if not inc.empty else 0.0,
        }
        return pd.Series(data)

    # ------------------------------------------------------------------
    # 2. Monthly pivot table
    # ------------------------------------------------------------------

    def monthly_pivot(self, fill_zeros: bool = True) -> pd.DataFrame:
        """
        Pivot: rows = month, columns = category, values = total spent (positive).
        Appends TOTAL_EXPENSES and TOTAL_INCOME rows.
        """
        exp = _expenses(self.df).copy()
        exp["spent"] = exp["abs_amount"]

        pivot = (
            exp.pivot_table(
                index="month",
                columns="category",
                values="spent",
                aggfunc="sum",
                fill_value=0.0 if fill_zeros else np.nan,
            )
            .sort_index()
        )

        # Add total expenses and income side-by-side
        pivot.insert(0, "__TOTAL_EXPENSES", exp.groupby("month")["spent"].sum())
        pivot.insert(
            1,
            "__TOTAL_INCOME",
            _income(self.df).groupby("month")["abs_amount"].sum(),
        )
        pivot = pivot.fillna(0.0)
        pivot.columns.name = None
        return pivot

    # ------------------------------------------------------------------
    # 3. Category breakdown
    # ------------------------------------------------------------------

    def category_breakdown(self, top_n: Optional[int] = None) -> pd.DataFrame:
        """Total and share per category, sorted by spend descending."""
        exp = _expenses(self.df)
        total = exp["abs_amount"].sum()

        out = (
            exp.groupby("category")["abs_amount"]
            .agg(total_spent="sum", tx_count="size")
            .reset_index()
            .sort_values("total_spent", ascending=False)
        )
        out["share_pct"] = (out["total_spent"] / total * 100).round(1)
        out["avg_per_tx"] = (out["total_spent"] / out["tx_count"]).round(2)
        if top_n:
            out = out.head(top_n)
        return out.reset_index(drop=True)

    # ------------------------------------------------------------------
    # 4. Top merchants
    # ------------------------------------------------------------------

    def top_merchants(self, n: int = 15, direction: str = "expense") -> pd.DataFrame:
        """Top counterparties by total absolute amount."""
        sub = self.df[self.df["direction"] == direction].copy()
        out = (
            sub.groupby("counterparty")["abs_amount"]
            .agg(total="sum", count="size")
            .reset_index()
            .sort_values("total", ascending=False)
            .head(n)
            .reset_index(drop=True)
        )
        out["avg_per_tx"] = (out["total"] / out["count"]).round(2)
        return out

    # ------------------------------------------------------------------
    # 5. Recurring transactions
    # ------------------------------------------------------------------

    def detect_recurring(
        self,
        min_occurrences: int = 2,
        tolerance_days: int = 5,
        min_amount: float = 5.0,
    ) -> pd.DataFrame:
        """
        Identify recurring transactions by grouping on (counterparty, approximate_amount).
        Returns DataFrame with pattern details and regularity score.
        """
        exp = _expenses(self.df).copy()
        exp = exp[exp["abs_amount"] >= min_amount].sort_values("booking_date")

        # Round amount to nearest 0.50 to handle tiny variations
        exp["_amt_bucket"] = (exp["abs_amount"] / 0.5).round() * 0.5

        groups = exp.groupby(["counterparty", "_amt_bucket"])
        records = []

        for (merchant, amt), grp in groups:
            if len(grp) < min_occurrences:
                continue
            dates = grp["booking_date"].sort_values().dropna()
            if len(dates) < 2:
                continue

            gaps = dates.diff().dt.days.dropna().tolist()
            avg_gap = float(np.mean(gaps))
            std_gap = float(np.std(gaps)) if len(gaps) > 1 else 0.0

            # Classify period
            if 25 <= avg_gap <= 35:
                period = "Monthly"
            elif 12 <= avg_gap <= 16:
                period = "Bi-weekly"
            elif 6 <= avg_gap <= 8:
                period = "Weekly"
            elif 85 <= avg_gap <= 95:
                period = "Quarterly"
            elif 360 <= avg_gap <= 370:
                period = "Annual"
            else:
                period = f"~{avg_gap:.0f} days"

            regularity = max(0.0, 1.0 - std_gap / (avg_gap + 1e-6))

            records.append({
                "counterparty":   merchant,
                "amount":         amt,
                "occurrences":    len(grp),
                "period":         period,
                "avg_gap_days":   round(avg_gap, 1),
                "regularity":     round(regularity, 2),  # 1.0 = perfectly regular
                "first_seen":     dates.iloc[0].date(),
                "last_seen":      dates.iloc[-1].date(),
                "category":       grp["category"].mode().iloc[0] if "category" in grp else "",
            })

        if not records:
            return pd.DataFrame()

        return (
            pd.DataFrame(records)
            .sort_values(["regularity", "occurrences"], ascending=False)
            .reset_index(drop=True)
        )

    # ------------------------------------------------------------------
    # 6. Anomaly detection
    # ------------------------------------------------------------------

    def detect_anomalies(
        self,
        z_threshold: float = 2.5,
        min_amount: float = 50.0,
    ) -> pd.DataFrame:
        """
        Flag transactions that are unusually large for their category
        (z-score above threshold). Also flags duplicate same-day/same-amount pairs.
        """
        exp = _expenses(self.df).copy()
        exp = exp[exp["abs_amount"] >= min_amount]

        anomalies = []

        # Z-score within category
        for cat, grp in exp.groupby("category"):
            if len(grp) < 3:
                continue
            mean = grp["abs_amount"].mean()
            std = grp["abs_amount"].std()
            if std < 1e-6:
                continue
            z = (grp["abs_amount"] - mean) / std
            outliers = grp[z > z_threshold].copy()
            outliers["anomaly_type"] = "high_spend"
            outliers["z_score"] = z[outliers.index].round(2)
            anomalies.append(outliers)

        # Duplicate detection (same counterparty, same amount, same day)
        dupes = exp[
            exp.duplicated(subset=["booking_date", "counterparty", "abs_amount"], keep=False)
        ].copy()
        dupes["anomaly_type"] = "possible_duplicate"
        dupes["z_score"] = np.nan
        anomalies.append(dupes)

        if not anomalies:
            return pd.DataFrame()

        result = pd.concat(anomalies).drop_duplicates().sort_values("abs_amount", ascending=False)
        return result[["booking_date", "counterparty", "title", "abs_amount", "category",
                        "anomaly_type", "z_score"]].reset_index(drop=True)

    # ------------------------------------------------------------------
    # 7. Trend analysis
    # ------------------------------------------------------------------

    def monthly_trends(self) -> pd.DataFrame:
        """
        Month-over-month change and rolling average for total expenses and income.
        """
        exp = _expenses(self.df).groupby("month")["abs_amount"].sum().rename("expenses")
        inc = _income(self.df).groupby("month")["abs_amount"].sum().rename("income")
        df = pd.concat([exp, inc], axis=1).fillna(0).sort_index()

        df["savings"] = df["income"] - df["expenses"]
        df["savings_rate_pct"] = (df["savings"] / df["income"].replace(0, np.nan) * 100).round(1)
        df["exp_mom_change_pct"] = df["expenses"].pct_change() * 100
        df["exp_rolling3"] = df["expenses"].rolling(3, min_periods=1).mean()

        return df.reset_index()

    # ------------------------------------------------------------------
    # 8. Category trend (month × category heatmap data)
    # ------------------------------------------------------------------

    def category_trend(self, top_n: int = 8) -> pd.DataFrame:
        """Long-format month × category spend for top N categories."""
        top_cats = (
            _expenses(self.df)
            .groupby("category")["abs_amount"]
            .sum()
            .nlargest(top_n)
            .index.tolist()
        )
        exp = _expenses(self.df).copy()
        exp = exp[exp["category"].isin(top_cats)]
        out = (
            exp.groupby(["month", "category"])["abs_amount"]
            .sum()
            .reset_index()
            .sort_values(["month", "abs_amount"], ascending=[True, False])
        )
        return out

    # ------------------------------------------------------------------
    # 9. Prediction
    # ------------------------------------------------------------------

    def predict_next_month(self) -> pd.DataFrame:
        """
        Predict next month's spend per category using linear trend + simple seasonality.
        Returns DataFrame with category, predicted_spend, confidence (low/medium/high).
        """
        pivot = self.monthly_pivot()
        # Drop meta columns
        cat_cols = [c for c in pivot.columns if not c.startswith("__")]
        months = pivot.index.tolist()
        n_months = len(months)

        records = []
        for cat in cat_cols:
            values = pivot[cat].tolist()
            non_zero = [v for v in values if v > 0]

            if len(non_zero) < 2:
                # Not enough history – use simple mean
                predicted = float(np.mean(non_zero)) if non_zero else 0.0
                confidence = "low"
            else:
                decomp = _seasonal_decompose_simple(values, period=12)
                predicted = max(0.0, decomp["next_value"])
                # Confidence based on coefficient of variation
                cv = np.std(non_zero) / (np.mean(non_zero) + 1e-6)
                confidence = "high" if cv < 0.2 else ("medium" if cv < 0.5 else "low")

            records.append({
                "category":        cat,
                "predicted_spend": round(predicted, 2),
                "avg_historical":  round(np.mean(values), 2),
                "confidence":      confidence,
                "months_of_data":  n_months,
            })

        out = (
            pd.DataFrame(records)
            .sort_values("predicted_spend", ascending=False)
            .reset_index(drop=True)
        )
        out.loc[len(out)] = {
            "category": "TOTAL",
            "predicted_spend": out["predicted_spend"].sum().round(2),
            "avg_historical": out["avg_historical"].sum().round(2),
            "confidence": "—",
            "months_of_data": n_months,
        }
        return out

    # ------------------------------------------------------------------
    # 10. Savings rate & budget health
    # ------------------------------------------------------------------

    def savings_rate(self) -> pd.DataFrame:
        """Monthly savings (income - expenses) and savings rate %."""
        return self.monthly_trends()[["month", "income", "expenses", "savings", "savings_rate_pct"]]

    def budget_health(self) -> dict:
        """
        Simple budget health score (0-100) based on:
          - savings rate (40 pts)
          - expense volatility (30 pts)
          - income stability (30 pts)
        """
        trends = self.monthly_trends()
        if trends.empty:
            return {"score": 0, "label": "No data"}

        # Savings rate contribution
        avg_savings_rate = trends["savings_rate_pct"].mean()
        savings_score = min(40.0, max(0.0, avg_savings_rate * 0.8))

        # Expense volatility (lower CV = better)
        exp_cv = trends["expenses"].std() / (trends["expenses"].mean() + 1e-6)
        volatility_score = max(0.0, 30.0 - exp_cv * 30.0)

        # Income stability
        inc_cv = trends["income"].std() / (trends["income"].mean() + 1e-6)
        income_score = max(0.0, 30.0 - inc_cv * 30.0)

        score = round(savings_score + volatility_score + income_score, 1)
        label = (
            "Excellent 🟢" if score >= 75 else
            "Good 🟡"      if score >= 50 else
            "Fair 🟠"      if score >= 30 else
            "Needs work 🔴"
        )
        return {
            "score":             score,
            "label":             label,
            "avg_savings_rate":  round(float(avg_savings_rate), 1),
            "expense_volatility_cv": round(float(exp_cv), 2),
            "income_stability_cv":   round(float(inc_cv), 2),
        }

    # ------------------------------------------------------------------
    # 11. Full formatted report
    # ------------------------------------------------------------------

    def full_report(self, print_output: bool = True) -> str:
        lines: list[str] = []

        def h(title: str) -> None:
            lines.append("\n" + "═" * 60)
            lines.append(f"  {title}")
            lines.append("═" * 60)

        def sub(title: str) -> None:
            lines.append(f"\n── {title} ──")

        h("BANK STATEMENT INSIGHTS REPORT")
        lines.append(f"  Currency: {self.currency}")

        # Summary
        sub("SUMMARY")
        s = self.summary()
        for k, v in s.items():
            label = k.replace("_", " ").title()
            if isinstance(v, float):
                lines.append(f"  {label:<32} {v:>12,.2f}")
            else:
                lines.append(f"  {label:<32} {v:>12}")

        # Budget health
        sub("BUDGET HEALTH")
        bh = self.budget_health()
        lines.append(f"  Score:  {bh['score']}/100  →  {bh['label']}")
        lines.append(f"  Avg Savings Rate:   {bh['avg_savings_rate']}%")
        lines.append(f"  Expense Volatility: {bh['expense_volatility_cv']} (CV)")
        lines.append(f"  Income Stability:   {bh['income_stability_cv']} (CV)")

        # Monthly pivot
        h("MONTHLY SPENDING BY CATEGORY")
        pivot = self.monthly_pivot()
        lines.append(pivot.round(2).to_string())

        # Category breakdown
        h("CATEGORY BREAKDOWN")
        cb = self.category_breakdown()
        lines.append(cb.to_string(index=False))

        # Top merchants
        h("TOP 10 MERCHANTS (EXPENSES)")
        tm = self.top_merchants(10)
        lines.append(tm.to_string(index=False))

        # Trends
        h("MONTHLY TRENDS")
        mt = self.monthly_trends()
        lines.append(mt.round(2).to_string(index=False))

        # Recurring
        h("DETECTED RECURRING TRANSACTIONS")
        rec = self.detect_recurring()
        if rec.empty:
            lines.append("  (none detected)")
        else:
            lines.append(rec.to_string(index=False))

        # Anomalies
        h("ANOMALIES")
        an = self.detect_anomalies()
        if an.empty:
            lines.append("  (none detected)")
        else:
            lines.append(an.head(10).to_string(index=False))

        # Prediction
        h("NEXT MONTH PREDICTION")
        pred = self.predict_next_month()
        lines.append(pred.to_string(index=False))

        report = "\n".join(lines)
        if print_output:
            print(report)
        return report

    def save_report(self, path: str = "output/report.txt") -> None:
        """Write the full report to a text file."""
        from pathlib import Path
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        report = self.full_report(print_output=False)
        p.write_text(report, encoding="utf-8")
        print(f"Report saved → {p}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import argparse
    import logging

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser(description="Generate insights from enriched bank data")
    ap.add_argument("parquet", help="Path to enriched.parquet from bank_enricher")
    ap.add_argument("-o", "--output", default="output/report.txt")
    args = ap.parse_args()

    df = pd.read_parquet(args.parquet)
    ins = BankInsights(df)
    ins.full_report()
    ins.save_report(args.output)