"""
main.py
=======
End-to-end pipeline:
  1. Parse raw bank CSV  →  clean Parquet
  2. Enrich with categories (auto rules + optional human review)  →  enriched Parquet
  3. Generate insights + report

Quick start
-----------
    python main.py dec-feb.csv
    python main.py dec-feb.csv --review          # interactive categorisation
    python main.py dec-feb.csv --review --gui    # Tkinter GUI review
    python main.py dec-feb.csv --report-only     # skip parse/enrich, just insights
"""

import argparse
import logging
from pathlib import Path

import pandas as pd

from bank_parser import BankParser
from bank_enricher import BankEnricher, DEFAULT_RULES
from bank_insights import BankInsights

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)


def run_pipeline(
    csv_path: str,
    output_dir: str = "output",
    rules_json: str = "my_rules.json",
    do_review: bool = False,
    use_gui: bool = False,
    min_review_amount: float = 10.0,
    report_only: bool = False,
) -> BankInsights:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    enriched_parquet = out / "enriched.parquet"

    # ------------------------------------------------------------------ #
    # Step 1 – Parse                                                       #
    # ------------------------------------------------------------------ #
    if not report_only:
        log.info("── Step 1: Parsing %s", csv_path)
        parser = BankParser(csv_path)
        df = parser.parse()
        parser.save(out / "clean")
        log.info("   %d rows parsed.", len(df))
    else:
        log.info("── Skipping parse (--report-only). Loading enriched.parquet")
        df = pd.read_parquet(enriched_parquet)

    # ------------------------------------------------------------------ #
    # Step 2 – Enrich                                                      #
    # ------------------------------------------------------------------ #
    if not report_only:
        log.info("── Step 2: Enriching with category rules")
        enricher = BankEnricher(df, rules=DEFAULT_RULES, rules_path=rules_json)
        enricher.apply_rules()

        n_uncategorized = (enricher.df["category"] == "Uncategorized").sum()
        log.info("   %d transactions still uncategorized.", n_uncategorized)

        if do_review and n_uncategorized > 0:
            log.info("── Starting human review …")
            enricher.review_uncategorized(
                min_amount=min_review_amount,
                use_gui=use_gui,
            )
        else:
            todo = enricher.top_uncategorized(n=10, min_total=50)
            if not todo.empty:
                log.info("   Top uncategorized merchants:\n%s", todo.to_string(index=False))

        saved = enricher.save(out / "enriched")
        log.info("   Enriched data saved: %s", saved)
        df = enricher.df

    # ------------------------------------------------------------------ #
    # Step 3 – Insights                                                    #
    # ------------------------------------------------------------------ #
    log.info("── Step 3: Generating insights")
    ins = BankInsights(df)
    ins.full_report()
    ins.save_report(out / "report.txt")
    return ins


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    ap = argparse.ArgumentParser(
        description="Polish bank CSV → insights pipeline",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    ap.add_argument("csv", nargs="?", default="dec-feb.csv", help="Source CSV file")
    ap.add_argument("-o", "--output", default="output", help="Output directory")
    ap.add_argument("-r", "--rules", default="my_rules.json", help="Rules JSON path")
    ap.add_argument("--review", action="store_true", help="Human review of uncategorized tx")
    ap.add_argument("--gui", action="store_true", help="Use Tkinter GUI for review")
    ap.add_argument("--min-amount", type=float, default=10.0, help="Skip review for amounts below this")
    ap.add_argument("--report-only", action="store_true", help="Skip parse/enrich, just run insights")
    args = ap.parse_args()

    run_pipeline(
        csv_path=args.csv,
        output_dir=args.output,
        rules_json=args.rules,
        do_review=args.review,
        use_gui=args.gui,
        min_review_amount=args.min_amount,
        report_only=args.report_only,
    )