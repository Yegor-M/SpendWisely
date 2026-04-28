# Gotchas

## Pekao CSV format
- Encoding is `utf-8-sig` (BOM present) — must pass `encoding="utf-8-sig"` to `pd.read_csv` or first column name gets a BOM prefix.
- Amounts use space as thousands separator and comma as decimal: `1 464,99`. Strip spaces before replacing comma.
- Some rows have `\xa0` (non-breaking space) as thousands separator — strip both `\xa0` and regular space.
- FX transactions appear as two rows with identical `Tytułem` (title): one USD debit, one PLN credit. Match by title contains `"Wymiana walut"`.

## DuckDB
- `duckdb.connect()` returns a connection that is NOT thread-safe by default. FastAPI's async workers can hit race conditions — use a single global connection or a connection pool.
- Sequences (`CREATE SEQUENCE`) must be referenced with `nextval('seq_name')` in INSERT — not `DEFAULT`.

## Recharts TypeScript
- `Tooltip formatter` prop type is `Formatter<ValueType, NameType>` where `ValueType` can be `undefined`. Always use `Number(v)` not `(v: number)` to avoid TS errors.
- `Pie label` render prop type is `PieLabelRenderProps` — custom data keys like `share_pct` are not typed. Use `percent` (built-in, 0–1 range) instead: `((percent ?? 0) * 100).toFixed(1)`.

## Next.js App Router
- `searchParams` in page components is now a `Promise<Record<string, string>>` in Next.js 16 — must `await searchParams` before accessing keys.
- `"use client"` is required for any component using Recharts (all chart components).
- `.env.local` is loaded automatically in dev but not committed — keep `.env.example` in sync.
