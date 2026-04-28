# Architectural Decisions

## DuckDB over SQLite for storage
Single-file embedded DB with SQL analytics.
**Why:** Already producing `.parquet` files in v1; DuckDB reads parquet natively, handles GROUP BY and window functions on columnar data dramatically faster than SQLite. Zero server overhead, same local-first story.
**Tradeoff:** Less ecosystem tooling than SQLite (no DB Browser GUI); concurrent write access is limited (fine for single-user local app).

## 3-pass enrichment pipeline
bank Kategoria map → regex rules → Claude API fallback.
**Why:** Bank already classifies ~70% of transactions in Polish. Mapping those first is free and instant. Regex covers business-specific patterns (wFirma, Ares, Implant Art). Claude only sees the residual ~5-10%, minimising API cost while maximising accuracy.
**Tradeoff:** Three sequential passes add complexity; Claude pass is async and can be skipped (use_claude=False for fast imports).

## is_internal flag on all FX and own-account rows
All "Wymiana walut" transactions (USD↔PLN exchanges) are tagged `is_internal=True` and excluded from every analytics calculation.
**Why:** v1 had 422 FX rows inflating income by 70,989 PLN and expenses by ~20k USD. Every summary, savings rate, and trend was wrong. The fix is structural — mark at parse time, exclude everywhere.
**Tradeoff:** Income from actual USD payments (e.g. client invoices paid in USD) could be mislabelled if they share the "Wymiana walut" title pattern. Needs manual override if that occurs.

## Hash-based transaction ID
SHA1 of `(booking_date + reference + amount + currency)` truncated to 16 hex chars.
**Why:** Enables idempotent re-imports — uploading the same CSV twice skips duplicates automatically. Pekao reference numbers are unique per transaction.
**Tradeoff:** Reference number format could theoretically collide across different accounts; acceptable for single-account personal use.

## Next.js App Router with server components for data fetching
Dashboard pages fetch data server-side via `api.*` calls at render time.
**Why:** Simplest path to a working dashboard with no client-state management. No Redux, no SWR, no loading spinners on initial load.
**Tradeoff:** `force-dynamic` on all pages means no static caching; fine for local dev, needs thought if ever deployed.
