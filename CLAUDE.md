# SpendWisely — Claude context

## Stack
- **Backend** — Python 3.11, FastAPI, DuckDB (single-file), Pydantic v2
- **Frontend** — Next.js 16, TypeScript, Tailwind, shadcn/ui, Recharts
- **AI** — Universal LLM provider (Claude/OpenAI/Gemini) for batch transaction categorisation; defaults to `claude-sonnet-4-6`
- **Data** — Pekao bank CSV (semicolon-delimited, Polish locale, utf-8-sig)

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
  services/parser.py    CSV ingest — FX detection, counterparty derivation, hash dedup, salary month fix
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
  components/insights/  Insight panels: Deltas, PredictionTable (rich), Anomalies, DOW, BizSplit, Income, Trends
  components/plan/      ThisMonthChecklist — Bills/Daily/One-time sections with paid/total in headers
  components/TransactionsTable.tsx  Client component with useTransition load-more (PAGE=200)
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
- `v2/backend/app/routers/insights.py` — `GET /insights/this-month-transactions` inline endpoint with commitment classification logic
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
- `POST /categories/suggest` uses `claude-haiku-4-5-20251001` when Claude key is set; falls back to configured provider. Accepts `[{id, counterparty, title, abs_amount}]`, returns `{id: category}`.
- `POST /transactions/bulk-categorize` applies categories to specific `tx_ids`, optionally saves a regex rule derived from counterparty (`re.escape(cp.lower())`), and retroactively updates all other uncategorized rows matching the same counterparty via `LOWER(counterparty) LIKE '%cp%'`.
- Auto-generated rules use `priority=5` and comment `"auto:{counterparty}"` so they are distinguishable from hand-crafted rules.
- Commitment classification (plan page): `FIXED_CATS` always→fixed; `ALWAYS_HABIT_CATS` (Groceries, Transport, Coffee, Personal Care) always→habit regardless of recurring detection; `RECURRING_HABIT_CATS` (Food & Dining, Shopping, etc.) only→habit if recurring; everything else non-recurring→other.
- `GET /insights/this-month-transactions` uses `svc._implied_fx_rate(df)` to convert USD income to PLN — same as all other income endpoints.

## DB schema
```
transactions: id, booking_date, value_date, month, counterparty, counterparty_address,
              title, amount, abs_amount, currency, direction, category, bank_category,
              operation_type, source_account, target_account, reference, is_internal,
              source_file, imported_at
category_rules: id, category, pattern, fields[], priority, comment
```

## Next Objectives
- [ ] Merge PR #1 (Docker)
- [ ] Merge PR #2 (Universal LLM)
- [ ] Merge PR #3 (Insights page — includes redesign, USD income, loading skeletons, SSR fix)
- [ ] Fix `docker-compose.prod.yml` — add `API_URL: http://backend:8000/api/v1` to frontend service (same SSR bug as dev compose had)
- [x] Post-import review modal with AI suggestions and dynamic rules (PR #5)
- [x] Plan tab — ThisMonthChecklist, salary month attribution, load-more transactions, prediction panel enrichment (PR #7 — open on feat/prediction-panel-v2)
- [ ] Expand regex rules for uncategorized merchants: AUTOPAY, BINANCE, personal transfers (MASHA etc), ADMINISTRATRACJA
- [ ] Phase 3: Apple Wallet export parsing endpoint
- [ ] Phase 3: Manual cash entry UI (quick-add modal)
- [ ] Category edit inline on transactions page

## Do not touch without asking
- `v2/backend/app/database.py` — schema changes need migration strategy
- `v2/backend/app/services/parser.py` FX detection logic — easy to break income/expense totals

## More context
- See `DECISIONS.md` for why DuckDB over SQLite, 3-pass enrichment design
- See `PROGRESS.md` for completed work and PR history
- See `GOTCHAS.md` for Pekao CSV quirks and Recharts type issues
- See `PULL_REQUEST_TEMPLATE.md` for PR standarts
