# SpendWisely

Personal finance tracker built on bank CSV exports. Understand your spending to the penny — with Claude-powered categorisation, FX-aware analytics, and a clean dashboard.

## Features

- **Import** — drop in a Pekao CSV or Millennium XLSX; duplicates skipped automatically; post-import review modal surfaces uncategorized merchants with AI suggestions
- **Smart categorisation** — 3-pass pipeline achieves ~96% coverage: bank's own `Kategoria` → regex rules (150+ Polish brands) → Groq/Claude/OpenAI/Gemini fallback
- **FX-aware** — USD↔PLN exchanges are detected and excluded from all spend totals; USD salary is converted via implied rate derived from paired FX rows
- **Category management** — rename categories with automatic rule + transaction remapping; delete categories and reset transactions to Uncategorized
- **Dashboard** — monthly cash flow P&L chart, stacked daily spend chart, category breakdown, top merchants, recurring subscriptions
- **Insights** — MoM category deltas, recurring cost breakdown, savings rate trend, new merchants detector, anomalies, DOW patterns, lifestyle inflation signal
- **Plan tab** — this-month checklist (Bills / Daily / One-time), expected income, EOM projection, next-month predictions per category with trend arrows and sparklines
- **Transactions** — searchable/filterable table (counterparty, category, currency, amount range) with aggregate count + sum footer

## Stack

| Layer | Tech |
|---|---|
| Backend | Python · FastAPI · DuckDB |
| Frontend | Next.js 16 · TypeScript · Tailwind · shadcn/ui · Recharts |
| AI | Claude / OpenAI / Gemini / Groq (pluggable; free Groq tier by default) |
| Data | Pekao bank CSV · Millennium Bank XLSX (auto-detected) |

## Getting started

```bash
git clone https://github.com/Yegor-M/SpendWisely.git
cd SpendWisely
cp v2/backend/.env.example v2/backend/.env
docker compose up --build
```

- Frontend → http://localhost:3000
- API docs → http://localhost:8000/docs

Source files are mounted as volumes — Python and TypeScript changes are picked up without rebuilding.

**Enable AI categorisation (optional but recommended)**

The app works without an API key — transactions are categorised by bank category + regex rules (~70% coverage). To unlock the "Suggest with AI" button in the import review modal:

1. Get a **free** Groq key at https://console.groq.com/keys (14,400 req/day, no billing)
2. Open http://localhost:3000 → click **⚙ AI Settings** at the bottom of the sidebar
3. Select Groq, paste the key (`gsk_...`), Save

Or set it in `.env` before starting:
```
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
```

Then import a file: **Import CSV** → review uncategorized merchants → **✦ Suggest with AI** → Apply. If final coverage reaches 80%+ the modal closes automatically and navigates back to the dashboard.

## Server deployment

```bash
docker compose -f docker-compose.prod.yml up -d --build
# serves on port 80 via nginx
# /api/ → FastAPI, / → Next.js
```

TLS: drop `fullchain.pem` and `privkey.pem` into `docker/nginx/certs/` and uncomment the HTTPS block in `docker/nginx/nginx.conf`.

The DuckDB file is persisted in a named Docker volume (`spendwisely_db`) and survives container restarts.

## Without Docker

```bash
bash setup.sh   # creates venv, installs deps, copies .env.example

# Terminal 1
cd v2/backend && source .venv/bin/activate && uvicorn app.main:app --reload

# Terminal 2
cd v2/frontend && npm run dev
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `groq` | `groq` \| `gemini` \| `claude` \| `openai` |
| `GROQ_API_KEY` | — | Free Groq key — https://console.groq.com/keys (recommended) |
| `GOOGLE_API_KEY` | — | Free Gemini key — https://aistudio.google.com/apikey |
| `ANTHROPIC_API_KEY` | — | Claude key (paid) |
| `OPENAI_API_KEY` | — | OpenAI key (paid) |
| `LLM_MODEL` | provider default | Override the model (e.g. `llama-3.3-70b-versatile`) |
| `DB_PATH` | `./spendwisely.duckdb` | DuckDB file location |
| `OWNER_NAME` | — | Your name as it appears in bank transfers — used to detect own-account transactions |
| `SUGGEST_RATE_LIMIT` | `5` | Max AI suggest requests per IP per window |
| `SUGGEST_RATE_WINDOW` | `600` | Rate limit window in seconds |

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
- [x] Claude/OpenAI/Gemini/Groq categorisation (pluggable; Groq free by default)
- [x] FX double-counting fix + USD salary income
- [x] Post-import review modal with AI suggestions + animated success state
- [x] Insights, Plan tab, transactions search
- [x] Millennium Bank XLSX support
- [x] Category management — rename and delete with remapping
- [ ] Manual cash entry UI
- [ ] Apple Wallet export integration
