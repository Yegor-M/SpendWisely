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
