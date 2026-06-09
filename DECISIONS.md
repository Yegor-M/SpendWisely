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

## Docker SSR routing — two API URL env vars
Next.js server components make fetch calls inside the Docker container, where `localhost` resolves to the frontend container, not the backend.
**Why:** `NEXT_PUBLIC_API_URL=http://localhost:8000` is correct for browser fetch (port 8000 is exposed to the host), but server-side code runs inside Docker where the backend is reachable only via the Docker service name `backend`. Adding a non-public `API_URL=http://backend:8000/api/v1` and selecting it for SSR (`typeof window === "undefined"`) fixes the silent empty-data bug.
**Tradeoff:** Two env vars to keep in sync. `docker compose restart` does not apply new env vars — must use `docker compose up -d` to recreate the container.
**Gotcha:** `docker-compose.prod.yml` still has the same bug and needs the same `API_URL` fix.

## USD salary income — implied FX rate derivation
All real income arrives as USD salary converted to PLN via "Wymiana walut" FX transactions. The PLN account itself shows near-zero income.
**Why:** Importing the USD account CSV gives accurate salary figures. `_implied_fx_rate(df)` derives the PLN/USD rate from paired FX rows already in the dataset (PLN received ÷ USD sold), avoiding a hardcoded rate. USD income rows (PAYMENT FROM ABROAD) are converted at this rate and added to all income totals.
**Tradeoff:** `_implied_fx_rate` is called once per endpoint (summary, monthly_trends, income_sources) — 3 redundant dataframe scans per dashboard load. Acceptable for dataset size; could be cached if performance becomes a concern.
**Gotcha:** `_FALLBACK_RATE = 4.0` is used when no FX pairs exist in the dataset. If USD/PLN diverges significantly from 4.0 and the FX rows are missing, income will be wrong.

## Post-import review instead of separate review page
Uncategorized transactions are surfaced immediately after CSV upload in a modal, not on a dedicated `/review` route.
**Why:** Import is the natural moment of attention — user just uploaded a file and is already looking at results. A separate page requires navigation and loses the import context (which transactions are new vs pre-existing). Grouping by counterparty means one classification decision covers N transactions.
**Tradeoff:** If there are many uncategorized groups the modal can be tall; mitigated by `overflow-y-auto` scroll. A dedicated page would allow more complex filtering/sorting.

## Dynamic rule creation from manual classification
When a user assigns a category in the ImportReview modal and checks "save rule", a regex pattern is derived as `re.escape(counterparty.lower())` wrapped in a non-capturing group and saved to `category_rules` at priority 5. It is then applied retroactively to all existing uncategorized rows matching `LOWER(counterparty) LIKE '%cp%'`.
**Why:** Turns one-off classification into persistent learning — the same merchant never needs manual review again. Priority 5 sits above default rules (0) but below hand-crafted high-priority ones (10+), so it won't override known patterns.
**Tradeoff:** LIKE-based retroactive apply is fuzzy (substring match), not the same regex the enricher uses on future imports. Acceptable because counterparty names from Pekao are typically the full merchant name with no substring collisions.
**Gotcha:** Auto-generated rules have `comment="auto:{counterparty}"` — filter on this to distinguish from hand-crafted rules when debugging or cleaning up.

## Suggest endpoint uses the configured provider, not a hardcoded model
`POST /categories/suggest` uses whichever provider is configured via `LLM_PROVIDER` / `LLM_MODEL`. Previously hardcoded to Haiku.
**Why:** With Groq as the default free provider, hardcoding Haiku meant the suggest endpoint would only work for Claude users. The configured provider is already fast enough for interactive use — Groq's Llama 3.3 70B responds in ~1s for a 20-item batch.
**Tradeoff:** Provider consistency means the same model handles both interactive suggestions and batch enrichment. If a user switches to a slow/expensive provider, suggest latency increases accordingly.

## DuckDB thread-safety — threading.Lock in _load_df()
FastAPI sync route handlers run in a thread pool. The dashboard fires 5 simultaneous SSR requests via `Promise.allSettled`, resulting in 5 threads all calling `conn.execute()` on the same global `duckdb.DuckDBPyConnection`. DuckDB's Python connection object is not thread-safe for concurrent operations.
**Why:** The dashboard went from 708ms to 5-minute hangs after adding concurrent SSR calls. All threads blocked on the shared connection. Serializing with `threading.Lock` + switching from `fetchall()` to `.df()` (native Arrow export) reduced concurrent load to 208ms.
**Tradeoff:** Requests queue behind the lock rather than run in parallel. With the current dataset size (~600 rows), each `_load_df()` takes ~20ms so queue depth is negligible. If the dataset grows significantly, consider per-request read-only connections instead.
**Gotcha:** `docker compose restart` re-uses old env — must use `docker compose up -d` to apply env changes to a running container.

## Salary month attribution via thruMMMDD title parsing
Pekao salary payments sometimes arrive a day before the month starts (e.g. May salary posted April 30). Without correction, monthly income figures are off by a full salary for two consecutive months.
**Why:** The title field contains the pay-period end date as `thruApr30`, `thruMay1`, etc. — this is more authoritative than booking_date for income attribution. `_salary_month()` in `parser.py` parses this and returns the corrected month. Applied in `parse_csv()` for all future imports.
**Tradeoff:** Only fires on `direction=income` rows with `thruMMMDD` in title — no effect on other transactions. Year rollover (Jan booking + Dec thru) is handled explicitly.
**Gotcha:** Existing records in DuckDB are not retroactively corrected by the parser change — misattributed historical rows must be patched via a one-off SQL UPDATE or admin endpoint.

## Commitment type classification — three-tier with always-habit categories
The Plan page needs to categorise each transaction as a bill (fixed), regular habit (habit), or one-off (other). Pure recurring-detection misclassifies grocery stores (irregular per-location but habitual by nature) and food delivery (sometimes recurring but often one-time).
**Why:** Split into three sets: `FIXED_CATS` always→fixed (rent, subscriptions, taxes); `ALWAYS_HABIT_CATS` (Groceries, Transport, Coffee, Personal Care) always→habit regardless of whether the exact counterparty is detected as recurring; `RECURRING_HABIT_CATS` (Food & Dining, Shopping, etc.) only→habit if the counterparty has a recurring signal. Everything else non-recurring→other.
**Tradeoff:** `ALWAYS_HABIT_CATS` means a one-time grocery trip at an unfamiliar store is still classified as "habit". Acceptable — groceries are genuinely habitual spending even if the location varies.
**Gotcha:** High-regularity (≥0.80) recurring items not in either HABIT set are promoted to "fixed". This could misclassify a frequent ATM withdrawal as a bill.

## Stale-flag pattern for debounced filter effects
Client-side search/filter in `TransactionsTable` debounces API calls with `setTimeout`. Multiple effects can fire before the previous fetch settles.
**Why:** Using `setLoading(false)` in the effect cleanup (the obvious pattern) causes a race: if a fetch is in-flight when cleanup runs, a subsequent effect's `setLoading(true)` is cancelled by the old fetch's `.finally()`, leaving the UI stuck with no loading indicator while a new fetch is running. The `stale` boolean flag is set to `true` in cleanup, making `.then()` and `.finally()` of any in-flight request no-ops.
**Tradeoff:** Does not actually cancel in-flight HTTP requests — they complete and are discarded. An AbortController approach would cancel them at the network level but requires threading a signal through the api layer. Acceptable for low-traffic personal use.
**Gotcha:** Never call `setLoading(false)` in a `useEffect` cleanup when a fetch may be in-flight from the same effect. Only the current (non-stale) effect's `.finally()` should own that state transition.

## Insights / Plan tab split
The `/insights` page mixed backward-looking history (trends, anomalies) with forward-looking planning (velocity, predictions). This made both sections less useful.
**Why:** Split into `/insights` (what happened) and `/plan` (what's coming + current month status). Each page now has a clear mental model. SpendVelocityCard and PredictionTable moved to Plan; CategoryDeltasTable and NewMerchantsCard moved within Insights.
**Tradeoff:** Two fetches for pages that previously shared data (velocity was fetched in insights). Minimal cost since both pages use `force-dynamic` and SSR anyway.

## Recurring detection always capped at 6 months regardless of period filter
`GET /insights/recurring-summary` uses a fixed 6-month window even when the global period is "All time".
**Why:** "All time" detection surfaces every historical rate tier a recurring payment has ever had — e.g. old ZUS amount (~1,180 PLN, superseded Jan 2026) and current rate (~921 PLN) both appear as separate Monthly entries. The user cares about what they pay *now*, not a historical audit of rate changes.
**Tradeoff:** Recurring section doesn't respond to the period selector (intentional). Quarterly/Annual items need ≥3–4 occurrences within 6 months; Annual items may not qualify unless they happened to recur within the window. Acceptable for the current use case.
**Gotcha:** The 75-day recency filter in `recurring_summary()` also trims stale monthly/bi-weekly items. Both defences are needed: the 6-month cap prevents detection of old tiers; the 75-day filter drops entries that were detected but haven't been seen recently.

## Monthly Breakdown chart as primary Insights view
Replaced the generic monthly P&L chart with a stacked bar (recurring vs variable) + income line, placed at the top of Insights.
**Why:** The user's core question was "why do I go to zero every month?" The breakdown makes the answer visual: if the income line barely clears the top of the stacked bars, there's no slack. Splitting recurring from variable spend makes it immediately obvious whether the problem is fixed overhead or discretionary drift.
**Tradeoff:** Recurring split is approximate — based on counterparty matching against `detect_recurring` output, not transaction-level tagging. A merchant that was recurring last year but stopped will still colour past months' bars as "recurring". Acceptable for trend analysis.

## Gmail MCP for BLIK enrichment (over in-app OAuth for the operator)
BLIK transactions show the payment processor (PAYPRO/Przelewy24), not the actual merchant. Two approaches were considered: (1) in-app Gmail OAuth2 flow for end users; (2) Claude MCP Gmail tool for the app operator doing per-session enrichment.
**Why:** For a solo personal-finance tool, in-app OAuth adds complexity (client credentials, redirect URI, token storage, consent screen) for a feature only one person uses. The Claude MCP approach (`mcp__claude_ai_Gmail__search_threads`) gives instant access to the operator's inbox with zero infra — search `from:przelewy24.pl after:YYYY/MM/DD before:YYYY/MM/DD` returns email snippets containing the real merchant name.
**Tradeoff:** MCP enrichment only works in a Claude Code session, not in the deployed app. In-app OAuth is implemented but dormant — it can be activated if the app is shared with other users. Both paths co-exist.
**Gotcha:** BLIK REF search (`przelewy24.pl` sender) never works — Przelewy24 emails don't include the BLIK REF. Use the date+amount fallback. tpay.com emails DO include the BLIK REF in the subject line.

## BLIK dedup via secondary title-match check
Pekao exports both the pending and settled versions of a BLIK transaction, each with a different booking_date (same-day vs next-day). Hash dedup (on booking_date + reference + amount) doesn't catch this because the dates differ.
**Why:** Without the secondary check, recurring BLIK payments (e.g. Przelewy24 monthly subscription) imported across two CSVs appeared twice — once as the pending booking and once as the settled one.
**Tradeoff:** The secondary check queries the DB once per BLIK transaction during ingest — O(N) extra queries but negligible for typical import sizes (<500 rows). The check uses `title LIKE '%BLIK REF {ref}%' AND abs_amount = ? AND currency = ?` which is precise enough given BLIK REF numbers are unique.
**Gotcha:** Non-BLIK transactions (no REF in title) skip the secondary check entirely — only hash dedup applies to them.

## Groq as default LLM provider
`LLM_PROVIDER` defaults to `groq`; `GroqProvider` wraps the OpenAI-compatible Groq API (`https://api.groq.com/openai/v1`) with model `llama-3.3-70b-versatile`.
**Why:** Gemini free tier has a `limit: 0` on Workspace accounts and some billing-enabled projects — users were getting quota errors with no clear fix. Groq has a generous free tier (14,400 req/day), no billing requirement, and no workspace restrictions. OpenAI-compatible API means `GroqProvider` reuses the existing `OpenAIProvider` structure with a `base_url` override.
**Tradeoff:** Groq free tier has rate limits and model availability may change. Other providers (Gemini, Claude, OpenAI) remain fully supported via AI Settings.

## LLM disabled during import, deferred to review modal
`use_llm` parameter on `POST /ingest` defaults to `false`. LLM enrichment happens only when the user clicks "Suggest with AI" in the post-import modal.
**Why:** With `use_llm=true`, a quota-exhausted API key causes the import request to hang until the browser drops the connection ("Cannot reach the server"). The import itself (parsing + dedup + regex) takes <1s; the LLM call is 5–30s. Separating them makes the import fast and failures observable.
**Tradeoff:** Users who want fully automatic enrichment at import time must manually click Suggest. Acceptable — the review modal is the intended workflow anyway.

## In-memory per-IP rate limiting on `/categories/suggest`
Simple `defaultdict(list)` of timestamps per IP, protected by `threading.Lock`. Configurable via `SUGGEST_RATE_LIMIT` (default 5) and `SUGGEST_RATE_WINDOW` (default 600s). Returns HTTP 429 on breach.
**Why:** The suggest endpoint calls an external LLM API. Without rate limiting, a single user (or accidental loop) can exhaust API quota. Redis is overkill for a single-user personal app — the in-memory solution is zero-dependency and survives typical use patterns.
**Tradeoff:** Rate limit state is lost on backend restart. Acceptable — restarts are infrequent and the window is short (10 min).

## Category rename/delete with automatic remapping
`PATCH /categories/rename` and `DELETE /categories/by-name` both update `transactions.category` and `category_rules.category` in a single operation.
**Why:** Without remapping, renaming a category would leave existing transactions under the old name with no matching rule — they'd be orphaned and invisible in the new category. Atomically renaming everywhere keeps data consistent without a migration.
**Tradeoff:** Delete resets transactions to `Uncategorized` and removes all associated rules. There is no soft-delete or undo. The UI shows the affected transaction count before confirming.

## Gmail redirect URI as configurable env var
The Gmail OAuth callback URI was originally hardcoded as `http://localhost:8000/api/v1/gmail/callback` in `routers/gmail.py`.
**Why:** Hardcoded localhost breaks Docker (browser can't reach `backend:8000`) and any non-localhost deployment. Making it a `GMAIL_REDIRECT_URI` setting with a localhost default keeps zero-config local dev working while allowing prod overrides.
**Tradeoff:** One more env var to document. The registered URI in Google Cloud Console must exactly match; a mismatch produces a cryptic OAuth error. Default is intentionally localhost so existing local setups need no change.
