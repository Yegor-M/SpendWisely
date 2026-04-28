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
- Dashboard: "Insights →" nav link
- Data audit performed: income tracking is broken (see pending items)

## In Progress / Pending
- PR #1 feat/docker — awaiting merge
- PR #2 feat/universal-llm — awaiting merge
- PR #3 feat/insights — awaiting merge
- **Income tracking fix**: FX PLN-side ("Wymiana walut") should be treated as effective income, not internal — currently savings rate = 0 (wrong)
- **Regex rules gap**: AUTOPAY (accounting/recurring bills), BINANCE (crypto), personal transfers (MASHA, KATERINA, ALEXANDER, OLHA, NAZAR), AUTOBEMA (driving school), ADMINISTRATRACJA (rent admin fee), SZOPEX (shoes) all land in "Bez kategorii" = 37% uncategorized by spend
- Phase 3: Apple Wallet export parsing
- Phase 3: Manual cash entry UI on frontend
- Inline category editing on transactions page
