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

### PR #1 — feat/docker → main (merged)
- Multi-stage Dockerfiles for backend and frontend
- `docker-compose.yml` for local dev (hot reload via volume mounts)
- `docker-compose.prod.yml` for server (nginx reverse proxy, standalone Next.js build)
- `docker/nginx/nginx.conf` with HTTPS block ready to uncomment

### PR #2 — feat/universal-llm → main (merged)
- `services/llm.py`: universal LLM provider ABC — ClaudeProvider (prompt caching), OpenAIProvider (json_object format), GeminiProvider (JSON MIME + null guard)
- `services/enricher.py`: removed inline `_claude_categorize`, wired `apply_llm(provider, model)` and `run(use_llm=True, ...)`
- `routers/ingest.py`: `use_llm`, `provider`, `model` query params (replaces `use_claude`)
- `config.py`: `llm_provider`, `llm_model`, `openai_api_key`, `google_api_key` settings
- `requirements.txt`: `openai==1.54.0`, `google-generativeai==0.8.3`
- Bug fixed via /review: wrong log message in `get_provider`, Gemini null guard on safety-blocked responses

### PR #3 — feat/insights → main (merged)
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

### PR #4 — feat/delete-transactions → main (merged)
- `routers/transactions.py`: `DELETE /transactions` endpoint returns `{deleted: N}`
- `components/DeleteAllTransactions.tsx`: button with inline confirm/cancel phase before executing
- `lib/api.ts`: `api.deleteAllTransactions()`

### PR #5 — feat/import-review-categorization → main (merged)
- `models.py`: `UncategorizedGroup`, `BulkCategorizeItem`, `BulkCategorizeResult`, `SuggestItem`; `IngestResult` extended with `uncategorized_groups`
- `routers/ingest.py`: builds counterparty groups from newly-imported uncategorized rows, sorted by count desc
- `routers/transactions.py`: `POST /transactions/bulk-categorize` — sets categories for tx_ids, optionally saves regex rule and retroactively applies to all matching uncategorized rows
- `routers/categories.py`: `POST /categories/suggest` — runs Haiku (fallback: configured provider), returns `{id: category}` suggestions
- `services/enricher.py`: **Education** category rule (`kurs`, `szkolenie`, `prawo jazdy`, `OSK`, `nauka jazdy`, `udemy`, `coursera`, `workshop`)
- `lib/api.ts`: `UncategorizedGroup`, `IngestResult`, `BulkCategorizeItem` types; `api.listCategories`, `api.suggestCategories`, `api.bulkCategorize`
- `components/ImportReview.tsx`: post-import modal — group table (counterparty, sample title, count, total PLN, category dropdown, save-rule checkbox), AI suggest, apply/skip
- `components/UploadCsv.tsx`: opens ImportReview after import if uncategorized groups exist; "N uncategorized" stat is clickable to re-open

### PR #6 — feat/insights-overhaul → main (merged)
- **New insight cards**: RecurringCostsCard, TopTransactionsCard, FixedVsVariableCard, SavingsRateTrendCard, NewMerchantsCard, LifestyleInflationCard, InsightsMonthlyChart (full-width ComposedChart with secondary savings-rate axis)
- **Backend**: `top_transactions()`, `recurring_summary()`, `new_merchants_this_month()` + corresponding routes
- **Two-pass recurring detection**: pass 1 groups by `(counterparty, title_key)` (strips date/ref suffixes); pass 2 fallback by counterparty only — catches variable-amount recurrings like AUTOPAY tax payments
- **Tiered amount bucketing** (0.5/5/25/100 PLN) for pass-1 grouping
- **Sidebar**: sticky left sidebar replaces top nav; active link via `usePathname()`; mobile fallback compact top bar
- **Period filter**: All time / 6mo / Quarter / Month pills; `searchParams` → `months` param passed to all backend endpoints; `_period()` helper in router
- **Dashboard**: SummaryCards hero numbers promoted to monthly averages; USD equivalent on net balance; DashboardTabs (Overview / Earn); Earn tab with 13 income strategies
- **Insights page** reorganised into 5 labelled sections (This Month → Structural → Trends → Behavioral → Events)

### PR #7 — feat/dashboard-polish → main (merged)
- Net Balance card shows current-month income minus expenses (was all-time net)
- Sidebar widened from `w-52` to `w-64`
- Removed "S" logo from sidebar and mobile header
- Added 💰 emoji favicon via `app/icon.tsx`

### PR #8 — feat/plan-tab → main (merged)
- **Plan tab** (`app/plan/page.tsx`): new page fetching velocity + thisMonthTx + predict; header shows month, day progress bar, ±% vs avg pace
- **ThisMonthChecklist** (`components/plan/ThisMonthChecklist.tsx`): Bills (paid✓ + coming up○) / Daily / One-time sections; section headers show `paid/total PLN`; category shown per row
- **Salary month attribution** (`services/parser.py`): `_salary_month()` parses `thruMMMDD` in income title; corrects early-posted salary; handles year rollover
- **Load-more transactions** (`components/TransactionsTable.tsx`): server SSRs first 200; client appends via `useTransition`
- **PredictionTable rewrite**: sort controls, trend arrows, sparklines, range bands, confidence pills, bar chart toggle
- **Prediction data enrichment** (`services/insights.py`): adds `last_month_actual`, `delta_vs_last`, `trend_direction`, `trend_pct`, `range_low/high`, `cv`, `months_observed`, `history`
- **CategoryPie multi-select restored**: click slice/legend; center overlay combined % + PLN; unselected fade to 20%
- **Commitment classification**: `ALWAYS_HABIT_CATS` always→habit; `RECURRING_HABIT_CATS` only if recurring signal; `FIXED_CATS` always→fixed
- **USD income FX fix**: `GET /insights/this-month-transactions` converts USD via `_implied_fx_rate()`

### PR #9 — feat/recurring-split → main (merged)
- **AUTOPAY recurring split** (`services/insights.py`): sub-splits by `(counterparty, title)` + amount bucket so ZUS social (~921 PLN) and income-tax (~1 500 PLN) appear as separate Monthly entries; month-coverage threshold capped at 3
- **Recurring deduplication**: merges entries sharing same first-10-chars + category + amount bucket, keeping variant with more occurrences (fixes dental clinic duplicate)
- **EOM projection fix** (`routers/insights.py`): `fixed_paid + expected_fixed + (variable_paid / day_pct)` — stops fixed one-off bills inflating the linear projection
- **Case-insensitive counterparty matching** in `this-month-transactions` — prevents same merchant with different capitalisation reappearing as "coming up"
- **Expected income section** on plan page: recurring income sources detected; received ✓ and expected ○ rows; `income_expected` in summary bar so Free balance reflects full month
- **Bills "coming up"** shows only fixed-commitment items (rent, healthcare, subscriptions) — habit items no longer mixed in
- **DailySpendChart** (`components/dashboard/DailySpendChart.tsx`): stacked bar per day, top-6 categories + Other, month navigation, avg daily reference line, custom tooltip
- **Insights**: FixedVsVariableCard merged into RecurringCostsCard footer; IncomeSourcesTable and BusinessPersonalSplit removed (single income source, no business split)

### Transactions tab search + aggregate (unmerged, on main)
- `routers/transactions.py`: extracted `_build_filters()` helper; added `min_amount`/`max_amount` params to `GET /transactions`; new `GET /transactions/aggregate` endpoint — same filters, returns `{count, total_expenses, total_income, net}`
- `lib/api.ts`: `TransactionAggregate` type + `api.transactionsAggregate()`
- `TransactionsTable.tsx`: filter bar (text search, category select, direction select, currency select, min/max amount); 350ms debounced re-fetch; skeleton loading rows; footer shows aggregate count + expense/income/net sums (always accurate from server, regardless of pagination)
- Bug fix: `stale` flag in filter `useEffect` prevents in-flight responses from cancelled effects from overwriting current state or corrupting loading indicator

### PR #11 — feat/insights-monthly-breakdown-v2 → main (merged)
- **Monthly Breakdown** (`components/insights/MonthlyBreakdownChart.tsx`): stacked bar chart (recurring=blue, variable=amber) + income line; avg net badge; moved to top of Insights page
- **Recurring Costs redesign**: compact rows, category label per row, amount min–max range when variance >5%; stale entries filtered (75-day recency cutoff + 6-month detection window); `_recurring_entry` returns `amount_min/amount_max`
- **Changes block redesign** (`CategoryDeltasTable`): net delta headline, proportional bars per row, Accounting excluded, <100 PLN noise filtered
- **Period selector fix**: always writes `?period=X` — "All time" no longer swallowed by 3m default; default changed to Quarter
- **Removed from Insights**: SavingsRateTrendCard, AnomaliesPanel, MonthlyBreakdownTable, DowChart, CategoryTrendsTable, LifestyleInflationCard
- **Security cleanup**: untrack `.claude/settings.local.json`; remove personal names from enricher regex and PROGRESS.md; add `notes/` gitignore
- **Backend**: `monthly_breakdown()` service + `GET /insights/monthly-breakdown`; recurring-summary router caps at 6 months

### PR #13 — feat/gmail-blik-enrichment → main (merged)
- **BLIK dedup** (`routers/ingest.py`): after hash-dedup, secondary check for same BLIK REF + abs_amount + currency prevents pending→settled duplicates from landing in DB
- **`PATCH /transactions/{id}`** (`routers/transactions.py`): dynamic SET clause; accepts `{category?, counterparty?}` either or both
- **`GET /categories/rules`**: now returns `id` field so rules can be deleted via `DELETE /categories/rules/{id}`
- **`app_settings` table** (`database.py`): `key/value` store for Gmail token (and future settings); `_save_token` uses SELECT+INSERT/UPDATE
- **`services/gmail.py`** (new): OAuth2 auth-url, exchange-code, token-refresh, `search_messages`, `get_message_content`, `identify_merchant` heuristics (Wizz Air, Ryanair, LOT, Booking.com, FlixBus, RegioJet, Airbnb, car rentals), `build_blik_query`
- **`routers/gmail.py`** (new): GET /status, /auth-url, /callback (HTMLResponse), DELETE /disconnect, POST /enrich-blik (sequential per-tx Gmail search, returns suggestions without auto-applying)
- **`GmailSettings.tsx`** (new): connect/disconnect flow, enrich BLIK button, suggestion cards with Apply
- **`LLMSettings.tsx`**: renamed to "Settings" modal with AI Provider / Gmail tabs
- **Category corrections via Gmail MCP**: PAYPRO rule deleted; 15 transactions individually re-categorised (FOOTSSHOP→Clothing, MMAniak/INVICTUS→Sports & Fitness, PKP Intercity→Transport, Restaumatic→Food & Dining, WEB INNOVATIVE SOFTWARE→Subscriptions, Wizz Air→Travel)
- **PAYPRO S.A. = Przelewy24**: documented in CLAUDE.md — never add blanket PAYPRO→Travel rule

### fix: Gmail redirect URI + refresh_token guard (on main, commit 684b7c7)
- `config.py`: `gmail_redirect_uri` setting (default: localhost, overridable via `GMAIL_REDIRECT_URI` env var)
- `routers/gmail.py`: replaced hardcoded `_REDIRECT_URI` with `settings.gmail_redirect_uri` — fixes Docker/prod deploys
- `services/gmail.py`: `refresh_access_token` uses `.get("refresh_token")` with explicit `ValueError` instead of `KeyError`

## In Progress / Pending
- **`docker-compose.prod.yml` SSR bug**: `API_URL: http://backend:8000/api/v1` still missing from frontend service env
- **Regex rules gap**: BINANCE (crypto), personal transfers, SZOPEX (shoes) — still uncategorized
- **Dead code to clean**: `regularityColor` in RecurringCostsCard (unused), `MonthlyBreakdownTable` component (unused), `barColor.replace()` string hack in CategoryDeltasTable
- **`months=0` sentinel**: `period=all` maps to `months=0` (falsy in JS → no param sent to backend). Fragile — if `0` ever reaches `_period()` it filters to current month only. Should use `undefined` explicitly
- **`income_sources` currency field**: uses `"first"` aggregation — fragile if a counterparty has mixed USD/PLN rows
- **Nov 2024 65.50 PLN PAYPRO transaction**: merchant unidentified — no Przelewy24 email found for that date
- Phase 3: Apple Wallet export parsing endpoint
- Phase 3: Manual cash entry UI (quick-add modal)
- Inline category editing on transactions page
