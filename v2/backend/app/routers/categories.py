from fastapi import APIRouter, HTTPException
from app.database import db
from app.models import CategoryRule
from app.services.enricher import BANK_CATEGORY_MAP

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("")
def list_categories():
    with db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT category FROM transactions WHERE category != 'Uncategorized' ORDER BY category"
        ).fetchall()
    return [r[0] for r in rows]


@router.get("/rules", response_model=list[CategoryRule])
def list_rules():
    with db() as conn:
        rows = conn.execute(
            "SELECT category, pattern, fields, priority, comment FROM category_rules ORDER BY priority DESC"
        ).fetchall()
    return [
        {"category": r[0], "pattern": r[1], "fields": r[2], "priority": r[3], "comment": r[4]}
        for r in rows
    ]


@router.post("/rules", response_model=CategoryRule)
def add_rule(rule: CategoryRule):
    with db() as conn:
        conn.execute(
            "INSERT INTO category_rules (id, category, pattern, fields, priority, comment) "
            "VALUES (nextval('category_rules_seq'), ?, ?, ?, ?, ?)",
            [rule.category, rule.pattern, rule.fields, rule.priority, rule.comment],
        )
    return rule


@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: int):
    with db() as conn:
        conn.execute("DELETE FROM category_rules WHERE id = ?", [rule_id])
    return {"deleted": rule_id}


@router.get("/bank-map")
def get_bank_map():
    return BANK_CATEGORY_MAP
