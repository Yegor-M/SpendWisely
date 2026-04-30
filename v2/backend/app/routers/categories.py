import logging
import pandas as pd
from fastapi import APIRouter, HTTPException
from app.database import db
from app.models import CategoryRule, SuggestItem
from app.services.enricher import BANK_CATEGORY_MAP, DEFAULT_RULES

log = logging.getLogger(__name__)
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


@router.post("/suggest")
def suggest_categories(items: list[SuggestItem]):
    """Run Haiku (or configured LLM) on representative transactions and return {id: category}."""
    from app.services.llm import get_provider

    if not items:
        return {}

    llm = get_provider(provider="claude", model="claude-haiku-4-5-20251001")
    if llm is None:
        llm = get_provider()
    if llm is None:
        return {}

    with db() as conn:
        db_cats = [r[0] for r in conn.execute(
            "SELECT DISTINCT category FROM transactions WHERE category != 'Uncategorized' ORDER BY category"
        ).fetchall()]

    all_cats = sorted(
        set(db_cats)
        | set(BANK_CATEGORY_MAP.values())
        | {r.category for r in DEFAULT_RULES}
    )

    df = pd.DataFrame([i.model_dump() for i in items])
    try:
        return llm.categorize(df, all_cats)
    except Exception as e:
        log.warning("LLM suggest failed: %s", e)
        return {}
