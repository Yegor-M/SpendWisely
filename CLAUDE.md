# SpendWisely — Claude context

## Stack
- **Backend** — Python 3.11, FastAPI, DuckDB (single-file), Pydantic v2
- **Frontend** — Next.js 16, TypeScript, Tailwind, shadcn/ui, Recharts
- **AI** — Universal LLM provider (Claude/OpenAI/Gemini) for batch transaction categorisation; defaults to `gemini-2.0-flash` (free tier)
- **Data** — Pekao bank CSV (semicolon-delimited, Polish locale, utf-8-sig); Millennium Bank XLSX (auto-detected)

## Key commands
```bash
# Local (manual)
cd v2/backend && uvicorn app.main:app --reload   # http://localhost:8000/docs
cd v2/frontend && npm run dev                    # http://localhost:3000

# Docker dev (hot reload)
docker compose up --build

# Docker prod
docker compose -f docker-compose.prod.yml up -d --build

# Legacy v1 pipeline (read-only reference)
cd v1/app && python main.py ../../data/oct-march-all.csv
```

## Project structure
```
v2/backend/app/
  services/parser.py    Multi-bank ingest (Pekao CSV + Millennium XLSX) — FX detection, counterparty derivation, hash dedup, salary month fix; `detect_and_parse()` auto-routes by extension+headers
  services/enricher.py  3-pass categorisation: bank Kategoria → regex → LLM fallback (any provider)
  services/llm.py       Universal LLM provider: ClaudeProvider / OpenAIProvider / GeminiProvider + factory
  services/insights.py  Analytics — excludes is_internal rows (fixes FX double-count)
  routers/              FastAPI routes: /ingest  /transactions  /insights/*  /categories
  database.py           DuckDB init + schema (transactions, category_rules tables)
v2/frontend/
  app/page.tsx          Dashboard (summary, charts, recurring, top merchants)
  app/loading.tsx       Dashboard loading skeleton
  app/insights/         Backward-looking analytics page + loading.tsx skeleton
  app/plan/             Forward-looking plan page (this month checklist + predictions) + loading.tsx
  app/transactions/     Transactions table page (server SSR + client load-more) + loading.tsx
  components/dashboard/ SummaryCards, MonthlyChart, CategoryPie (multi-select), TopMerchants, RecurringList
  components/insights/  MonthlyBreakdownChart, RecurringCostsCard, CategoryDeltasTable (redesigned), TopTransactionsCard, NewMerchantsCard, PeriodSelector
  components/plan/      ThisMonthChecklist — Bills/Daily/One-time sections with paid/total in headers
  components/TransactionsTable.tsx  Client component — search/filter bar, load-more (PAGE=200), aggregate footer
  components/ImportReview.tsx  Post-import modal: group table, AI suggest (Haiku), bulk-categorize + rule save
  lib/api.ts            All API calls — single source of truth
v1/                     Legacy pipeline — do not extend, reference only
data/                   Gitignored — personal bank CSV exports
```

## Key files
- `v2/backend/app/services/parser.py` — read before touching CSV ingest or FX logic; contains `_salary_month()` for thruMMMDD attribution
- `v2/backend/app/services/enricher.py` — read before modifying category rules or LLM integration
- `v2/backend/app/services/llm.py` — read before adding a new LLM provider or changing prompts
- `v2/backend/app/database.py` — schema lives here; migrations are manual SQL
- `v2/backend/app/routers/insights.py` — `GET /insights/this-month-transactions` inline endpoint with commitment classification logic; recurring-summary capped at 6 months
- `v2/frontend/components/insights/MonthlyBreakdownChart.tsx` — stacked recurring+variable bar chart vs income line; read before modifying insights layout
- `v2/frontend/components/plan/ThisMonthChecklist.tsx` — Bills/Daily/One-time breakdown; read before touching plan page layout
- `v2/frontend/components/ImportReview.tsx` — post-import review modal; read before changing upload flow

## Conventions
- Bank CSV dates: `DD.MM.YYYY`; amounts: `1 464,99` (space = thousands, comma = decimal)
- PLN expenses only in spend analytics; USD income is converted via `_implied_fx_rate()` before inclusion
- `is_internal = True` excludes a row from every spend/income calculation
- Use non-capturing groups `(?:...)` in regex rules (pandas `.str.contains` warns on capture groups)
- Feature branches + PR for every task — never push directly to main
- FX "Wymiana walut - sprzedaż USD za PLN" = only PLN side appears in this file (USD side is a separate Pekao account)
- USD salary arrives as "PAYMENT FROM ABROAD" → categorised as Income; `_implied_fx_rate()` derives PLN/USD from paired FX rows
- Salary month attribution: `_salary_month()` in `parser.py` parses `thruMMMDD` in title to correct early-posted income (e.g. May salary posted Apr 30 → month=2026-05). Handles year rollover.
- Docker SSR: server components use `API_URL=http://backend:8000/api/v1` (Docker service name); `NEXT_PUBLIC_API_URL` is for browser-side only. Both must be set in compose env.
- DuckDB global connection is not thread-safe — `routers/insights.py` uses `threading.Lock` to serialize `_load_df()` calls. Do not remove this lock; concurrent reads from FastAPI's thread pool will deadlock.
- After CSV import `UploadCsv` calls `router.refresh()` to re-run server components — no full page reload needed.
- `POST /categories/suggest` uses the configured LLM provider (default: `gemini-2.0-flash`). Accepts `[{id, counterparty, title, abs_amount}]`, returns `{id: category}`.
- `POST /transactions/bulk-categorize` applies categories to specific `tx_ids`, optionally saves a regex rule derived from counterparty (`re.escape(cp.lower())`), and retroactively updates all other uncategorized rows matching the same counterparty via `LOWER(counterparty) LIKE '%cp%'`.
- Auto-generated rules use `priority=5` and comment `"auto:{counterparty}"` so they are distinguishable from hand-crafted rules.
- Commitment classification (plan page): `FIXED_CATS` always→fixed; `ALWAYS_HABIT_CATS` (Groceries, Transport, Coffee, Personal Care) always→habit regardless of recurring detection; `RECURRING_HABIT_CATS` (Food & Dining, Shopping, etc.) only→habit if recurring; everything else non-recurring→other.
- `GET /insights/this-month-transactions` uses `svc._implied_fx_rate(df)` to convert USD income to PLN — same as all other income endpoints.
- `GET /transactions/aggregate` returns `{count, total_expenses, total_income, net}` for any filter combination — same params as `GET /transactions` minus limit/offset. Used by the transactions page footer.
- `TransactionsTable` filter effect uses a `stale` boolean flag (not AbortController) to ignore responses from cancelled effect runs. Never call `setLoading(false)` in the cleanup — only the current effect's `.finally()` should clear loading state.
- `GET /insights/recurring-summary` always caps at 6 months regardless of period param — intentional, shows current rates not historical tiers.
- `GET /categories/rules` returns `id` field — use it to delete rules via `DELETE /categories/rules/{id}`. Priority 8 = hand-crafted rules; priority 5 = auto-generated from import review.
- `PATCH /transactions/{id}` accepts `{category?, counterparty?}` — either or both fields.
- `app_settings` table stores key/value pairs (currently only `gmail_token`). Add rows directly; no migration needed.
- PAYPRO S.A. = PayPro S.A. = Przelewy24 — same company. Do NOT add a blanket PAYPRO→Travel rule; it processes flights (Wizz Air via Adyen), food (Restaumatic), shoes (FOOTSSHOP), gyms (INVICTUS), etc. Enrich per-transaction via Gmail MCP instead.
- Gmail MCP (`mcp__claude_ai_Gmail__search_threads`) can identify BLIK merchants: search by BLIK REF number first (exact), fall back to `from:przelewy24.pl after:YYYY/MM/DD before:YYYY/MM/DD amount`.
- In-app Gmail OAuth is implemented but dormant — needs `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET` in `.env` and Google Cloud OAuth2 Web credential matching `GMAIL_REDIRECT_URI` (default: `http://localhost:8000/api/v1/gmail/callback`). Override `GMAIL_REDIRECT_URI` in `.env` for Docker/prod deploys. See `routers/gmail.py` docstring.
- `_recurring_entry()` returns `amount_min` and `amount_max`; RecurringCostsCard shows `min–max` range when `(max-min)/max > 5%`.
- Insights period selector always writes `?period=X` to URL (never deletes param). Default is `3m`. `period=all` maps to `months=0` which is falsy in JS, so no `months` param is sent → backend returns all data. Careful: `_period(df, 0)` would filter to current month only — `0` must never reach the backend.
- `notes/` and `context/private/` are gitignored — safe for personal tax/financial context files.
- AUTOPAY S.A. pays multiple taxes: ~1,500 PLN PIT ryczałt, ~921 PLN ZUS social (Preferencyjny until Jan 2027). Old ~1,180 tier was superseded Jan 2026. Annual Składka Zdrowotna recalculation (e.g. 2,765 PLN in May 2026) is a one-time annual event, not monthly recurring.

## DB schema
```
transactions: id, booking_date, value_date, month, counterparty, counterparty_address,
              title, amount, abs_amount, currency, direction, category, bank_category,
              operation_type, source_account, target_account, reference, is_internal,
              source_file, imported_at
category_rules: id, category, pattern, fields[], priority, comment
```

## Next Objectives
- [x] Docker setup (PR #1)
- [x] Universal LLM provider (PR #2)
- [x] Insights page — velocity, deltas, predictions, anomalies, USD income, loading skeletons, SSR fix (PR #3)
- [x] Delete all transactions button (PR #4)
- [x] Post-import review modal with AI suggestions and dynamic rules (PR #5)
- [x] Insights overhaul — new cards, sidebar, period filter, daily chart, Earn tab (PR #6)
- [x] Dashboard polish — monthly net balance, sidebar width, favicon (PR #7)
- [x] Plan tab, enriched predictions, salary month fix, load-more transactions (PR #8)
- [x] Recurring split, EOM projection fix, expected income, daily spend chart (PR #9)
- [x] Transactions tab search/filter + aggregate footer
- [x] Insights overhaul — monthly breakdown, recurring fixes, security cleanup (PR #11)
- [x] Gmail BLIK enrichment (nice-to-have), BLIK dedup fix, category rules cleanup (PR #13)
- [x] Fix Gmail redirect URI hardcoding — `GMAIL_REDIRECT_URI` env var; guard refresh_token KeyError
- [x] Millennium Bank XLSX support, show/hide fix, bank-agnostic empty state, prod docker API_URL (PR #15)
- [x] Groq default provider, category management modal, regex expansion, import UX + animations (PR #17)
- [ ] Expand regex rules: BINANCE, personal transfers, SZOPEX
- [ ] Phase 3: Apple Wallet export parsing endpoint
- [ ] Phase 3: Manual cash entry UI (quick-add modal)
- [ ] Category edit inline on transactions page
- [ ] Fix dead code: `regularityColor` in RecurringCostsCard, unused `MonthlyBreakdownTable` component, `barColor.replace()` string hack in CategoryDeltasTable
- [ ] Gmail PAYPRO verification tool — `GET /gmail/lookup-paypro?date=&amount=` endpoint + "Verify via Gmail" button on PAYPRO rows in ImportReview modal; searches `from:przelewy24.pl` by date window + amount, returns real merchant for approve/categorize flow

## Do not touch without asking
- `v2/backend/app/database.py` — schema changes need migration strategy
- `v2/backend/app/services/parser.py` FX detection logic — easy to break income/expense totals

## More context
- See `DECISIONS.md` for why DuckDB over SQLite, 3-pass enrichment design
- See `PROGRESS.md` for completed work and PR history
- See `GOTCHAS.md` for Pekao CSV quirks and Recharts type issues
- See `PULL_REQUEST_TEMPLATE.md` for PR standarts
