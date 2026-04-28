# Architectural Decisions

## DuckDB over SQLite for storage
Single-file embedded DB with SQL analytics.
**Why:** Already producing `.parquet` files in v1; DuckDB reads parquet natively, handles GROUP BY and window functions on columnar data dramatically faster than SQLite. Zero server overhead, same local-first story.
**Tradeoff:** Less ecosystem tooling than SQLite (no DB Browser GUI); concurrent write access is limited (fine for single-user local app).

## 3-pass enrichment pipeline
bank Kategoria map → regex rules → Claude API fallback.
**Why:** Bank already classifies ~70% of transactions in Polish. Mapping those first is free and instant. Regex covers business-specific patterns (wFirma, Ares, Implant Art). Claude only sees the residual ~5-10%, minimising API cost while maximising accuracy.
**Tradeoff:** Three sequential passes add complexity; Claude pass is async and can be skipped (use_claude=False for fast imports).

## is_internal flag on all FX and own-account rows
All "Wymiana walut" transactions (USD↔PLN exchanges) are tagged `is_internal=True` and excluded from every analytics calculation.
**Why:** v1 had 422 FX rows inflating income by 70,989 PLN and expenses by ~20k USD. Every summary, savings rate, and trend was wrong. The fix is structural — mark at parse time, exclude everywhere.
**Tradeoff:** Income from actual USD payments (e.g. client invoices paid in USD) could be mislabelled if they share the "Wymiana walut" title pattern. Needs manual override if that occurs.

## Hash-based transaction ID
SHA1 of `(booking_date + reference + amount + currency)` truncated to 16 hex chars.
**Why:** Enables idempotent re-imports — uploading the same CSV twice skips duplicates automatically. Pekao reference numbers are unique per transaction.
**Tradeoff:** Reference number format could theoretically collide across different accounts; acceptable for single-account personal use.

## Next.js App Router with server components for data fetching
Dashboard pages fetch data server-side via `api.*` calls at render time.
**Why:** Simplest path to a working dashboard with no client-state management. No Redux, no SWR, no loading spinners on initial load.
**Tradeoff:** `force-dynamic` on all pages means no static caching; fine for local dev, needs thought if ever deployed.

## Multi-stage Dockerfiles with shared base (dev + prod targets)
Single Dockerfile per service, `dev` and `prod` as named build targets.
**Why:** Keeps dev and prod environments in lockstep — same base image, same dependency install layer. `docker compose` selects the right target via `build.target`.
**Tradeoff:** `NEXT_PUBLIC_API_URL` is baked in at build time (Next.js limitation); prod builds hardcode `/api/v1` and rely on nginx to proxy correctly.

## Universal LLM provider via ABC pattern
`services/llm.py` defines `LLMProvider(ABC)` with concrete `ClaudeProvider`, `OpenAIProvider`, `GeminiProvider` implementations and a `get_provider()` factory.
**Why:** User wanted flexibility to switch between Claude, OpenAI, and Gemini without rewiring the enricher. Single shared system prompt and user message builder keeps behaviour consistent across providers. Factory returns `None` gracefully when the API key is missing, so missing credentials don't crash the ingest.
**Tradeoff:** Three SDKs in requirements even if only one is used. Provider SDK packages are imported lazily inside `__init__` so unused packages don't import at startup.
**Gotcha:** Gemini can return `None` from `.text` on safety-blocked responses — guard with `or "{}"` before json.loads.

## FX conversions as effective income (pending)
The Pekao PLN account records zero real income — salary arrives in a separate USD account and is converted to PLN via "Wymiana walut - sprzedaż USD za PLN". The current `is_internal=True` on all FX rows means income = 0 and savings rate = 0% everywhere.
**Why the decision matters:** Treating FX conversions as internal is correct to prevent double-counting, but without the USD account in the dataset there is no income signal at all. The PLN-side of each FX conversion represents real purchasing power entering the account and should serve as the income proxy.
**Options evaluated:** (a) import USD account CSV and derive salary from it — accurate but requires a second parser; (b) treat FX PLN-side as `direction=income, is_internal=False` — fast, slightly imprecise (exchange timing ≠ salary receipt date). Option (b) is the planned quick fix.
**Tradeoff:** With option (b), income appears on the day of currency exchange, not the day salary was paid. For monthly averages this is acceptable; for daily cashflow it introduces noise.

## nginx as reverse proxy in production (single port, path-based routing)
`/api/` → FastAPI, `/` → Next.js, all on port 80.
**Why:** Avoids CORS entirely — browser sees one origin. Simpler than configuring CORS headers across environments. TLS terminates at nginx, not in app code.
**Tradeoff:** Any path starting with `/api/` is reserved; can't use that prefix for frontend routes.
