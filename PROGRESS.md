# Progress

## What's Built
- Bank CSV import with FX-pair detection and hash-based dedup
- 3-pass enrichment: bank Kategoria map → regex rules → Claude API (95.7% coverage on new dataset)
- REST API: ingest, transactions CRUD, insights (summary, monthly, categories, merchants, recurring, anomalies, predict, dow)
- Dashboard: summary cards, monthly cash flow chart, category pie, top merchants, recurring subscriptions
- Transactions table page
- Manual cash transaction endpoint
- v1 legacy pipeline preserved for reference

## Completed

### Initial commit — v1 legacy pipeline
- `bank_parser.py`, `bank_enricher.py`, `bank_insights.py`, `main.py`
- Regex categorisation, Tkinter review UI, static HTML dashboard
- Known issues: FX double-counting, 35.9% uncategorized

### feat: v2 — FastAPI + DuckDB backend, Next.js dashboard (pushed to main directly — pre-PR-workflow)
- Full v2 backend and frontend as described above
- Categorisation improved from 35.9% → 95.7% on Jan–Apr 2026 dataset

## In Progress / Pending
- Phase 3: Apple Wallet export parsing
- Phase 3: Manual cash entry UI on frontend
- Next-month prediction widget surfaced on dashboard
- Inline category editing on transactions page
- PR-based workflow enforced going forward
