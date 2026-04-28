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
  services/parser.py    CSV ingest — FX detection, counterparty derivation, hash dedup
  services/enricher.py  3-pass categorisation: bank Kategoria → regex → LLM fallback (any provider)
  services/llm.py       Universal LLM provider: ClaudeProvider / OpenAIProvider / GeminiProvider + factory
  services/insights.py  Analytics — excludes is_internal rows (fixes FX double-count)
  routers/              FastAPI routes: /ingest  /transactions  /insights/*  /categories
  database.py           DuckDB init + schema (transactions, category_rules tables)
v2/frontend/
  app/page.tsx          Dashboard (summary, charts, recurring, top merchants) + "Insights →" link
  app/insights/         Full insights page — velocity, deltas, predictions, anomalies, patterns
  app/transactions/     Transactions table page
  components/dashboard/ SummaryCards, MonthlyChart, CategoryPie, TopMerchants, RecurringList
  components/insights/  8 insight panels (SpendVelocity, Deltas, Prediction, Anomalies, DOW, BizSplit, Income, Trends)
  lib/api.ts            All API calls — single source of truth
v1/                     Legacy pipeline — do not extend, reference only
data/                   Gitignored — personal bank CSV exports
```

## Key files
- `v2/backend/app/services/parser.py` — read before touching CSV ingest or FX logic
- `v2/backend/app/services/enricher.py` — read before modifying category rules or LLM integration
- `v2/backend/app/services/llm.py` — read before adding a new LLM provider or changing prompts
- `v2/backend/app/database.py` — schema lives here; migrations are manual SQL

## Conventions
- Bank CSV dates: `DD.MM.YYYY`; amounts: `1 464,99` (space = thousands, comma = decimal)
- All PLN amounts only in analytics — USD rows exist but are FX noise
- `is_internal = True` excludes a row from every spend/income calculation
- Use non-capturing groups `(?:...)` in regex rules (pandas `.str.contains` warns on capture groups)
- Feature branches + PR for every task — never push directly to main
- FX "Wymiana walut - sprzedaż USD za PLN" = only PLN side appears in this file (USD side is a separate Pekao account)
- Real income in this PLN account is near-zero; all cash comes via FX conversions from USD salary account

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
- [ ] Merge PR #3 (Insights page)
- [ ] Fix income tracking: treat FX PLN-side as effective income OR ingest USD account CSV
- [ ] Expand regex rules for uncategorized merchants: AUTOPAY, BINANCE, personal transfers (MASHA etc), AUTOBEMA, ADMINISTRATRACJA
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
