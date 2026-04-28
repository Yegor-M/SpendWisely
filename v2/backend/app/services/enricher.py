"""
Three-pass enrichment pipeline:
  1. Bank Kategoria mapping  — covers ~70% of real transactions immediately
  2. Regex rules             — covers business-specific patterns
  3. LLM fallback            — Claude / OpenAI / Gemini for whatever remains
"""
from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

import pandas as pd

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 1. Bank Kategoria → our category
# ---------------------------------------------------------------------------
BANK_CATEGORY_MAP: dict[str, str] = {
    "Artykuły spożywcze":                       "Groceries",
    "Restauracje i kawiarnie":                   "Food & Dining",
    "Taxi":                                      "Transport",
    "Transport publiczny":                       "Transport",
    "Paliwo":                                    "Transport",
    "Kino i teatr":                              "Entertainment",
    "Puby i kluby":                              "Entertainment",
    "Multimedia":                                "Subscriptions",
    "Kosmetyki":                                 "Personal Care",
    "Uroda, fryzjer, kosmetyczka":               "Personal Care",
    "Ubrania":                                   "Clothing",
    "Alkohol":                                   "Food & Dining",
    "Zwierzęta domowe":                          "Pets",
    "Sport":                                     "Sports & Fitness",
    "Lekarstwa":                                 "Healthcare",
    "Opieka medyczna":                           "Healthcare",
    "Bilety lotnicze":                           "Travel",
    "Hotele":                                    "Travel",
    "Czynsz":                                    "Rent & Housing",
    "Zakupy przez internet":                     "Online Shopping",
    "Prezenty, upominki":                        "Gifts",
    "Ogród":                                     "Home",
    "Założenie lokaty, zakup funduszy, akcji":   "Investments",
    "Opłaty bankowe":                            "Banking Fees",
    "Sprzedaż":                                  "Income",
    "Przelew wewnętrzny":                        "Internal Transfer",
    # Intentionally unmapped — sent to regex / Claude:
    # "Bez kategorii", "Inne"
}

# ---------------------------------------------------------------------------
# 2. Regex rules
# ---------------------------------------------------------------------------
@dataclass
class CategoryRule:
    category: str
    pattern: str
    fields: list[str] = field(default_factory=lambda: ["counterparty", "title", "operation_type"])
    priority: int = 0
    comment: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "CategoryRule":
        return CategoryRule(
            category=d["category"],
            pattern=d["pattern"],
            fields=d.get("fields", ["counterparty", "title", "operation_type"]),
            priority=d.get("priority", 0),
            comment=d.get("comment", ""),
        )


DEFAULT_RULES: list[CategoryRule] = [
    # Business / accounting
    CategoryRule("Accounting",      r"\b(?:wfirma|faktura|invoice|autopay|innovative|orange\.pl)\b",    priority=10),
    CategoryRule("Accounting",      r"\b(?:prokura|biuro rachunkowe|ksieg)\b",                          priority=10),
    # Groceries
    CategoryRule("Groceries",       r"\b(?:biedronka|lidl|zabka|żabka|kaufland|auchan|carrefour|netto|dino|stokrotka|rossmann)\b"),
    # Transport
    CategoryRule("Transport",       r"\b(?:uber|bolt|jakdojade|mpk|zkm|flixbus|pkp|intercity|skycash|ztm|bilet)\b"),
    # Food
    CategoryRule("Food & Dining",   r"\b(?:pyszne|glovo|wolt|kfc|mcdonalds|pizza|sushi|restauracja|wok|lisek|burger|grill|kebab|popeyes|gaga)\b"),
    CategoryRule("Food & Dining",   r"\b(?:restaurant|bistro|bar mleczny|pierogarnia)\b"),
    # Coffee
    CategoryRule("Coffee & Cafes",  r"\b(?:kawiarnia|starbucks|costa|caffe|green caffe|nero|coffeeheaven|gelateria|lody)\b"),
    # Subscriptions & SaaS
    CategoryRule("Subscriptions",   r"\b(?:netflix|spotify|google|apple|microsoft|adobe|jdmi|dropbox|openai|chatgpt|claude|anthropic)\b"),
    # Accounting tools
    CategoryRule("Accounting",      r"\bweb innovative\b"),
    # Rent
    CategoryRule("Rent & Housing",  r"\b(?:agnieszka|czynsz|najem|administracja|malinowska)\b"),
    # Health
    CategoryRule("Healthcare",      r"\b(?:apteka|pharmacy|medicover|lux\s?med|centrum medyczne|dentist|stomatolog|implant)\b"),
    # Personal care
    CategoryRule("Personal Care",   r"\b(?:barber|fryzjer|salon|expert barber|rossmann|drogeria|sephora)\b"),
    # Cash
    CategoryRule("ATM / Cash",      r"\b(?:bankomat|wypłata|atm)\b"),
    # Pets
    CategoryRule("Pets",            r"\b(?:zoologiczny|zooplus|pupil|animalia)\b"),
    # Travel
    CategoryRule("Travel",          r"\b(?:wizzair|ryanair|lot\.pl|booking|airbnb|hostel|hotel|paypro)\b"),
    # Crypto
    CategoryRule("Crypto",          r"\b(?:binance|kraken|coinbase|crypto)\b"),
    # Entertainment
    CategoryRule("Entertainment",   r"\b(?:helios|kino|klub|cinema|teatr|eventim|midaticket|ticketmaster)\b"),
    # Shopping
    CategoryRule("Online Shopping", r"\b(?:allegro|amazon|zalando|ole ole|empik)\b"),
    # Sports
    CategoryRule("Sports & Fitness",r"\b(?:ares|fight club|fitprofit|multisport|siłownia|gym)\b"),
    # Gifts
    CategoryRule("Gifts",           r"\b(?:kwiaciarnia|flowers|prezent)\b"),
    # Transfers (last resort)
    CategoryRule("Transfers",       r"\b(?:przelew|transfer)\b", priority=-10),
]


def _build_search_text(df: pd.DataFrame, fields: list[str]) -> pd.Series:
    parts = [df[f].fillna("").astype(str) for f in fields if f in df.columns]
    if not parts:
        return pd.Series([""] * len(df), index=df.index, dtype="string")
    combined = parts[0]
    for p in parts[1:]:
        combined = combined + " " + p
    return combined.str.lower()


# ---------------------------------------------------------------------------
# Enricher
# ---------------------------------------------------------------------------
class BankEnricher:
    UNCATEGORIZED = "Uncategorized"

    def __init__(
        self,
        df: pd.DataFrame,
        rules: Optional[list[CategoryRule]] = None,
        rules_path: str | Path = "category_rules.json",
    ):
        self.df = df.copy()
        self.rules_path = Path(rules_path)
        loaded = self._load_rules()
        base = rules if rules is not None else DEFAULT_RULES
        seen = {r.pattern for r in base}
        extra = [r for r in loaded if r.pattern not in seen]
        self.rules: list[CategoryRule] = sorted(base + extra, key=lambda r: -r.priority)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def apply_bank_categories(self) -> "BankEnricher":
        """Pass 1: map bank-provided Polish category strings."""
        df = self.df
        if "bank_category" not in df.columns:
            return self
        mapped = df["bank_category"].map(BANK_CATEGORY_MAP)
        mask = mapped.notna() & (df["category"] == self.UNCATEGORIZED) & (~df["is_internal"])
        df.loc[mask, "category"] = mapped[mask]
        n = mask.sum()
        log.info("Bank category mapping: %d transactions categorised", n)
        return self

    def apply_rules(self) -> "BankEnricher":
        """Pass 2: regex rules on text fields."""
        df = self.df
        cache: dict[tuple, pd.Series] = {}
        for rule in self.rules:
            key = tuple(rule.fields)
            if key not in cache:
                cache[key] = _build_search_text(df, list(rule.fields))
            mask = cache[key].str.contains(rule.pattern, regex=True, na=False, case=False)
            unset = (df["category"] == self.UNCATEGORIZED) & (~df["is_internal"])
            df.loc[mask & unset, "category"] = rule.category
        n = ((df["category"] != self.UNCATEGORIZED) & (~df["is_internal"])).sum()
        log.info("After regex rules: %d / %d non-internal transactions categorised",
                 n, (~df["is_internal"]).sum())
        return self

    def apply_llm(self, provider: str = "", model: str = "") -> "BankEnricher":
        """Pass 3: LLM categorisation for remaining unknowns (Claude / OpenAI / Gemini)."""
        from app.services.llm import get_provider

        llm = get_provider(provider=provider, model=model)
        if llm is None:
            return self

        todo = self.df[
            (self.df["category"] == self.UNCATEGORIZED) &
            (~self.df["is_internal"]) &
            (self.df["direction"] == "expense")
        ].copy()

        if todo.empty:
            log.info("No uncategorized transactions for LLM")
            return self

        log.info("Sending %d transactions to LLM for categorisation", len(todo))
        categories = sorted({r.category for r in self.rules} | set(BANK_CATEGORY_MAP.values()))
        suggestions = llm.categorize(todo, categories)

        for tx_id, cat in suggestions.items():
            if cat and cat != self.UNCATEGORIZED:
                self.df.loc[self.df["id"] == tx_id, "category"] = cat

        applied = len([c for c in suggestions.values() if c and c != self.UNCATEGORIZED])
        log.info("LLM categorised %d transactions", applied)
        return self

    def run(self, use_llm: bool = True, provider: str = "", model: str = "") -> pd.DataFrame:
        self.apply_bank_categories()
        self.apply_rules()
        if use_llm:
            self.apply_llm(provider=provider, model=model)
        return self.df

    def save_rules(self) -> None:
        data = [r.to_dict() for r in self.rules]
        self.rules_path.parent.mkdir(parents=True, exist_ok=True)
        with self.rules_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_rules(self) -> list[CategoryRule]:
        if not self.rules_path.exists():
            return []
        with self.rules_path.open(encoding="utf-8") as f:
            return [CategoryRule.from_dict(d) for d in json.load(f)]


