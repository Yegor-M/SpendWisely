"""
bank_parser.py
==============
Parses a Polish bank CSV export, normalises every column,
derives helper fields and saves a clean Parquet + CSV.

Usage
-----
    from bank_parser import BankParser

    parser = BankParser("dec-feb.csv")
    df = parser.parse()           # returns clean DataFrame
    parser.save("output/clean")   # writes output/clean.parquet + output/clean.csv
"""

from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Column aliases – extend for other Polish bank exports as needed
# ---------------------------------------------------------------------------
COLUMN_MAP: dict[str, str] = {
    # PKO / mBank style
    "Data księgowania": "booking_date",
    "Data waluty": "value_date",
    "Nadawca / Odbiorca": "counterparty",
    "Adres nadawcy / odbiorcy": "counterparty_address",
    "Rachunek źródłowy": "source_account",
    "Rachunek docelowy": "target_account",
    "Tytułem": "title",
    "Kwota operacji": "amount",
    "Waluta": "currency",
    "Numer referencyjny": "reference",
    "Typ operacji": "operation_type",
    # ING style (common aliases)
    "Data transakcji": "booking_date",
    "Kontrahent": "counterparty",
    "Tytuł": "title",
    "Kwota": "amount",
    "Saldo po transakcji": "balance_after",
}

REQUIRED_OUTPUT_COLS = [
    "booking_date",
    "counterparty",
    "title",
    "amount",
    "currency",
    "direction",
    "abs_amount",
    "operation_type",
]


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _parse_amount_pl(x: str) -> float:
    """
    Handles Polish-formatted numbers like '-1 464,99' → -1464.99.
    Also handles dot-separated thousands like '1.464,99'.
    """
    if pd.isna(x):
        return 0.0
    s = str(x).strip()
    s = s.replace("\u00a0", "").replace("\xa0", "").replace(" ", "")
    # If both '.' and ',' exist, '.' is a thousands separator
    if "." in s and "," in s:
        s = s.replace(".", "")
    s = s.replace(",", ".")
    s = re.sub(r"[^0-9.\-]", "", s)
    try:
        return float(s)
    except ValueError:
        logger.warning("Could not parse amount: %r → 0.0", x)
        return 0.0


def _normalise_str(x) -> str:
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return ""
    return str(x).strip()


# ---------------------------------------------------------------------------
# Main parser class
# ---------------------------------------------------------------------------

@dataclass
class BankParser:
    """
    Parses a Polish bank CSV export into a clean, enriched DataFrame.

    Parameters
    ----------
    path       : Path to the source CSV file.
    delimiter  : Column delimiter (default ';').
    date_fmt   : strptime format for date columns (default '%d.%m.%Y').
    encoding   : File encoding (default 'utf-8-sig' handles BOM).
    skip_rows  : Number of header rows to skip before the column row.
    column_map : Override / extend the default COLUMN_MAP.
    """

    path: str | Path
    delimiter: str = ";"
    date_fmt: str = "%d.%m.%Y"
    encoding: str = "utf-8-sig"
    skip_rows: int = 0
    column_map: dict[str, str] = field(default_factory=dict)

    # Internal state
    _df: Optional[pd.DataFrame] = field(default=None, init=False, repr=False)

    # ------------------------------------------------------------------
    def parse(self) -> pd.DataFrame:
        """Full parse pipeline. Returns the clean DataFrame and caches it."""
        raw = self._load_raw()
        df = self._rename_columns(raw)
        df = self._parse_dates(df)
        df = self._parse_amounts(df)
        df = self._normalise_text_cols(df)
        df = self._derive_fields(df)
        df = self._reorder_columns(df)
        self._df = df
        logger.info(
            "Parsed %d transactions (%d expenses, %d income) from %s",
            len(df),
            (df["direction"] == "expense").sum(),
            (df["direction"] == "income").sum(),
            self.path,
        )
        return df

    # ------------------------------------------------------------------
    def save(self, output_stem: str | Path = "output/clean") -> dict[str, Path]:
        """
        Save the parsed DataFrame to Parquet and CSV.

        Parameters
        ----------
        output_stem : Path without extension, e.g. 'output/clean'.
                      Creates 'output/clean.parquet' and 'output/clean.csv'.

        Returns
        -------
        dict with keys 'parquet' and 'csv' pointing to the written files.
        """
        if self._df is None:
            self.parse()

        stem = Path(output_stem)
        stem.parent.mkdir(parents=True, exist_ok=True)

        parquet_path = stem.with_suffix(".parquet")
        csv_path = stem.with_suffix(".csv")

        self._df.to_parquet(parquet_path, index=False)
        self._df.to_csv(csv_path, index=False, encoding="utf-8-sig")

        logger.info("Saved → %s", parquet_path)
        logger.info("Saved → %s", csv_path)
        return {"parquet": parquet_path, "csv": csv_path}

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _load_raw(self) -> pd.DataFrame:
        path = Path(self.path)
        if not path.exists():
            raise FileNotFoundError(f"CSV not found: {path}")

        # Try to auto-detect skip_rows if header row contains 'Data'
        if self.skip_rows == 0:
            skip = self._detect_header_row(path)
        else:
            skip = self.skip_rows

        df = pd.read_csv(
            path,
            sep=self.delimiter,
            dtype=str,
            skiprows=skip,
            encoding=self.encoding,
        )
        df.columns = df.columns.str.strip()
        logger.debug("Raw columns: %s", list(df.columns))
        return df

    def _detect_header_row(self, path: Path) -> int:
        """Scan first 10 lines to find the header row (contains 'Data' or 'Kwota')."""
        with path.open(encoding=self.encoding, errors="replace") as f:
            for i, line in enumerate(f):
                if i > 10:
                    break
                if "Data" in line or "Kwota" in line or "Amount" in line:
                    return i
        return 0

    def _rename_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        merged_map = {**COLUMN_MAP, **self.column_map}
        return df.rename(columns=merged_map)

    def _parse_dates(self, df: pd.DataFrame) -> pd.DataFrame:
        for col in ["booking_date", "value_date"]:
            if col in df.columns:
                df[col] = pd.to_datetime(
                    df[col], format=self.date_fmt, errors="coerce"
                )
        return df

    def _parse_amounts(self, df: pd.DataFrame) -> pd.DataFrame:
        if "amount" in df.columns:
            df["amount"] = df["amount"].apply(_parse_amount_pl)
        return df

    def _normalise_text_cols(self, df: pd.DataFrame) -> pd.DataFrame:
        text_cols = [
            "counterparty",
            "title",
            "operation_type",
            "counterparty_address",
            "currency",
            "reference",
            "source_account",
            "target_account",
        ]
        for col in text_cols:
            if col in df.columns:
                df[col] = df[col].apply(_normalise_str)
        return df

    def _derive_fields(self, df: pd.DataFrame) -> pd.DataFrame:
        if "amount" in df.columns:
            df["direction"] = df["amount"].apply(
                lambda v: "expense" if v < 0 else "income"
            )
            df["abs_amount"] = df["amount"].abs()

        # Default category placeholder so downstream code can always rely on it
        if "category" not in df.columns:
            df["category"] = "Uncategorized"

        # Month period string e.g. '2024-12'
        if "booking_date" in df.columns:
            df["month"] = df["booking_date"].dt.to_period("M").astype(str)

        return df

    def _reorder_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        priority = [
            "booking_date",
            "month",
            "direction",
            "counterparty",
            "title",
            "amount",
            "abs_amount",
            "currency",
            "category",
            "operation_type",
        ]
        existing_priority = [c for c in priority if c in df.columns]
        rest = [c for c in df.columns if c not in existing_priority]
        return df[existing_priority + rest]


# ---------------------------------------------------------------------------
# CLI convenience
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    import argparse

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser(description="Parse bank CSV export")
    ap.add_argument("csv", help="Path to the file")
    ap.add_argument("-o", "--output", default="output/clean", help="Output stem (no ext)")
    ap.add_argument("-d", "--delimiter", default=";")
    args = ap.parse_args()

    parser = BankParser(args.csv, delimiter=args.delimiter)
    df = parser.parse()
    print(df.head(10).to_string())
    saved = parser.save(args.output)
    print(f"\nSaved: {saved}")