from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from app.database import db
from app.models import Transaction, TransactionPatch, ManualTransaction
import hashlib, datetime

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _row_to_tx(row) -> dict:
    keys = ["id","booking_date","value_date","month","counterparty","counterparty_address",
            "title","amount","abs_amount","currency","direction","category","bank_category",
            "operation_type","source_account","target_account","reference","is_internal",
            "source_file","imported_at"]
    return dict(zip(keys, row))


@router.get("", response_model=list[Transaction])
def list_transactions(
    month: Optional[str]      = Query(None, description="YYYY-MM"),
    category: Optional[str]   = Query(None),
    direction: Optional[str]  = Query(None, description="expense|income|internal"),
    currency: Optional[str]   = Query(None),
    search: Optional[str]     = Query(None),
    include_internal: bool     = Query(False),
    limit: int                 = Query(500, le=2000),
    offset: int                = Query(0),
):
    clauses = []
    params = []

    if not include_internal:
        clauses.append("is_internal = FALSE")
    if month:
        clauses.append("month = ?")
        params.append(month)
    if category:
        clauses.append("category = ?")
        params.append(category)
    if direction:
        clauses.append("direction = ?")
        params.append(direction)
    if currency:
        clauses.append("currency = ?")
        params.append(currency)
    if search:
        clauses.append("(LOWER(counterparty) LIKE ? OR LOWER(title) LIKE ?)")
        params += [f"%{search.lower()}%", f"%{search.lower()}%"]

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    with db() as conn:
        rows = conn.execute(
            f"SELECT * FROM transactions {where} ORDER BY booking_date DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()
    return [_row_to_tx(r) for r in rows]


@router.patch("/{tx_id}", response_model=Transaction)
def update_category(tx_id: str, patch: TransactionPatch):
    with db() as conn:
        conn.execute("UPDATE transactions SET category=? WHERE id=?", [patch.category, tx_id])
        row = conn.execute("SELECT * FROM transactions WHERE id=?", [tx_id]).fetchone()
    if not row:
        raise HTTPException(404, "Transaction not found")
    return _row_to_tx(row)


@router.delete("", status_code=200)
def delete_all_transactions():
    with db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        conn.execute("DELETE FROM transactions")
    return {"deleted": count}


@router.post("/cash", response_model=Transaction)
def add_cash_transaction(tx: ManualTransaction):
    tx_id = hashlib.sha1(
        f"{tx.booking_date}{tx.description}{tx.amount}".encode()
    ).hexdigest()[:16]

    row_dict = {
        "id": tx_id,
        "booking_date": str(tx.booking_date),
        "value_date": str(tx.booking_date),
        "month": tx.booking_date.strftime("%Y-%m"),
        "counterparty": tx.description,
        "counterparty_address": "",
        "title": tx.description,
        "amount": -abs(tx.amount),
        "abs_amount": abs(tx.amount),
        "currency": tx.currency,
        "direction": "expense",
        "category": tx.category,
        "bank_category": "Manual",
        "operation_type": "MANUAL",
        "source_account": "",
        "target_account": "",
        "reference": "",
        "is_internal": False,
        "source_file": "manual",
        "imported_at": None,
    }

    with db() as conn:
        conn.execute(
            """INSERT OR IGNORE INTO transactions
               (id,booking_date,value_date,month,counterparty,counterparty_address,
                title,amount,abs_amount,currency,direction,category,bank_category,
                operation_type,is_internal,source_file)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            [
                tx_id, str(tx.booking_date), str(tx.booking_date),
                row_dict["month"], tx.description, "", tx.description,
                row_dict["amount"], row_dict["abs_amount"], tx.currency,
                "expense", tx.category, "Manual", "MANUAL", False, "manual",
            ],
        )
    return row_dict
