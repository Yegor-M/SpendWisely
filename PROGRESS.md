# Progress

## What's Built
- Bank CSV import with FX-pair detection and hash-based dedup
- 3-pass enrichment: bank Kategoria map → regex rules → LLM fallback (Claude/OpenAI/Gemini)
- REST API: ingest, transactions CRUD, insights (summary, monthly, categories, merchants, recurring, anomalies, predict, dow, velocity, deltas, income-sources, business-split, category-trends)
- Dashboard: summary cards, monthly cash flow chart, category pie, top merchants, recurring subscriptions
- Insights page: spend velocity, MoM category deltas, next-month forecast, anomalies, DOW chart, business/personal split, income sources, category trend sparklines
- Transactions table page
- Manual cash transaction endpoint
- v1 legacy pipeline preserved for reference

## Completed

### Initial commit — v1 legacy pipeline
- `bank_parser.py`, `bank_enricher.py`, `bank_insights.py`, `main.py`
- Regex categorisation, Tkinter review UI, static HTML dashboard
- Known issues: FX double-counting, 35.9% uncategorized

### feat: v2 — FastAPI + DuckDB backend, Next.js dashboard (direct to main — pre-PR-workflow)
- Full v2 backend and frontend
- Categorisation improved from 35.9% → 95.7% on Jan–Apr 2026 dataset

### docs: CLAUDE.md, DECISIONS.md, PROGRESS.md, GOTCHAS.md (direct to main)
- Context management system set up; `/wrap` workflow established

### docs: README (direct to main)
- Full project README with features, stack, getting started, Docker section, roadmap

### PR #1 — feat/docker → main (open)
- Multi-stage Dockerfiles for backend and frontend
- `docker-compose.yml` for local dev (hot reload via volume mounts)
- `docker-compose.prod.yml` for server (nginx reverse proxy, standalone Next.js build)
- `docker/nginx/nginx.conf` with HTTPS block ready to uncomment

### PR #2 — feat/universal-llm → main (open)
- `services/llm.py`: universal LLM provider ABC — ClaudeProvider (prompt caching), OpenAIProvider (json_object format), GeminiProvider (JSON MIME + null guard)
- `services/enricher.py`: removed inline `_claude_categorize`, wired `apply_llm(provider, model)` and `run(use_llm=True, ...)`
- `routers/ingest.py`: `use_llm`, `provider`, `model` query params (replaces `use_claude`)
- `config.py`: `llm_provider`, `llm_model`, `openai_api_key`, `google_api_key` settings
- `requirements.txt`: `openai==1.54.0`, `google-generativeai==0.8.3`
- Bug fixed via /review: wrong log message in `get_provider`, Gemini null guard on safety-blocked responses

### PR #3 — feat/insights → main (open)
- `services/insights.py`: 5 new functions — `spend_velocity`, `category_deltas`, `income_sources`, `business_vs_personal`, `category_trends`
- `routers/insights.py`: 5 new routes — `/velocity` `/deltas` `/income-sources` `/business-split` `/category-trends`
- `lib/api.ts`: 7 new typed API calls + type definitions for all new shapes
- `app/insights/page.tsx`: full insights page, 8 panels in responsive 2-col grid
- `components/insights/`: SpendVelocityCard, CategoryDeltasTable, PredictionTable, AnomaliesPanel, DowChart, BusinessPersonalSplit, IncomeSourcesTable, CategoryTrendsTable
- **USD salary income**: `_implied_fx_rate()` derives PLN/USD from paired FX rows; USD income rows converted and included in summary, monthly trends, income sources
- **Full UI redesign**: warm off-white background, Geist Mono body font, deep emerald green palette (replaces orange), dark hero summary card, frosted-glass nav, rounded-2xl cards
- **Loading skeletons**: `app/loading.tsx`, `app/transactions/loading.tsx`, `app/insights/loading.tsx` — animate-pulse skeletons for all three routes
- **Docker SSR fix**: `API_URL=http://backend:8000/api/v1` added to docker-compose frontend env; `lib/api.ts` uses it for server-side fetches (was silently failing with `localhost`)
- **CSV import refresh**: `UploadCsv` calls `router.refresh()` after successful upload so dashboard re-fetches without a full reload
- **DuckDB concurrency fix**: `routers/insights.py` `_load_df()` now uses `threading.Lock` + `.df()` — 5 concurrent dashboard SSR calls were deadlocking the shared DuckDB connection (5min hang → 208ms)

### PR #5 — feat/import-review-categorization → main (open)
- `models.py`: `UncategorizedGroup`, `BulkCategorizeItem`, `BulkCategorizeResult`, `SuggestItem`; `IngestResult` extended with `uncategorized_groups`
- `routers/ingest.py`: builds counterparty groups from newly-imported uncategorized rows, sorted by count desc
- `routers/transactions.py`: `POST /transactions/bulk-categorize` — sets categories for tx_ids, optionally saves regex rule and retroactively applies to all matching uncategorized rows
- `routers/categories.py`: `POST /categories/suggest` — runs Haiku (fallback: configured provider), returns `{id: category}` suggestions
- `services/enricher.py`: **Education** category rule (`kurs`, `szkolenie`, `prawo jazdy`, `OSK`, `nauka jazdy`, `udemy`, `coursera`, `workshop`)
- `lib/api.ts`: `UncategorizedGroup`, `IngestResult`, `BulkCategorizeItem` types; `api.listCategories`, `api.suggestCategories`, `api.bulkCategorize`
- `components/ImportReview.tsx`: post-import modal — group table (counterparty, sample title, count, total PLN, category dropdown, save-rule checkbox), AI suggest, apply/skip
- `components/UploadCsv.tsx`: opens ImportReview after import if uncategorized groups exist; "N uncategorized" stat is clickable to re-open

## In Progress / Pending
- PR #1 feat/docker — awaiting merge
- PR #2 feat/universal-llm — awaiting merge
- PR #3 feat/insights — awaiting merge
- PR #5 feat/import-review-categorization — awaiting merge
- **`docker-compose.prod.yml` SSR bug**: needs `API_URL: http://backend:8000/api/v1` added to frontend service env
- **Regex rules gap**: AUTOPAY (accounting/recurring bills), BINANCE (crypto), personal transfers (MASHA, KATERINA, ALEXANDER, OLHA, NAZAR), ADMINISTRATRACJA (rent admin fee), SZOPEX (shoes) — still uncategorized
- **`income_sources` currency field**: uses `"first"` aggregation — fragile if counterparty has mixed USD/PLN rows
- Phase 3: Apple Wallet export parsing
- Phase 3: Manual cash entry UI on frontend
- Inline category editing on transactions page
