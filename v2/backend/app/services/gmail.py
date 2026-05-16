"""
Gmail OAuth2 (authorization-code flow) + BLIK email search.

Requires GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env.
Token stored in app_settings table under key 'gmail_token'.
Register http://localhost:8000/api/v1/gmail/callback in Google Cloud Console.
"""
from __future__ import annotations

import base64
import json
import re
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

SCOPES = "https://www.googleapis.com/auth/gmail.readonly"
_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GMAIL_API = "https://gmail.googleapis.com/gmail/v1"

# Known Polish payment-processor email senders
_PAYPRO_SENDERS = ["paypro.pl", "payu.pl", "przelewy24.pl"]

# Merchant heuristics: (regex, canonical_name, suggested_category)
_MERCHANT_PATTERNS: list[tuple[str, str, str]] = [
    (r"ryanair",                    "Ryanair",              "Travel"),
    (r"wizzair|wizz\s*air",         "Wizz Air",             "Travel"),
    (r"lot\s+polish|polskie\s+linie", "LOT Polish Airlines", "Travel"),
    (r"easyjet",                    "easyJet",              "Travel"),
    (r"booking\.com",               "Booking.com",          "Travel"),
    (r"airbnb",                     "Airbnb",               "Travel"),
    (r"flixbus",                    "FlixBus",              "Transport"),
    (r"regiojet",                   "RegioJet",             "Transport"),
    (r"rentalcars|sixt|hertz|avis|europcar", "Car Rental",  "Travel"),
    (r"tripadvisor",                "TripAdvisor",          "Travel"),
]


def get_auth_url(client_id: str, redirect_uri: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
    }
    return _AUTH_URL + "?" + urllib.parse.urlencode(params)


async def exchange_code(
    client_id: str, client_secret: str, code: str, redirect_uri: str
) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _TOKEN_URL,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        resp.raise_for_status()
        data = resp.json()
    data["expires_at"] = _expiry_ts(data.get("expires_in", 3600))
    return data


async def refresh_access_token(
    client_id: str, client_secret: str, old_token: dict
) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _TOKEN_URL,
            data={
                "refresh_token": old_token["refresh_token"],
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        data = resp.json()
    merged = {**old_token, **data}
    merged["expires_at"] = _expiry_ts(data.get("expires_in", 3600))
    return merged


def _expiry_ts(seconds: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()


def is_token_expired(token: dict) -> bool:
    try:
        exp = datetime.fromisoformat(token["expires_at"])
        return datetime.now(timezone.utc) >= exp - timedelta(seconds=60)
    except (KeyError, ValueError):
        return True


async def get_valid_token(
    token: dict, client_id: str, client_secret: str
) -> tuple[str, Optional[dict]]:
    """Return (access_token, refreshed_token_or_None)."""
    if not is_token_expired(token):
        return token["access_token"], None
    refreshed = await refresh_access_token(client_id, client_secret, token)
    return refreshed["access_token"], refreshed


async def search_messages(
    access_token: str, query: str, max_results: int = 5
) -> list[dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_GMAIL_API}/users/me/messages",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"q": query, "maxResults": max_results},
            timeout=10.0,
        )
        if resp.status_code in (401, 403):
            return []
        resp.raise_for_status()
    return resp.json().get("messages", [])


async def get_message_content(access_token: str, message_id: str) -> tuple[str, str]:
    """Return (subject, body_text[:800])."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_GMAIL_API}/users/me/messages/{message_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"format": "full"},
            timeout=10.0,
        )
        resp.raise_for_status()
        msg = resp.json()

    subject = ""
    for h in msg.get("payload", {}).get("headers", []):
        if h["name"].lower() == "subject":
            subject = h["value"]
            break

    body = msg.get("snippet", "")
    for part in _collect_parts(msg.get("payload", {})):
        mime = part.get("mimeType", "")
        if mime in ("text/plain", "text/html"):
            raw = part.get("body", {}).get("data", "")
            if raw:
                try:
                    body = base64.urlsafe_b64decode(raw + "==").decode("utf-8", errors="ignore")[:800]
                    break
                except Exception:
                    pass

    return subject, body


def _collect_parts(payload: dict) -> list[dict]:
    parts: list[dict] = []
    if payload.get("body", {}).get("data"):
        parts.append(payload)
    for p in payload.get("parts", []):
        parts.extend(_collect_parts(p))
    return parts


def identify_merchant(subject: str, body: str) -> tuple[Optional[str], Optional[str]]:
    """Heuristic merchant + category from email content. Returns (name, category)."""
    text = (subject + " " + body).lower()
    for pattern, name, category in _MERCHANT_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return name, category
    return None, None


def build_blik_query(blik_ref: Optional[str], date_str: str, amount: float) -> str:
    """Build Gmail search query for a BLIK transaction."""
    if blik_ref:
        return blik_ref  # BLIK REF is unique — direct search is most reliable
    d = datetime.strptime(date_str, "%Y-%m-%d")
    after = (d - timedelta(days=1)).strftime("%Y/%m/%d")
    before = (d + timedelta(days=2)).strftime("%Y/%m/%d")
    amount_str = f"{int(amount)}" if amount == int(amount) else str(amount)
    sender_q = " OR ".join(f"from:{s}" for s in _PAYPRO_SENDERS)
    return f"({sender_q}) after:{after} before:{before} {amount_str}"
