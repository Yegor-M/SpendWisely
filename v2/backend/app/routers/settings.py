import logging
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])

# .env lives two levels up from app/routers/
_ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"

_KEY_ATTR = {
    "claude": "anthropic_api_key",
    "openai": "openai_api_key",
    "gemini": "google_api_key",
}
_ENV_VAR = {
    "claude": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GOOGLE_API_KEY",
}


class LLMSettingsIn(BaseModel):
    provider: str
    api_key: str
    model: str = ""


@router.get("/llm")
def get_llm_settings():
    provider = settings.llm_provider
    key_set = bool(getattr(settings, _KEY_ATTR.get(provider, ""), ""))
    return {"provider": provider, "model": settings.llm_model, "key_set": key_set}


@router.post("/llm")
def save_llm_settings(body: LLMSettingsIn):
    if body.provider not in _KEY_ATTR:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {body.provider}")

    # Update in-memory — takes effect immediately without restart
    settings.llm_provider = body.provider
    settings.llm_model = body.model
    setattr(settings, _KEY_ATTR[body.provider], body.api_key)

    _persist_env(body.provider, body.api_key, body.model)
    log.info("LLM settings updated: provider=%s model=%s", body.provider, body.model or "default")
    return {"ok": True}


def _persist_env(provider: str, api_key: str, model: str) -> None:
    content = _ENV_PATH.read_text() if _ENV_PATH.exists() else ""

    def upsert(text: str, var: str, value: str) -> str:
        pattern = rf"^{var}=.*$"
        line = f"{var}={value}"
        if re.search(pattern, text, flags=re.MULTILINE):
            return re.sub(pattern, line, text, flags=re.MULTILINE)
        sep = "\n" if text and not text.endswith("\n") else ""
        return text + sep + line + "\n"

    content = upsert(content, "LLM_PROVIDER", provider)
    content = upsert(content, _ENV_VAR[provider], api_key)
    if model:
        content = upsert(content, "LLM_MODEL", model)

    _ENV_PATH.write_text(content)
