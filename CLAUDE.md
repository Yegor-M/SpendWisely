# SpendWisely

Personal finance tracker built on Polish bank CSV exports (Pekao bank). Goal: understand spending to the penny, with future Apple Wallet / cash payment integration.

## Project structure

```
data/               Raw bank exports
  oct-march-all.csv   Primary source: Oct 2025 – Mar 2026 (1,114 rows, Pekao format)
  dec-feb.csv         Subset export used during early dev
  ex1.csv / ex2.csv   Identical duplicates of an earlier manual-category format (legacy)
  MonthExpense.csv    Slightly different manual-category variant (legacy)

v1/app/             Current Python pipeline
  bank_parser.py      Parses Polish bank CSV → clean Parquet/CSV
  bank_enricher.py    Regex-based auto-categorisation + terminal/Tkinter human review
  bank_insights.py    Analytics: summaries, trends, anomalies, recurring, predictions
  main.py             End-to-end pipeline CLI
  my_rules.json       Persisted category rules (19 categories)
  output/             enriched.csv, enriched.parquet, clean.csv, report.txt, dashboard.html
```

## Data format (Pekao bank)

Semicolon-delimited CSV, Polish locale: dates `DD.MM.YYYY`, amounts `1 464,99` (space thousands, comma decimal), encoding `utf-8-sig`.

Columns: `Data księgowania`, `Data waluty`, `Nadawca / Odbiorca`, `Adres nadawcy / odbiorcy`, `Rachunek źródłowy`, `Rachunek docelowy`, `Tytułem`, `Kwota operacji`, `Waluta`, `Numer referencyjny`, `Typ operacji`, `Kategoria`

## Critical data quality issues (must fix before v2)

1. **FX double-counting** — Currency exchanges (Wymiana walut USD→PLN) generate paired rows: one USD expense + one PLN income. These are the SAME transaction. 211 pairs = 422 rows inflating both income (70,989 PLN) and expense sides. Mark them as `INTERNAL_TRANSFER` and exclude from spend totals.

2. **Blank counterparty (235 rows)** — Internal transfers and FX conversions have no counterparty. Parser should derive counterparty from `title` for these.

3. **Uncategorized 36.7% by row, but mainly FX** — Once FX transfers are excluded, true uncategorized PLN expenses are ~13,467 PLN. Still needs work.

4. **ex1.csv == ex2.csv** (exact byte-level duplicates) — delete one.

5. **Bank-provided `Kategoria` column unused** — free Polish category signal being discarded.

## Run pipeline

```bash
cd v1/app
python main.py ../../data/oct-march-all.csv
python main.py ../../data/oct-march-all.csv --review   # interactive categorisation
```

## Key numbers (Oct 2025 – Mar 2026, 6 months)

- Total income: 96,036 PLN | Total expenses: 92,948 PLN | Net: +3,088 PLN
- Avg monthly spend: 15,491 PLN
- Savings rate: 3.3% (critically low)
- Largest categories: Uncategorized 35.9% → Accounting 17.5% → Rent 16.7% → Groceries 7.3%
- 1,114 transactions, 203 unique counterparties, 19 categories

## Roadmap

- **Phase 1** — Data cleanup: fix FX double-counting, use bank Kategoria, get uncategorized <10%
- **Phase 2** — v2 app: FastAPI backend + SQLite/DuckDB + Next.js dashboard + Claude API for categorisation
- **Phase 3** — Mobile/cash: Apple Wallet export parsing, iOS Shortcut for cash entries
