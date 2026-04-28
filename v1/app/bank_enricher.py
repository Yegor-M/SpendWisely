"""
bank_enricher.py
================
Interactively enriches a parsed bank DataFrame:
  - Applies regex CategoryRules automatically
  - Lets a human categorise remaining 'Uncategorized' transactions
    via a simple terminal UI (or a Tkinter GUI if available)
  - Saves enriched Parquet + CSV + a rules JSON so learned mappings
    persist across sessions

Usage
-----
    from bank_parser  import BankParser
    from bank_enricher import BankEnricher, CategoryRule

    df = BankParser("dec-feb.csv").parse()

    enricher = BankEnricher(df, rules_path="my_rules.json")
    enricher.apply_rules()               # auto-categorise
    enricher.review_uncategorized()      # human loop
    enriched_df = enricher.df
    enricher.save("output/enriched")
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class CategoryRule:
    """One regex-based categorisation rule."""
    category: str
    pattern: str          # regex (case-insensitive)
    fields: list[str] = field(default_factory=lambda: [
        "counterparty", "title", "operation_type", "counterparty_address"
    ])
    comment: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "CategoryRule":
        return CategoryRule(
            category=d["category"],
            pattern=d["pattern"],
            fields=d.get("fields", ["counterparty", "title", "operation_type"]),
            comment=d.get("comment", ""),
        )


# ---------------------------------------------------------------------------
# Default starter rules (Polish market)
# ---------------------------------------------------------------------------

DEFAULT_RULES: list[CategoryRule] = [
    CategoryRule("Accounting",     r"\b(wfirma|faktura|invoice|ksieg|księg|autopay|innovative)\b"),
    CategoryRule("Groceries",      r"\b(biedronka|lidl|zabka|żabka|kaufland|auchan|carrefour|netto|dino)\b"),
    CategoryRule("Transport",      r"\b(uber|bolt|jakdojade|mpk|zkm|flixbus|pkp|intercity)\b"),
    CategoryRule("Food & Dining",  r"\b(pyszne|glovo|wolt|kfc|mcdonalds|pizza|sushi|restauracja|wok|lisek|burger|grill|kebab|restaurant)\b"),
    CategoryRule("Coffee/Ice Cream",r"\b(kawiarnia|coffeeheaven|starbucks|costa|caffe|kawa|kawalerka|gelateria)\b"),
    CategoryRule("Subscriptions",  r"\b(netflix|spotify|google|apple|microsoft|adobe|jdmi|dropbox|openai|chatgpt)\b"),
    CategoryRule("Services",       r"\b(barber|implant|ares|fryzjer|salon)\b"),
    CategoryRule("Rent & Housing", r"\b(agnieszka|czynsz|najem|czynszu|administracja)\b"),
    CategoryRule("Healthcare",     r"\b(apteka|pharmacy|medicover|lux\s?med|centrum\s?medyczne)\b"),
    CategoryRule("ATM / Cash",     r"\b(bankomat|wypłata|atm)\b"),
    CategoryRule("Transfers",      r"\b(przelew|transfer)\b"),
    CategoryRule("Pet Funtik",   r"\b(zoologiczny)\b"),
]


# ---------------------------------------------------------------------------
# Enricher
# ---------------------------------------------------------------------------

class BankEnricher:
    """
    Enriches a parsed bank DataFrame with human-assisted categorisation.

    Parameters
    ----------
    df          : Output of BankParser.parse() – must have 'counterparty',
                  'title', 'direction', 'abs_amount', 'category' columns.
    rules       : Initial list of CategoryRule objects.
    rules_path  : JSON file to persist / load learned rules.
    """

    UNCATEGORIZED = "Uncategorized"

    def __init__(
        self,
        df: pd.DataFrame,
        rules: Optional[list[CategoryRule]] = None,
        rules_path: str | Path = "my_rules.json",
    ):
        self.df = df.copy()
        self.rules_path = Path(rules_path)
        self._loaded_rules = self._load_rules_from_json()
        base = rules if rules is not None else DEFAULT_RULES
        # Merge: built-in first, then persisted learned rules
        seen_patterns = {r.pattern for r in base}
        extra = [r for r in self._loaded_rules if r.pattern not in seen_patterns]
        self.rules: list[CategoryRule] = base + extra

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def apply_rules(self) -> "BankEnricher":
        """Apply all regex rules to the DataFrame. First match wins."""
        df = self.df
        # Reset to Uncategorized so re-runs are idempotent
        df["category"] = self.UNCATEGORIZED

        cache: dict[tuple, pd.Series] = {}

        for rule in self.rules:
            key = tuple(rule.fields)
            if key not in cache:
                cache[key] = self._build_search_text(rule.fields)

            mask = cache[key].str.contains(rule.pattern, regex=True, na=False, case=False)
            unset = df["category"] == self.UNCATEGORIZED
            df.loc[mask & unset, "category"] = rule.category

        n_done = (df["category"] != self.UNCATEGORIZED).sum()
        logger.info(
            "apply_rules: %d / %d transactions categorised (%.0f%%)",
            n_done, len(df), 100 * n_done / max(len(df), 1),
        )
        return self

    def review_uncategorized(
        self,
        min_amount: float = 0.0,
        max_items: int = 200,
        use_gui: bool = False,
    ) -> "BankEnricher":
        """
        Interactive loop to manually categorise remaining transactions.

        Parameters
        ----------
        min_amount : Skip transactions below this absolute amount.
        max_items  : Stop after reviewing this many items.
        use_gui    : Try to open Tkinter window instead of terminal.
        """
        todo = self._get_uncategorized(min_amount)
        if todo.empty:
            print("✅  All transactions are already categorised!")
            return self

        all_cats = self._all_categories()
        print(f"\n{'─'*60}")
        print(f"  {len(todo)} uncategorised transactions to review")
        print(f"  Available categories: {', '.join(all_cats)}")
        print(f"  Commands: [enter]=skip  q=quit  new=create new category")
        print(f"{'─'*60}\n")

        if use_gui:
            try:
                self._gui_review(todo, all_cats, max_items)
                return self
            except Exception as e:
                logger.warning("GUI unavailable (%s), falling back to terminal.", e)

        self._terminal_review(todo, all_cats, max_items)
        return self

    def add_rule(self, category: str, pattern: str, fields: Optional[list[str]] = None) -> "BankEnricher":
        """Add a new CategoryRule programmatically and persist it."""
        r = CategoryRule(
            category=category,
            pattern=pattern,
            fields=fields or ["counterparty", "title", "operation_type"],
        )
        self.rules.append(r)
        self._save_rules_to_json()
        logger.info("Rule added: '%s' → %s", pattern, category)
        return self

    def top_uncategorized(self, n: int = 20, min_total: float = 0.0) -> pd.DataFrame:
        """DataFrame of biggest uncategorised merchants by total spend."""
        tmp = self.df[
            (self.df["direction"] == "expense") &
            (self.df["category"] == self.UNCATEGORIZED)
        ].copy()
        if tmp.empty:
            return pd.DataFrame(columns=["counterparty", "total_spent", "tx_count"])
        out = (
            tmp.groupby("counterparty")
            .agg(total_spent=("abs_amount", "sum"), tx_count=("abs_amount", "size"))
            .reset_index()
            .sort_values("total_spent", ascending=False)
        )
        if min_total > 0:
            out = out[out["total_spent"] >= min_total]
        return out.head(n)

    def save(self, output_stem: str | Path = "output/enriched") -> dict[str, Path]:
        """Save enriched DataFrame and learned rules JSON."""
        stem = Path(output_stem)
        stem.parent.mkdir(parents=True, exist_ok=True)

        parquet_path = stem.with_suffix(".parquet")
        csv_path = stem.with_suffix(".csv")

        self.df.to_parquet(parquet_path, index=False)
        self.df.to_csv(csv_path, index=False, encoding="utf-8-sig")
        self._save_rules_to_json()

        logger.info("Enriched data → %s", parquet_path)
        logger.info("Enriched data → %s", csv_path)
        logger.info("Rules        → %s", self.rules_path)
        return {"parquet": parquet_path, "csv": csv_path, "rules": self.rules_path}

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_search_text(self, fields: list[str]) -> pd.Series:
        parts = [
            self.df[f].fillna("").astype(str)
            for f in fields if f in self.df.columns
        ]
        if not parts:
            return pd.Series([""] * len(self.df), index=self.df.index, dtype="string")
        combined = parts[0].copy()
        for p in parts[1:]:
            combined = combined + " " + p
        return combined.str.lower()

    def _get_uncategorized(self, min_amount: float) -> pd.DataFrame:
        mask = (
            (self.df["category"] == self.UNCATEGORIZED) &
            (self.df["abs_amount"] >= min_amount)
        )
        return self.df[mask].copy()

    def _all_categories(self) -> list[str]:
        cats = sorted({r.category for r in self.rules})
        existing = sorted(self.df["category"].dropna().unique())
        merged = sorted(set(cats + existing) - {self.UNCATEGORIZED})
        return merged

    # ------------------------------------------------------------------
    # Terminal UI
    # ------------------------------------------------------------------

    def _terminal_review(
        self,
        todo: pd.DataFrame,
        categories: list[str],
        max_items: int,
    ) -> None:
        reviewed = 0
        numbered_cats = {str(i + 1): c for i, c in enumerate(categories)}

        # Print category shortcut table
        print("Category shortcuts:")
        for num, cat in numbered_cats.items():
            print(f"  {num:>3}. {cat}")
        print()

        for idx, row in todo.iterrows():
            if reviewed >= max_items:
                print(f"\n⏸  Reached limit of {max_items} items. Run again for more.")
                break

            print(f"{'─'*60}")
            print(f"  📅 {row.get('booking_date', '')!s:<12}  💰 {row.get('abs_amount', 0):>10.2f} {row.get('currency', 'PLN')}")
            print(f"  🏢 {row.get('counterparty', '')}")
            print(f"  📝 {row.get('title', '')}")
            if row.get("operation_type"):
                print(f"  🔖 {row['operation_type']}")
            print()

            while True:
                raw = input("  Category (number / name / 'new' / Enter=skip / q=quit): ").strip()

                if raw == "":
                    break  # skip
                if raw.lower() == "q":
                    print("\n👋  Quit. Progress saved.")
                    self._save_rules_to_json()
                    return
                if raw.lower() == "new":
                    new_cat = input("  New category name: ").strip()
                    if new_cat:
                        pat_suggestion = row.get("counterparty", "").lower().split()[0] if row.get("counterparty") else ""
                        pat = input(f"  Regex pattern [{pat_suggestion}]: ").strip() or pat_suggestion
                        if pat:
                            self.add_rule(new_cat, pat)
                            # Apply to current index
                            self.df.at[idx, "category"] = new_cat
                            categories = self._all_categories()
                            numbered_cats = {str(i + 1): c for i, c in enumerate(categories)}
                            print(f"  ✅ Rule saved and category set to '{new_cat}'")
                        break
                    continue

                # Number shortcut
                if raw in numbered_cats:
                    chosen = numbered_cats[raw]
                    self.df.at[idx, "category"] = chosen
                    print(f"  ✅ → {chosen}")
                    reviewed += 1
                    break

                # Direct category name (partial match)
                matches = [c for c in categories if raw.lower() in c.lower()]
                if len(matches) == 1:
                    self.df.at[idx, "category"] = matches[0]
                    print(f"  ✅ → {matches[0]}")
                    reviewed += 1
                    break
                elif len(matches) > 1:
                    print(f"  Ambiguous: {matches}. Be more specific.")
                else:
                    print(f"  Unknown. Try a number, partial name, or 'new'.")

        print(f"\n✅  Review complete. {reviewed} items categorised this session.")

    # ------------------------------------------------------------------
    # GUI (Tkinter)
    # ------------------------------------------------------------------

    def _gui_review(self, todo: pd.DataFrame, categories: list[str], max_items: int) -> None:
        """Simple Tkinter-based review window."""
        import tkinter as tk
        from tkinter import ttk, messagebox

        root = tk.Tk()
        root.title("Bank Transaction Enricher")
        root.geometry("820x520")

        rows_iter = iter(todo.iterrows())
        state = {"current_idx": None, "reviewed": 0}

        # ---- Layout ----
        top = tk.Frame(root, padx=12, pady=8)
        top.pack(fill=tk.X)

        info_var = tk.StringVar(value="Loading…")
        tk.Label(top, textvariable=info_var, font=("Courier", 10), justify=tk.LEFT,
                 anchor="w", width=90, wraplength=760).pack(anchor="w")

        mid = tk.Frame(root, padx=12)
        mid.pack(fill=tk.X)

        tk.Label(mid, text="Category:").pack(side=tk.LEFT)
        cat_var = tk.StringVar()
        combo = ttk.Combobox(mid, textvariable=cat_var, values=categories, width=30)
        combo.pack(side=tk.LEFT, padx=4)

        new_cat_entry = tk.Entry(mid, width=20)
        new_cat_entry.insert(0, "or type new…")
        new_cat_entry.pack(side=tk.LEFT, padx=4)

        pat_entry = tk.Entry(mid, width=20)
        pat_entry.insert(0, "pattern (regex)")
        pat_entry.pack(side=tk.LEFT, padx=4)

        bot = tk.Frame(root, padx=12, pady=8)
        bot.pack(fill=tk.X)

        progress_var = tk.StringVar(value="0 reviewed")
        tk.Label(bot, textvariable=progress_var).pack(side=tk.RIGHT)

        def load_next():
            try:
                idx, row = next(rows_iter)
            except StopIteration:
                messagebox.showinfo("Done", "All transactions reviewed!")
                root.destroy()
                return
            if state["reviewed"] >= max_items:
                messagebox.showinfo("Limit", f"Reached limit of {max_items}.")
                root.destroy()
                return
            state["current_idx"] = idx
            info_var.set(
                f"Date:  {row.get('booking_date', '')!s:<12}   "
                f"Amount: {row.get('abs_amount', 0):>10.2f} {row.get('currency', 'PLN')}\n"
                f"From:  {row.get('counterparty', '')}\n"
                f"Title: {row.get('title', '')}\n"
                f"Type:  {row.get('operation_type', '')}"
            )
            cat_var.set("")

        def apply_choice():
            idx = state["current_idx"]
            if idx is None:
                return
            new_cat_text = new_cat_entry.get().strip()
            pat_text = pat_entry.get().strip()
            chosen = new_cat_text if new_cat_text and new_cat_text != "or type new…" else cat_var.get().strip()

            if not chosen:
                messagebox.showwarning("No category", "Select or type a category first.")
                return

            self.df.at[idx, "category"] = chosen

            if new_cat_text and new_cat_text != "or type new…" and pat_text and pat_text != "pattern (regex)":
                self.add_rule(chosen, pat_text)
                combo["values"] = self._all_categories()

            state["reviewed"] += 1
            progress_var.set(f"{state['reviewed']} reviewed")
            load_next()

        def skip():
            load_next()

        tk.Button(bot, text="✅  Apply", command=apply_choice, bg="#4caf50", fg="white", width=12).pack(side=tk.LEFT, padx=4)
        tk.Button(bot, text="⏭  Skip",  command=skip,         bg="#2196f3", fg="white", width=12).pack(side=tk.LEFT, padx=4)
        tk.Button(bot, text="💾  Save & Quit",
                  command=lambda: (self._save_rules_to_json(), root.destroy()),
                  bg="#ff9800", fg="white", width=14).pack(side=tk.LEFT, padx=4)

        load_next()
        root.mainloop()

    # ------------------------------------------------------------------
    # Rules persistence
    # ------------------------------------------------------------------

    def _save_rules_to_json(self) -> None:
        data = [r.to_dict() for r in self.rules]
        self.rules_path.parent.mkdir(parents=True, exist_ok=True)
        with self.rules_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_rules_from_json(self) -> list[CategoryRule]:
        if not self.rules_path.exists():
            return []
        with self.rules_path.open(encoding="utf-8") as f:
            data = json.load(f)
        rules = []
        for d in data:
            try:
                rules.append(CategoryRule.from_dict(d))
            except Exception as e:
                logger.warning("Skipping malformed rule %r: %s", d, e)
        logger.info("Loaded %d rules from %s", len(rules), self.rules_path)
        return rules


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    ap = argparse.ArgumentParser(description="Enrich parsed bank data with categories")
    ap.add_argument("parquet", help="Path to clean.parquet from bank_parser")
    ap.add_argument("-r", "--rules", default="my_rules.json")
    ap.add_argument("-o", "--output", default="output/enriched")
    ap.add_argument("--gui", action="store_true", help="Use Tkinter GUI")
    ap.add_argument("--min-amount", type=float, default=10.0)
    args = ap.parse_args()

    df = pd.read_parquet(args.parquet)
    enricher = BankEnricher(df, rules_path=args.rules)
    enricher.apply_rules()
    enricher.review_uncategorized(min_amount=args.min_amount, use_gui=args.gui)
    saved = enricher.save(args.output)
    print(f"\nSaved: {saved}")