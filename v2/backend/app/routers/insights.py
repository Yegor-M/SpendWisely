from fastapi import APIRouter
from app.database import db
from app.services import insights as svc
import pandas as pd
import threading

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


@router.get("/summary")
def get_summary():
    df = _load_df()
    if df.empty:
        return {}
    return svc.summary(df)


@router.get("/monthly")
def get_monthly():
    return svc.monthly_trends(_load_df())


@router.get("/categories")
def get_categories():
    return svc.category_breakdown(_load_df())


@router.get("/merchants")
def get_merchants(n: int = 15, direction: str = "expense"):
    return svc.top_merchants(_load_df(), n=n, direction=direction)


@router.get("/recurring")
def get_recurring(min_amount: float = 5.0):
    return svc.detect_recurring(_load_df(), min_amount=min_amount)


@router.get("/anomalies")
def get_anomalies():
    return svc.detect_anomalies(_load_df())


@router.get("/predict")
def get_predict():
    return svc.predict_next_month(_load_df())


@router.get("/dow")
def get_dow():
    return svc.day_of_week_patterns(_load_df())


@router.get("/velocity")
def get_velocity():
    return svc.spend_velocity(_load_df())


@router.get("/deltas")
def get_deltas():
    return svc.category_deltas(_load_df())


@router.get("/income-sources")
def get_income_sources():
    return svc.income_sources(_load_df())


@router.get("/business-split")
def get_business_split():
    return svc.business_vs_personal(_load_df())


@router.get("/category-trends")
def get_category_trends():
    return svc.category_trends(_load_df())
