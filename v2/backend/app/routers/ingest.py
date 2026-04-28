import io
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from app.database import db
from app.models import IngestResult
from app.services.parser import parse_csv
from app.services.enricher import BankEnricher
from app.config import settings
import tempfile, os

log = logging.getLogger(__name__)
router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestResult)
async def ingest_csv(
    file: UploadFile = File(...),
    use_llm: bool  = Query(default=True,  description="Run LLM categorisation pass"),
    provider: str  = Query(default="",    description="Override LLM provider (claude|openai|gemini)"),
    model: str     = Query(default="",    description="Override model name"),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only .csv files are supported")

    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        df = parse_csv(tmp_path, owner_name=settings.owner_name)
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

    return IngestResult(
        source_file=file.filename,
        total_rows=len(df),
        imported=len(new_rows),
        duplicates_skipped=duplicates,
        internal_marked=internal,
        categorized=categorized,
        uncategorized=uncategorized,
    )
