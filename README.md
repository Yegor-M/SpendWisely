# SpendWisely

Personal finance tracker built on bank CSV exports. Understand your spending to the penny — with Claude-powered categorisation, FX-aware analytics, and a clean dashboard.

## Features

- **Import** — drop in a bank CSV export; duplicates are skipped automatically; post-import review modal surfaces uncategorized merchants with AI suggestions
- **Smart categorisation** — 3-pass pipeline achieves ~96% coverage: bank's own `Kategoria` → regex rules → Claude/OpenAI/Gemini fallback
- **FX-aware** — USD↔PLN exchanges are detected and excluded from all spend totals; USD salary is converted via implied rate derived from paired FX rows
- **Dashboard** — monthly cash flow P&L chart, stacked daily spend chart, category breakdown, top merchants, recurring subscriptions
- **Insights** — MoM category deltas, recurring cost breakdown, savings rate trend, new merchants detector, anomalies, DOW patterns, lifestyle inflation signal
- **Plan tab** — this-month checklist (Bills / Daily / One-time), expected income, EOM projection, next-month predictions per category with trend arrows and sparklines
- **Transactions** — searchable/filterable table (counterparty, category, currency, amount range) with aggregate count + sum footer

## Stack

| Layer | Tech |
|---|---|
| Backend | Python · FastAPI · DuckDB |
| Frontend | Next.js 16 · TypeScript · Tailwind · shadcn/ui · Recharts |
| AI | Claude / OpenAI / Gemini (pluggable; defaults to `claude-sonnet-4-6`) |
| Data | Pekao bank CSV (semicolon-delimited, Polish locale) |

## Getting started

```bash
git clone https://github.com/Yegor-M/SpendWisely.git
cd SpendWisely
cp v2/backend/.env.example v2/backend/.env
# edit v2/backend/.env — set ANTHROPIC_API_KEY

docker compose up --build
# frontend → http://localhost:3000
# API docs  → http://localhost:8000/docs
```

Source files are mounted as volumes — Python and TypeScript changes are picked up without rebuilding.

Open `http://localhost:3000`, click **Import Bank CSV**, and drop in your export. A review modal surfaces any uncategorized merchants with AI suggestions.

## Server deployment

```bash
docker compose -f docker-compose.prod.yml up -d --build
# serves on port 80 via nginx
# /api/ → FastAPI, / → Next.js
```

TLS: drop `fullchain.pem` and `privkey.pem` into `docker/nginx/certs/` and uncomment the HTTPS block in `docker/nginx/nginx.conf`.

The DuckDB file is persisted in a named Docker volume (`spendwisely_db`) and survives container restarts.

## Without Docker

> Use this if you can't run Docker locally.

```bash
bash setup.sh   # creates venv, installs deps, copies .env.example
# edit v2/backend/.env — set ANTHROPIC_API_KEY

# Terminal 1
cd v2/backend && source .venv/bin/activate && uvicorn app.main:app --reload

# Terminal 2
cd v2/frontend && npm run dev
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required for Claude categorisation pass |
| `LLM_PROVIDER` | `claude` | `claude` \| `openai` \| `gemini` |
| `LLM_MODEL` | provider default | Override the model used for categorisation |
| `DB_PATH` | `./spendwisely.duckdb` | DuckDB file location |
| `OWNER_NAME` | — | Your name as it appears in bank transfers — used to detect own-account transactions |

## Data format

Pekao bank CSV exports (Menu → Historia → Eksportuj). The parser handles:

- Semicolon delimiter, `utf-8-sig` encoding
- Polish date format `DD.MM.YYYY`
- Polish number format `1 464,99` (space thousands, comma decimal)
- Paired FX rows (`Wymiana walut USD→PLN`) — marked internal, excluded from totals
- Salary month attribution via `thruMMMDD` in title (corrects early-posted income)

## Project structure

```
v2/
  backend/
    app/
      services/
        parser.py      CSV → DataFrame (FX detection, dedup, salary month fix)
        enricher.py    3-pass categorisation pipeline
        insights.py    Analytics: summaries, trends, recurring, anomalies, predictions
      routers/         FastAPI routes: /ingest /transactions /insights /categories
      database.py      DuckDB schema + connection
  frontend/
    app/               Next.js App Router pages (dashboard, insights, plan, transactions)
    components/        Dashboard widgets, insight panels, plan checklist, UI components
    lib/api.ts         Typed API client

```

## Roadmap

- [x] v1 — Python pipeline with regex categorisation
- [x] v2 — FastAPI + DuckDB + Next.js dashboard
- [x] Claude/OpenAI/Gemini categorisation (pluggable)
- [x] FX double-counting fix + USD salary income
- [x] Post-import review modal with AI suggestions
- [x] Insights, Plan tab, transactions search
- [ ] Manual cash entry UI
- [ ] Inline category editing in transactions table
- [ ] Apple Wallet export integration
