"""
Universal LLM provider for transaction categorisation.

Supports Claude (Anthropic), ChatGPT (OpenAI), and Gemini (Google).
Configure via .env:

    LLM_PROVIDER=claude    # claude | openai | gemini
    LLM_MODEL=             # optional override; uses provider default if blank
    ANTHROPIC_API_KEY=...
    OPENAI_API_KEY=...
    GOOGLE_API_KEY=...

All providers receive the same prompt and return {tx_id: category} JSON.
Claude additionally uses prompt caching on the system prompt.
"""
from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod

import pandas as pd

from app.config import settings

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared prompt
# ---------------------------------------------------------------------------
_SYSTEM = """You are a financial transaction categoriser for a Polish personal finance app.

Given a list of bank transactions, return ONLY a valid JSON object mapping \
each transaction ID to one category name from the provided list.

Rules:
- Pick the most specific matching category
- Polish merchant context: Biedronka/Lidl/Żabka=Groceries; Wolt/Glovo=Food & Dining; \
ZTM/SkyCash=Transport; wFirma/Autopay=Accounting
- If truly ambiguous, prefer "Online Shopping" over "Uncategorized"
- Return ONLY the JSON object — no markdown, no explanation, no extra keys"""


def _build_user_message(batch: pd.DataFrame, categories: list[str]) -> str:
    cat_str = ", ".join(sorted(categories))
    lines = [f"Available categories: {cat_str}\n\nCategorise:"]
    for _, row in batch.iterrows():
        lines.append(
            f"{row['id']}: {row.get('counterparty','')} | {row.get('title','')} "
            f"| {row.get('abs_amount',0):.2f} {row.get('currency','PLN')} "
            f"| bank_cat: {row.get('bank_category','')}"
        )
    return "\n".join(lines)


def _parse_json(text: str) -> dict[str, str]:
    text = text.strip()
    text = re.sub(r"^```[a-z]*\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    return json.loads(text)


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------
class LLMProvider(ABC):
    @abstractmethod
    def categorize_batch(
        self,
        batch: pd.DataFrame,
        categories: list[str],
    ) -> dict[str, str]:
        """Return {tx_id: category} for one batch."""

    def categorize(
        self,
        df: pd.DataFrame,
        categories: list[str],
        batch_size: int = 60,
    ) -> dict[str, str]:
        results: dict[str, str] = {}
        for start in range(0, len(df), batch_size):
            batch = df.iloc[start : start + batch_size]
            try:
                results.update(self.categorize_batch(batch, categories))
            except Exception as e:
                log.error("%s batch %d failed: %s", self.__class__.__name__, start // batch_size, e)
        return results


# ---------------------------------------------------------------------------
# Claude (Anthropic) — with prompt caching
# ---------------------------------------------------------------------------
class ClaudeProvider(LLMProvider):
    DEFAULT_MODEL = "claude-sonnet-4-6"

    def __init__(self, api_key: str, model: str = ""):
        import anthropic
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model or self.DEFAULT_MODEL

    def categorize_batch(self, batch: pd.DataFrame, categories: list[str]) -> dict[str, str]:
        response = self._client.messages.create(
            model=self._model,
            max_tokens=2048,
            system=[
                {
                    "type": "text",
                    "text": _SYSTEM,
                    "cache_control": {"type": "ephemeral"},  # cache system prompt
                }
            ],
            messages=[{"role": "user", "content": _build_user_message(batch, categories)}],
        )
        return _parse_json(response.content[0].text)


# ---------------------------------------------------------------------------
# OpenAI (ChatGPT)
# ---------------------------------------------------------------------------
class OpenAIProvider(LLMProvider):
    DEFAULT_MODEL = "gpt-4o-mini"

    def __init__(self, api_key: str, model: str = ""):
        from openai import OpenAI
        self._client = OpenAI(api_key=api_key)
        self._model = model or self.DEFAULT_MODEL

    def categorize_batch(self, batch: pd.DataFrame, categories: list[str]) -> dict[str, str]:
        response = self._client.chat.completions.create(
            model=self._model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user",   "content": _build_user_message(batch, categories)},
            ],
            max_tokens=2048,
        )
        return _parse_json(response.choices[0].message.content or "{}")


# ---------------------------------------------------------------------------
# Gemini (Google)
# ---------------------------------------------------------------------------
class GeminiProvider(LLMProvider):
    DEFAULT_MODEL = "gemini-2.0-flash"

    def __init__(self, api_key: str, model: str = ""):
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel(
            model_name=model or self.DEFAULT_MODEL,
            system_instruction=_SYSTEM,
            generation_config={"response_mime_type": "application/json"},
        )

    def categorize_batch(self, batch: pd.DataFrame, categories: list[str]) -> dict[str, str]:
        response = self._model.generate_content(_build_user_message(batch, categories))
        text = response.text  # raises if blocked; caught by LLMProvider.categorize
        return _parse_json(text or "{}")


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------
_PROVIDERS = {
    "claude": (ClaudeProvider, "anthropic_api_key"),
    "openai": (OpenAIProvider, "openai_api_key"),
    "gemini": (GeminiProvider, "google_api_key"),
}


def get_provider(provider: str = "", model: str = "") -> LLMProvider | None:
    """
    Return the configured LLM provider, or None if no API key is set.

    provider / model default to settings values when omitted.
    """
    provider = provider or settings.llm_provider
    model    = model    or settings.llm_model

    entry = _PROVIDERS.get(provider)
    if not entry:
        raise ValueError(f"Unknown LLM provider '{provider}'. Choose: {list(_PROVIDERS)}")

    cls, key_attr = entry
    api_key = getattr(settings, key_attr, "")
    if not api_key:
        log.warning("LLM_PROVIDER=%s but %s is not set — skipping LLM categorisation", provider, key_attr.upper())
        return None

    log.info("Using LLM provider: %s (model=%s)", provider, model or f"{cls.__name__} default")
    return cls(api_key=api_key, model=model)
