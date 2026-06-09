import logging
import time
from collections import defaultdict
from threading import Lock

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from app.config import settings
from app.database import db
from app.models import CategoryRule, SuggestItem
from app.services.enricher import BANK_CATEGORY_MAP, DEFAULT_RULES

log = logging.getLogger(__name__)
router = APIRouter(prefix="/categories", tags=["categories"])

_rate_buckets: dict[str, list[float]] = defaultdict(list)
_rate_lock = Lock()


def _allow_request(ip: str) -> bool:
    now = time.time()
    limit = settings.suggest_rate_limit
    window = settings.suggest_rate_window
    with _rate_lock:
        _rate_buckets[ip] = [t for t in _rate_buckets[ip] if now - t < window]
        if len(_rate_buckets[ip]) >= limit:
            return False
        _rate_buckets[ip].append(now)
        return True


@router.get("")
def list_categories():
    with db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT category FROM transactions WHERE category != 'Uncategorized' ORDER BY category"
        ).fetchall()
    return [r[0] for r in rows]


@router.get("/rules")
def list_rules():
    with db() as conn:
        rows = conn.execute(
            "SELECT id, category, pattern, fields, priority, comment FROM category_rules ORDER BY priority DESC"
        ).fetchall()
    return [
        {"id": r[0], "category": r[1], "pattern": r[2], "fields": r[3], "priority": r[4], "comment": r[5]}
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


class RenameCatIn(BaseModel):
    from_cat: str
    to_cat: str


@router.get("/stats")
def list_category_stats():
    with db() as conn:
        rows = conn.execute(
            "SELECT category, COUNT(*) as cnt FROM transactions "
            "WHERE category != 'Uncategorized' GROUP BY category ORDER BY category"
        ).fetchall()
    return [{"name": r[0], "count": r[1]} for r in rows]


@router.patch("/rename")
def rename_category(body: RenameCatIn):
    if not body.to_cat.strip():
        raise HTTPException(status_code=400, detail="Category name cannot be empty")
    with db() as conn:
        conn.execute("UPDATE transactions SET category = ? WHERE category = ?",
                     [body.to_cat, body.from_cat])
        conn.execute("UPDATE category_rules SET category = ? WHERE category = ?",
                     [body.to_cat, body.from_cat])
    return {"ok": True}


@router.delete("/by-name")
def delete_category(name: str = Query(...)):
    with db() as conn:
        conn.execute("UPDATE transactions SET category = 'Uncategorized' WHERE category = ?", [name])
        conn.execute("DELETE FROM category_rules WHERE category = ?", [name])
    return {"ok": True}


@router.post("/suggest")
def suggest_categories(items: list[SuggestItem], request: Request):
    """Run configured LLM on representative transactions and return {id: category}."""
    from app.services.llm import get_provider

    if not items:
        return {}

    ip = request.client.host if request.client else "unknown"
    if not _allow_request(ip):
        raise HTTPException(
            status_code=429,
            detail=f"Too many AI suggest requests — try again in {settings.suggest_rate_window // 60} minutes",
        )

    llm = get_provider()
    if llm is None:
        raise HTTPException(
            status_code=503,
            detail="No LLM provider configured — set LLM_PROVIDER and the matching API key in your .env",
        )

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
        first_line = str(e).splitlines()[0]
        log.warning("LLM suggest failed: %s", e)
        raise HTTPException(status_code=502, detail=first_line)
