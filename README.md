# SpendWisely

Personal finance tracker built on Polish bank (Pekao) CSV exports. Understand your spending to the penny — with Claude-powered categorisation, FX-aware analytics, and a clean dashboard.

![Dashboard](https://placehold.co/900x400?text=Dashboard+screenshot)

## Features

- **Import** — drop in a Pekao bank CSV export; duplicates are skipped automatically
- **Smart categorisation** — 3-pass pipeline achieves ~96% coverage without manual review:
  1. Bank's own `Kategoria` column (Polish → English mapping)
  2. Regex rules for known merchants and patterns
  3. Claude API fallback for anything remaining
- **FX-aware** — currency exchanges (USD↔PLN) are detected and excluded from all spend totals, so your savings rate is actually correct
- **Dashboard** — monthly cash flow, category breakdown, top merchants, recurring subscriptions
- **Manual cash entry** — log cash payments via API
- **Predictions** — linear trend + seasonality estimate for next month per category

## Stack

| Layer | Tech |
|---|---|
| Backend | Python · FastAPI · DuckDB |
| Frontend | Next.js 16 · TypeScript · Tailwind · shadcn/ui · Recharts |
| AI | Claude API (`claude-sonnet-4-6`) |
| Data | Pekao bank CSV (semicolon-delimited, Polish locale) |

## Getting started

### 1. Clone

```bash
git clone https://github.com/Yegor-M/SpendWisely.git
cd SpendWisely
```

### 2. Backend

```bash
cd v2/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# edit .env — set ANTHROPIC_API_KEY and optionally OWNER_NAME

uvicorn app.main:app --reload
# API docs → http://localhost:8000/docs
```

### 3. Frontend

```bash
cd v2/frontend
npm install
npm run dev
# → http://localhost:3000
```

### 4. Import your data

Open `http://localhost:3000`, click **Import Bank CSV**, and drop in your Pekao export.

Or via API:

```bash
curl -X POST http://localhost:8000/api/v1/ingest \
  -F "file=@data/export.csv" \
  -F "use_claude=true"
```

## Docker

### Local development (hot reload)

```bash
cp v2/backend/.env.example v2/backend/.env
# add ANTHROPIC_API_KEY to v2/backend/.env

docker compose up --build
# frontend → http://localhost:3000
# API docs → http://localhost:8000/docs
```

Source files are mounted as volumes — changes to Python or TypeScript are picked up instantly without rebuilding.

### Server deployment

```bash
docker compose -f docker-compose.prod.yml up -d --build
# serves on port 80 via nginx
# nginx routes /api/ → FastAPI, / → Next.js
```

TLS: drop `fullchain.pem` and `privkey.pem` into `docker/nginx/certs/` and uncomment the HTTPS block in `docker/nginx/nginx.conf`.

The DuckDB file is persisted in a named Docker volume (`spendwisely_db`) and survives container restarts.

## Data format

Pekao bank CSV exports (Menu → Historia → Eksportuj). The parser handles:

- Semicolon delimiter, `utf-8-sig` encoding
- Polish date format `DD.MM.YYYY`
- Polish number format `1 464,99` (space thousands, comma decimal)
- Paired FX rows (`Wymiana walut USD→PLN`) — automatically marked as internal and excluded from totals

## Project structure

```
v2/
  backend/
    app/
      services/
        parser.py      CSV → DataFrame (FX detection, dedup, counterparty derivation)
        enricher.py    3-pass categorisation pipeline
        insights.py    Analytics: summaries, trends, recurring, anomalies, predictions
      routers/         FastAPI routes: /ingest /transactions /insights /categories
      database.py      DuckDB schema + connection
  frontend/
    app/               Next.js App Router pages
    components/        Dashboard widgets + UI components
    lib/api.ts         Typed API client

v1/                    Legacy Python pipeline (reference only)
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required for Claude categorisation pass |
| `DB_PATH` | `./spendwisely.duckdb` | DuckDB file location |
| `OWNER_NAME` | `YEHOR MAKARENKO` | Account holder name (used to detect own-account transfers) |

## Roadmap

- [x] v1 — Python pipeline with regex categorisation
- [x] v2 — FastAPI + DuckDB + Next.js dashboard
- [x] Claude API categorisation with prompt caching
- [x] FX double-counting fix
- [ ] Manual cash entry UI
- [ ] Apple Wallet export integration
- [ ] iOS Shortcut for quick cash logging
- [ ] Inline category editing in transactions table
