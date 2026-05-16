"""
Gmail OAuth2 endpoints + BLIK enrichment.

Setup:
  1. Create OAuth2 credentials in Google Cloud Console (Web application type).
  2. Add the redirect URI as an authorised redirect URI in Google Cloud Console.
  3. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET in .env.
     Optionally set GMAIL_REDIRECT_URI (default: http://localhost:8000/api/v1/gmail/callback).
  4. Visit GET /api/v1/gmail/auth-url, open the returned URL, authorise.
  5. Tokens are stored in the app_settings table automatically.
"""
import json
import logging
import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

from app.config import settings
from app.database import db
from app.services import gmail as gmail_svc

log = logging.getLogger(__name__)
router = APIRouter(prefix="/gmail", tags=["gmail"])

_BLIK_REF_RE = re.compile(r"BLIK\s+REF\s+(\d+)", re.IGNORECASE)


# ── token helpers ─────────────────────────────────────────────────────────────

def _load_token() -> Optional[dict]:
    with db() as conn:
        row = conn.execute(
            "SELECT value FROM app_settings WHERE key = 'gmail_token'"
        ).fetchone()
    if not row:
        return None
    try:
        return json.loads(row[0])
    except Exception:
        return None


def _save_token(token: dict) -> None:
    val = json.dumps(token)
    with db() as conn:
        existing = conn.execute(
            "SELECT key FROM app_settings WHERE key = 'gmail_token'"
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE app_settings SET value = ? WHERE key = 'gmail_token'", [val]
            )
        else:
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES ('gmail_token', ?)", [val]
            )


def _require_credentials():
    if not settings.gmail_client_id or not settings.gmail_client_secret:
        raise HTTPException(400, "GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET not set in .env")


async def _valid_access_token() -> str:
    _require_credentials()
    token = _load_token()
    if not token:
        raise HTTPException(401, "Gmail not connected — call GET /api/v1/gmail/auth-url first")
    access_token, refreshed = await gmail_svc.get_valid_token(
        token, settings.gmail_client_id, settings.gmail_client_secret
    )
    if refreshed:
        _save_token(refreshed)
    return access_token


# ── routes ────────────────────────────────────────────────────────────────────

@router.get("/status")
def gmail_status():
    if not settings.gmail_client_id:
        return {"connected": False, "reason": "no_credentials"}
    token = _load_token()
    if not token:
        return {"connected": False, "reason": "not_authorized"}
    return {"connected": True}


@router.get("/auth-url")
def get_auth_url():
    _require_credentials()
    url = gmail_svc.get_auth_url(settings.gmail_client_id, settings.gmail_redirect_uri)
    return {"url": url}


@router.get("/callback", response_class=HTMLResponse)
async def gmail_callback(code: str = Query(...)):
    _require_credentials()
    try:
        token = await gmail_svc.exchange_code(
            settings.gmail_client_id, settings.gmail_client_secret, code, settings.gmail_redirect_uri
        )
        _save_token(token)
    except Exception as e:
        log.error("Gmail OAuth callback failed: %s", e)
        return HTMLResponse(
            "<h2>Gmail connection failed</h2><p>Check server logs and try again.</p>",
            status_code=400,
        )
    return HTMLResponse(
        "<h2>Gmail connected!</h2>"
        "<p>SpendWisely can now read your inbox to identify BLIK merchants.</p>"
        "<p>You can close this window.</p>"
        "<script>window.close();</script>"
    )


@router.delete("/disconnect")
def gmail_disconnect():
    with db() as conn:
        conn.execute("DELETE FROM app_settings WHERE key = 'gmail_token'")
    return {"ok": True}


@router.post("/enrich-blik")
async def enrich_blik(tx_ids: list[str]):
    """
    Search Gmail for confirmation emails matching each BLIK transaction.
    Returns enrichment suggestions — does NOT auto-apply.
    Apply via PATCH /api/v1/transactions/{tx_id}.
    """
    if not tx_ids:
        return {"enrichments": []}

    access_token = await _valid_access_token()

    with db() as conn:
        placeholders = ",".join(["?"] * len(tx_ids))
        rows = conn.execute(
            f"SELECT id, booking_date, title, abs_amount, currency "
            f"FROM transactions WHERE id IN ({placeholders})",
            tx_ids,
        ).fetchall()

    enrichments = []
    for tx_id, booking_date, title, abs_amount, currency in rows:
        m = _BLIK_REF_RE.search(str(title))
        blik_ref = m.group(1) if m else None
        date_str = str(booking_date)[:10]

        query = gmail_svc.build_blik_query(blik_ref, date_str, abs_amount)
        messages = await gmail_svc.search_messages(access_token, query, max_results=5)

        suggested_merchant = None
        suggested_category = None
        email_subject = None

        for msg in messages:
            try:
                subject, body = await gmail_svc.get_message_content(access_token, msg["id"])
                merchant, category = gmail_svc.identify_merchant(subject, body)
                if merchant:
                    suggested_merchant = merchant
                    suggested_category = category
                    email_subject = subject
                    break
                if not email_subject:
                    email_subject = subject  # keep for display even without match
            except Exception as e:
                log.warning("Failed to fetch Gmail message %s: %s", msg["id"], e)

        enrichments.append({
            "tx_id": tx_id,
            "blik_ref": blik_ref,
            "booking_date": date_str,
            "amount": abs_amount,
            "currency": currency,
            "suggested_merchant": suggested_merchant,
            "suggested_category": suggested_category,
            "email_subject": email_subject,
            "confidence": "high" if (blik_ref and suggested_merchant) else
                          "medium" if suggested_merchant else "none",
        })

    return {"enrichments": enrichments}
