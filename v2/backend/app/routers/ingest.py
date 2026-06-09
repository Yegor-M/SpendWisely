import io
import logging
import re
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from app.database import db
from app.models import IngestResult, UncategorizedGroup
from app.services.parser import detect_and_parse
from app.services.enricher import BankEnricher
from app.config import settings
import tempfile, os

_BLIK_REF_RE = re.compile(r"BLIK\s+REF\s+(\d+)", re.IGNORECASE)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestResult)
async def ingest_csv(
    file: UploadFile = File(...),
    use_llm: bool  = Query(default=False, description="Run LLM categorisation pass"),
    provider: str  = Query(default="",    description="Override LLM provider (claude|openai|gemini)"),
    model: str     = Query(default="",    description="Override model name"),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".csv", ".xlsx"):
        raise HTTPException(400, "Only .csv and .xlsx files are supported")

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        df = detect_and_parse(tmp_path, owner_name=settings.owner_name)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    finally:
        os.unlink(tmp_path)

    enricher = BankEnricher(df)
    df = enricher.run(use_llm=use_llm, provider=provider, model=model)

    with db() as conn:
        existing_ids = set(
            r[0] for r in conn.execute("SELECT id FROM transactions").fetchall()
        )
        new_rows = df[~df["id"].isin(existing_ids)]
        duplicates = len(df) - len(new_rows)

        # Deduplicate BLIK transactions whose REF already exists (pending → settled pairs).
        # Different booking dates produce different hashes, so hash-dedup misses these.
        if not new_rows.empty:
            blik_dup_ids: set[str] = set()
            for _, row in new_rows.iterrows():
                m = _BLIK_REF_RE.search(str(row.get("title", "")))
                if not m:
                    continue
                hit = conn.execute(
                    "SELECT id FROM transactions WHERE title LIKE ? AND abs_amount = ? AND currency = ?",
                    [f"%BLIK REF {m.group(1)}%", float(row["abs_amount"]), str(row.get("currency", "PLN"))],
                ).fetchone()
                if hit:
                    blik_dup_ids.add(str(row["id"]))
            if blik_dup_ids:
                new_rows = new_rows[~new_rows["id"].isin(blik_dup_ids)]
                duplicates += len(blik_dup_ids)

        if not new_rows.empty:
            conn.executemany(
                """INSERT INTO transactions
                   (id, booking_date, value_date, month, counterparty, counterparty_address,
                    title, amount, abs_amount, currency, direction, category, bank_category,
                    operation_type, source_account, target_account, reference, is_internal, source_file)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                [
                    (
                        r["id"],
                        str(r["booking_date"].date()) if hasattr(r["booking_date"], "date") else str(r["booking_date"]),
                        str(r["value_date"].date()) if hasattr(r.get("value_date"), "date") else None,
                        r["month"],
                        r.get("counterparty", ""),
                        r.get("counterparty_address", ""),
                        r.get("title", ""),
                        float(r["amount"]),
                        float(r["abs_amount"]),
                        r.get("currency", "PLN"),
                        r["direction"],
                        r.get("category", "Uncategorized"),
                        r.get("bank_category", ""),
                        r.get("operation_type", ""),
                        r.get("source_account", ""),
                        r.get("target_account", ""),
                        r.get("reference", ""),
                        bool(r["is_internal"]),
                        r.get("source_file", ""),
                    )
                    for _, r in new_rows.iterrows()
                ],
            )

    internal = int(new_rows["is_internal"].sum()) if not new_rows.empty else 0
    active = new_rows[~new_rows["is_internal"]] if not new_rows.empty else new_rows
    categorized = int((active["category"] != "Uncategorized").sum())
    uncategorized = int((active["category"] == "Uncategorized").sum())

    groups: list[UncategorizedGroup] = []
    if not active.empty:
        unc = active[active["category"] == "Uncategorized"].copy()
        unc["counterparty"] = unc["counterparty"].fillna("").astype(str)
        for cp, grp in unc.groupby("counterparty", sort=False):
            bank_cat_mode = grp["bank_category"].mode()
            groups.append(UncategorizedGroup(
                counterparty=str(cp) or "(unknown)",
                sample_title=str(grp.iloc[0].get("title", "")),
                count=len(grp),
                total_amount=float(grp["abs_amount"].sum()),
                tx_ids=grp["id"].tolist(),
                bank_category=str(bank_cat_mode.iloc[0]) if not bank_cat_mode.empty else "",
            ))
        groups.sort(key=lambda g: -g.count)

    return IngestResult(
        source_file=file.filename,
        total_rows=len(df),
        imported=len(new_rows),
        duplicates_skipped=duplicates,
        internal_marked=internal,
        categorized=categorized,
        uncategorized=uncategorized,
        uncategorized_groups=groups,
    )
