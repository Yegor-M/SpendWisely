"""
Improved Pekao bank CSV parser.

Key improvements over v1:
- FX pair detection: both USD-debit and PLN-credit sides of a currency exchange
  are marked is_internal=True so they never pollute spending totals.
- Own-account transfer detection via owner name config.
- Blank counterparty derivation from title.
- Hash-based deduplication ID so re-importing the same export is safe.
- Bank 'Kategoria' column preserved and passed downstream.
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

import pandas as pd

COLUMN_MAP = {
    "Data księgowania":        "booking_date",
    "Data waluty":             "value_date",
    "Nadawca / Odbiorca":      "counterparty",
    "Adres nadawcy / odbiorcy":"counterparty_address",
    "Rachunek źródłowy":       "source_account",
    "Rachunek docelowy":       "target_account",
    "Tytułem":                 "title",
    "Kwota operacji":          "amount",
    "Waluta":                  "currency",
    "Numer referencyjny":      "reference",
    "Typ operacji":            "operation_type",
    "Kategoria":               "bank_category",
    # ING aliases
    "Data transakcji":         "booking_date",
    "Kontrahent":              "counterparty",
    "Tytuł":                   "title",
    "Kwota":                   "amount",
}

# Patterns that identify internal / non-spending transactions
_FX_PATTERN = re.compile(r"wymiana walut", re.IGNORECASE)
_OWN_TRANSFER_PATTERN = re.compile(
    r"(przelew własny|przelew między rachunkami|transfer wewnętrzny)", re.IGNORECASE
)

# Salary titles contain an explicit pay-period end date: "thruApr30", "thruMay1", etc.
# Used to attribute early-posted income to the correct month when booking_date is in the
# previous month (e.g. May salary posted April 30 → belongs to May).
_SALARY_THRU_RE = re.compile(
    r"thru(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d+)",
    re.IGNORECASE,
)
_MONTH_ABBR = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Counterparty derivation from title when blank
_TITLE_COUNTERPARTY_HINTS = [
    (re.compile(r"wymiana walut.*?(usd|eur|gbp|chf)", re.IGNORECASE), lambda m: f"FX Exchange {m.group(1).upper()}"),
    (re.compile(r"wypłata.*bankomat", re.IGNORECASE), lambda _: "ATM Withdrawal"),
    (re.compile(r"bilet.*warszawa", re.IGNORECASE), lambda _: "Public Transit Warsaw"),
    (re.compile(r"bilet", re.IGNORECASE), lambda _: "Public Transit"),
    (re.compile(r"prowizja|opłata bankowa", re.IGNORECASE), lambda _: "Bank Fee"),
    (re.compile(r"zwrot", re.IGNORECASE), lambda _: "Refund"),
]


def _parse_amount(x: str) -> float:
    if pd.isna(x):
        return 0.0
    s = str(x).strip().replace(" ", "").replace("\xa0", "").replace(" ", "")
    if "." in s and "," in s:
        s = s.replace(".", "")
    s = s.replace(",", ".")
    s = re.sub(r"[^0-9.\-]", "", s)
    try:
        return float(s)
    except ValueError:
        return 0.0


def _norm(x) -> str:
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return ""
    return str(x).strip()


def _make_id(row: pd.Series) -> str:
    key = f"{row.get('booking_date','')}{row.get('reference','')}{row.get('amount','')}{row.get('currency','')}"
    return hashlib.sha1(key.encode()).hexdigest()[:16]


def _salary_month(booking_date: pd.Timestamp, direction: str, title: str, current_month: str) -> str:
    """
    If an income row's title contains 'thruMMMDD', the pay period end month is
    authoritative. Corrects early-posted salaries (e.g. May 1 salary lands Apr 30).
    Only fires when the thru-month differs from booking_date month.
    """
    if direction != "income" or not title or pd.isna(booking_date):
        return current_month
    m = _SALARY_THRU_RE.search(title)
    if not m:
        return current_month
    thru_month = _MONTH_ABBR[m.group(1).lower()]
    bd_month   = booking_date.month
    if thru_month == bd_month:
        return current_month
    # Determine year: cross-month boundary in either direction
    year = booking_date.year
    if bd_month == 1 and thru_month == 12:
        year -= 1  # Jan booking for Dec period (e.g. thruDec31 posted Jan 5)
    elif bd_month == 12 and thru_month == 1:
        year += 1  # Dec booking for Jan period (edge case)
    return f"{year}-{thru_month:02d}"


def _derive_counterparty(counterparty: str, title: str) -> str:
    if counterparty:
        return counterparty
    for pattern, factory in _TITLE_COUNTERPARTY_HINTS:
        m = pattern.search(title)
        if m:
            return factory(m)
    return ""


def _is_internal(row: pd.Series, owner_name: str) -> bool:
    title = row.get("title", "")
    cp = row.get("counterparty", "")
    if _FX_PATTERN.search(title):
        return True
    if _OWN_TRANSFER_PATTERN.search(title):
        return True
    if owner_name and cp.upper() == owner_name.upper() and _FX_PATTERN.search(title):
        return True
    return False


def parse_csv(path: str | Path, owner_name: str = "") -> pd.DataFrame:
    path = Path(path)
    df = pd.read_csv(
        path,
        sep=";",
        dtype=str,
        encoding="utf-8-sig",
        skip_blank_lines=True,
    )
    df.columns = df.columns.str.strip()
    df = df.rename(columns=COLUMN_MAP)

    # Parse types
    for col in ["booking_date", "value_date"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], format="%d.%m.%Y", errors="coerce")

    df["amount"] = df["amount"].apply(_parse_amount)

    for col in ["counterparty", "counterparty_address", "title", "operation_type",
                "currency", "reference", "source_account", "target_account", "bank_category"]:
        if col in df.columns:
            df[col] = df[col].apply(_norm)
        else:
            df[col] = ""

    # Derived fields
    df["direction"] = df["amount"].apply(lambda v: "expense" if v < 0 else "income")
    df["abs_amount"] = df["amount"].abs()
    df["month"] = df["booking_date"].dt.to_period("M").astype(str)
    # Correct month for income rows with explicit pay-period end date in title
    df["month"] = df.apply(
        lambda r: _salary_month(r["booking_date"], r["direction"], r["title"], r["month"]),
        axis=1,
    )
    df["category"] = "Uncategorized"
    df["counterparty"] = df.apply(
        lambda r: _derive_counterparty(r["counterparty"], r["title"]), axis=1
    )
    df["is_internal"] = df.apply(lambda r: _is_internal(r, owner_name), axis=1)
    df.loc[df["is_internal"], "direction"] = "internal"
    df["source_file"] = path.name
    df["id"] = df.apply(_make_id, axis=1)

    priority = [
        "id", "booking_date", "value_date", "month", "direction", "counterparty",
        "title", "amount", "abs_amount", "currency", "category", "bank_category",
        "is_internal", "operation_type", "counterparty_address",
        "source_account", "target_account", "reference", "source_file",
    ]
    cols = [c for c in priority if c in df.columns]
    return df[cols]
