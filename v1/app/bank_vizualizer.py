"""
bank_visualizer.py  (v3 — full dashboard + inline editing)
===========================================================
Generates a self-contained interactive HTML dashboard from an enriched
bank DataFrame (output of BankEnricher).

Features
--------
  • 7 dashboard sections: Command Center, Cash Flow, Categories,
    Highlights, Merchants, Forecast, Transaction Log
  • Inline editing: category, date, counterparty, amount per transaction
  • Edits persisted in localStorage; survive page refresh
  • Download edited CSV (merges originals + overrides)
  • Stats auto-reload after every edit

Usage
-----
    from bank_visualizer import BankVisualizer
    import pandas as pd

    df = pd.read_parquet("output/enriched.parquet")
    viz = BankVisualizer(df)
    viz.save("output/dashboard.html")

CLI
---
    python bank_visualizer.py output/enriched.parquet
    python bank_visualizer.py output/enriched.csv --output my.html --no-open
"""

from __future__ import annotations

import json
import webbrowser
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd


def _sf(v) -> float:
    try:
        f = float(v)
        return 0.0 if (np.isnan(f) or np.isinf(f)) else f
    except Exception:
        return 0.0

def _exp(df): return df[df["direction"] == "expense"].copy()
def _inc(df): return df[df["direction"] == "income"].copy()

FIXED_CATS = {"Rent & Housing", "Subscriptions", "Accounting", "Intermediary"}


class BankVisualizer:
    def __init__(self, df: pd.DataFrame, currency: Optional[str] = None, title: str = "Finance"):
        self.df = df.copy().reset_index(drop=True)
        self.title = title
        if "month" not in self.df.columns:
            self.df["month"] = pd.to_datetime(self.df["booking_date"], errors="coerce").dt.to_period("M").astype(str)
        if "category" not in self.df.columns:
            self.df["category"] = "Uncategorized"
        if currency:
            self.currency = currency
        elif "currency" in df.columns:
            mode = df["currency"].dropna().mode()
            self.currency = mode.iloc[0] if not mode.empty else "PLN"
        else:
            self.currency = "PLN"
        self.df["_id"] = self.df.index.astype(str)

    def render(self) -> str:
        data = self._build_data()
        return _TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False, default=str)).replace("__TITLE__", self.title)

    def save(self, path: str | Path = "output/dashboard.html", auto_open: bool = True) -> Path:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(self.render(), encoding="utf-8")
        print(f"Dashboard → {p}")
        if auto_open:
            webbrowser.open(p.resolve().as_uri())
        return p

    def _build_data(self) -> dict:
        return {
            "meta":          self._meta(),
            "summary":       self._summary(),
            "monthly":       self._monthly(),
            "highlights":    self._highlights(),
            "forecast":      self._forecast(),
            "recurring":     self._recurring(),
            "transactions":  self._transactions(),
            "allCategories": sorted(self.df["category"].dropna().unique().tolist()),
        }

    def _meta(self) -> dict:
        months = sorted(self.df["month"].dropna().unique().tolist())
        return {"title": self.title, "currency": self.currency,
                "period": f"{months[0]} → {months[-1]}" if months else "", "months": months}

    def _summary(self) -> dict:
        e = _exp(self.df); i = _inc(self.df)
        n = max(self.df["month"].nunique(), 1)
        totE = _sf(e["abs_amount"].sum()); totI = _sf(i["abs_amount"].sum())
        net = totI - totE; sr = round(net / max(totI, 1) * 100, 1)
        fixedE = _sf(e[e["category"].isin(FIXED_CATS)]["abs_amount"].sum())
        fixPct = round(fixedE / max(totE, 1) * 100, 1)
        swing = self._biggest_swing()
        return {
            "total_income": round(totI, 2), "total_expenses": round(totE, 2),
            "net": round(net, 2), "savings_rate": sr,
            "avg_monthly_exp": round(totE / n, 2), "avg_monthly_inc": round(totI / n, 2),
            "fixed_pct": fixPct, "variable_pct": round(100 - fixPct, 1),
            "fixed_amount": round(fixedE, 2), "variable_amount": round(totE - fixedE, 2),
            "tx_count": int(len(self.df)), "swing": swing,
        }

    def _biggest_swing(self) -> dict:
        e = _exp(self.df)
        months = sorted(e["month"].unique())
        if len(months) < 2: return {}
        last, prev = months[-1], months[-2]
        lv = e[e["month"] == last].groupby("category")["abs_amount"].sum()
        pv = e[e["month"] == prev].groupby("category")["abs_amount"].sum()
        cats = set(lv.index) | set(pv.index)
        best_cat, best_delta = "", 0.0
        for c in cats:
            d = abs(_sf(lv.get(c, 0)) - _sf(pv.get(c, 0)))
            if d > best_delta: best_delta = d; best_cat = c
        if not best_cat: return {}
        return {"category": best_cat, "delta": round(_sf(lv.get(best_cat, 0)) - _sf(pv.get(best_cat, 0)), 2),
                "last": round(_sf(lv.get(best_cat, 0)), 2), "prev": round(_sf(pv.get(best_cat, 0)), 2)}

    def _monthly(self) -> dict:
        e = _exp(self.df).groupby("month")["abs_amount"].sum()
        i = _inc(self.df).groupby("month")["abs_amount"].sum()
        months = sorted(set(list(e.index) + list(i.index)))
        expenses = [round(_sf(e.get(m, 0)), 2) for m in months]
        income   = [round(_sf(i.get(m, 0)), 2) for m in months]
        savings  = [round(income[j] - expenses[j], 2) for j in range(len(months))]
        run = 0.0; cumulative = []
        for s in savings: run += s; cumulative.append(round(run, 2))
        exp_df = _exp(self.df).copy()
        exp_df["day"] = pd.to_datetime(exp_df["booking_date"], errors="coerce").dt.day
        day_totals = exp_df.groupby("day")["abs_amount"].sum()
        day_heatmap = {str(int(d)): round(_sf(v), 2) for d, v in day_totals.items() if not np.isnan(d)}
        return {"labels": months, "expenses": expenses, "income": income,
                "savings": savings, "cumulative": cumulative, "day_heatmap": day_heatmap}

    def _highlights(self) -> dict:
        e = _exp(self.df)
        largest = {}
        if not e.empty:
            idx = e["abs_amount"].idxmax(); row = e.loc[idx]
            largest = {"counterparty": str(row.get("counterparty", "")),
                       "amount": round(_sf(row["abs_amount"]), 2),
                       "date": str(row.get("booking_date", ""))[:10],
                       "category": str(row.get("category", ""))}
        months = sorted(e["month"].unique())
        spikes = []
        if len(months) >= 2:
            last = months[-1]
            for cat in e["category"].unique():
                cd = e[e["category"] == cat]
                hist = cd[cd["month"] != last].groupby("month")["abs_amount"].sum()
                if len(hist) < 1: continue
                havg = _sf(hist.mean()); lv = _sf(cd[cd["month"] == last]["abs_amount"].sum())
                if havg > 0 and lv > havg * 1.30:
                    spikes.append({"category": cat, "last": round(lv, 2), "avg": round(havg, 2),
                                   "pct_over": round((lv / havg - 1) * 100, 1)})
        spikes.sort(key=lambda x: x["pct_over"], reverse=True)
        uncat = e[e["category"] == "Uncategorized"]
        new_merchants = []
        if len(months) >= 2:
            last = months[-1]
            prev_m = set(e[e["month"] != last]["counterparty"].unique())
            this_m = set(e[e["month"] == last]["counterparty"].unique())
            new_merchants = sorted(list(this_m - prev_m))[:8]
        leakage_cats = {"Food & Dining", "Coffee", "Uncategorized"}
        leakage = _sf(e[e["category"].isin(leakage_cats)]["abs_amount"].sum())
        totE = _sf(e["abs_amount"].sum())
        return {
            "largest_tx": largest, "spikes": spikes[:4],
            "uncat_amount": round(_sf(uncat["abs_amount"].sum()), 2),
            "uncat_count": int(len(uncat)),
            "new_merchants": new_merchants,
            "leakage": round(leakage, 2),
            "leakage_pct": round(leakage / max(totE, 1) * 100, 1),
        }

    def _forecast(self) -> dict:
        e = _exp(self.df)
        months = sorted(e["month"].unique())
        results = []
        for cat in e["category"].unique():
            vals = [_sf(e[(e["month"] == m) & (e["category"] == cat)]["abs_amount"].sum()) for m in months]
            non_zero = [v for v in vals if v > 0]
            if not non_zero: continue
            if len(non_zero) < 2:
                pred, conf = round(float(np.mean(non_zero)), 2), "low"
            else:
                slope = float(np.polyfit(range(len(vals)), vals, 1)[0])
                pred  = max(0.0, round(float(vals[-1]) + slope, 2))
                cv    = float(np.std(non_zero)) / max(float(np.mean(non_zero)), 1)
                conf  = "high" if cv < 0.2 else ("med" if cv < 0.5 else "low")
            results.append({"category": cat, "predicted": pred,
                             "avg": round(float(np.mean(non_zero)), 2),
                             "confidence": conf, "fixed": cat in FIXED_CATS})
        results.sort(key=lambda x: x["predicted"], reverse=True)
        total_pred = round(sum(r["predicted"] for r in results), 2)
        try: next_m = str(pd.Period(months[-1], freq="M") + 1) if months else "Next"
        except: next_m = "Next"
        inc_vals = [_sf(_inc(self.df)[_inc(self.df)["month"] == m]["abs_amount"].sum()) for m in months]
        avg_inc = float(np.mean(inc_vals)) if inc_vals else 0
        return {"next_month": next_m, "total": total_pred, "avg_inc": round(avg_inc, 2),
                "proj_savings_rate": round((avg_inc - total_pred) / max(avg_inc, 1) * 100, 1),
                "categories": results}

    def _recurring(self) -> list[dict]:
        e = _exp(self.df).copy()
        e = e[e["abs_amount"] >= 5].sort_values("booking_date")
        e["_ab"] = (e["abs_amount"] / 0.5).round() * 0.5
        results = []
        for (merchant, amt), grp in e.groupby(["counterparty", "_ab"]):
            if len(grp) < 2: continue
            dates = pd.to_datetime(grp["booking_date"], errors="coerce").sort_values().dropna()
            if len(dates) < 2: continue
            gaps = dates.diff().dt.days.dropna().tolist()
            avg_gap = float(np.mean(gaps)); std_gap = float(np.std(gaps)) if len(gaps) > 1 else 0.0
            if avg_gap < 5: continue
            period = ("Monthly" if 25<=avg_gap<=35 else "Bi-weekly" if 12<=avg_gap<=16 else
                      "Weekly" if 5<=avg_gap<=9 else "Quarterly" if 85<=avg_gap<=95 else f"~{avg_gap:.0f}d")
            reg = max(0.0, 1.0 - std_gap / (avg_gap + 1e-6))
            results.append({"counterparty": str(merchant), "amount": float(amt), "period": period,
                             "regularity": round(reg, 2), "count": len(grp),
                             "category": str(grp["category"].mode().iloc[0]) if "category" in grp else ""})
        results.sort(key=lambda x: x["regularity"], reverse=True)
        return results[:12]

    def _transactions(self) -> list[dict]:
        cols = ["_id","booking_date","counterparty","title","amount","abs_amount","currency","category","direction","month"]
        present = [c for c in cols if c in self.df.columns]
        rows = []
        for _, r in self.df[present].sort_values("booking_date", ascending=False).iterrows():
            rows.append({"id": str(r.get("_id","")), "date": str(r.get("booking_date",""))[:10],
                         "counterparty": str(r.get("counterparty","")), "title": str(r.get("title",""))[:80],
                         "amount": round(_sf(r.get("amount",0)),2), "abs_amount": round(_sf(r.get("abs_amount",0)),2),
                         "category": str(r.get("category","")), "direction": str(r.get("direction","")),
                         "month": str(r.get("month",""))})
        return rows


# ── HTML Template ─────────────────────────────────────────────────────────

_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>__TITLE__</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#080a0e;--s1:#0d1018;--s2:#131720;--border:#1e2330;--border2:#252d3d;
  --text:#dde3f0;--muted:#4a5470;--dim:#1a2035;
  --green:#00e5a0;--red:#ff4d6a;--blue:#3d9eff;--amber:#ffb800;--purple:#a78bfa;
  --font-head:'Syne',sans-serif;--font-mono:'JetBrains Mono',monospace;--r:10px}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:14px;scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:var(--font-mono);min-height:100vh;padding:0 0 80px}
nav{position:sticky;top:0;z-index:100;background:rgba(8,10,14,.94);backdrop-filter:blur(14px);
  border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 28px;gap:0}
.nav-brand{font-family:var(--font-head);font-size:1.05rem;font-weight:800;color:var(--green);
  letter-spacing:-.02em;padding:14px 0;margin-right:28px;white-space:nowrap}
.nav-links{display:flex;gap:2px;flex:1;overflow-x:auto}
.nav-link{padding:14px 13px;font-size:.68rem;letter-spacing:.09em;text-transform:uppercase;
  color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;transition:.18s;white-space:nowrap}
.nav-link:hover,.nav-link.active{color:var(--text);border-bottom-color:var(--green)}
.nav-period{font-size:.68rem;color:var(--muted);margin-left:auto;padding:14px 0;white-space:nowrap}
.page{display:none;padding:28px 28px 0;animation:fadeIn .22s ease}
.page.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.section-title{font-family:var(--font-head);font-size:1.45rem;font-weight:700;
  letter-spacing:-.03em;margin-bottom:20px} .section-title span{color:var(--green)}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.g31{display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px}
@media(max-width:860px){.g2,.g31{grid-template-columns:1fr}}
.card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:20px;margin-bottom:0}
.card:hover{border-color:var(--border2)} .card canvas{max-height:240px}
.card-label{font-size:.62rem;text-transform:uppercase;letter-spacing:.11em;color:var(--muted);margin-bottom:12px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:11px;margin-bottom:16px}
.kpi{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:17px 15px;
  transition:.18s;position:relative;overflow:hidden}
.kpi:hover{border-color:var(--border2);transform:translateY(-1px)}
.kpi-label{font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:7px}
.kpi-value{font-family:var(--font-head);font-size:1.5rem;font-weight:700;line-height:1;letter-spacing:-.03em}
.kpi-sub{font-size:.65rem;color:var(--muted);margin-top:5px}
.kpi-bar{height:2px;background:var(--dim);border-radius:1px;margin-top:9px;overflow:hidden}
.kpi-bar-fill{height:100%;border-radius:1px;transition:width .9s ease}
.green{color:var(--green)}.red{color:var(--red)}.blue{color:var(--blue)}.amber{color:var(--amber)}.purple{color:var(--purple)}
.swing{background:var(--s2);border:1px solid var(--border2);border-radius:var(--r);
  padding:13px 18px;margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.swing-label{font-size:.62rem;text-transform:uppercase;letter-spacing:.09em;color:var(--muted)}
.swing-val{font-family:var(--font-head);font-size:1rem;font-weight:700}
.cat-list{display:flex;flex-direction:column;gap:5px;max-height:380px;overflow-y:auto}
.cat-item{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:6px;
  cursor:pointer;transition:.13s;border:1px solid transparent}
.cat-item:hover{background:var(--s2);border-color:var(--border)}
.cat-item.selected{background:var(--s2);border-color:var(--green)}
.cat-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.cat-name{flex:1;font-size:.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cat-share{font-size:.68rem;color:var(--muted);min-width:36px;text-align:right}
.cat-amount{font-size:.8rem;font-weight:500;min-width:90px;text-align:right}
.cat-mom{font-size:.68rem;min-width:70px;text-align:right}
.badge-fixed{font-size:.56rem;background:rgba(61,158,255,.1);color:var(--blue);
  border:1px solid rgba(61,158,255,.18);border-radius:20px;padding:1px 5px;margin-left:4px}
.hl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:11px;margin-bottom:16px}
.hl{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:15px 17px}
.hl-icon{font-size:1.4rem;margin-bottom:7px}
.hl-title{font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:5px}
.hl-main{font-family:var(--font-head);font-size:1.15rem;font-weight:700;letter-spacing:-.02em}
.hl-detail{font-size:.7rem;color:var(--muted);margin-top:3px}
.spike-list{display:flex;flex-direction:column;gap:7px}
.spike-item{display:flex;align-items:center;gap:10px;padding:7px 11px;
  background:rgba(255,77,106,.05);border:1px solid rgba(255,77,106,.13);border-radius:6px}
.spike-cat{flex:1;font-size:.78rem}
.spike-pct{font-size:.72rem;font-weight:500;color:var(--red)}
.spike-detail{font-size:.67rem;color:var(--muted)}
.rec-item{display:flex;align-items:center;gap:9px;padding:8px 11px;
  background:var(--s2);border:1px solid var(--border);border-radius:6px;margin-bottom:5px}
.rec-name{flex:1;font-size:.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rec-period{font-size:.66rem;color:var(--blue);min-width:68px}
.rec-amount{font-size:.82rem;font-weight:500;min-width:88px;text-align:right}
.rec-reg{font-size:.65rem;color:var(--muted);min-width:55px;text-align:right}
.merchant-item{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid var(--border)}
.merchant-item:last-child{border:none}
.merchant-rank{font-size:.62rem;color:var(--muted);min-width:17px}
.merchant-name{flex:1;font-size:.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.merchant-bar-wrap{width:70px;height:3px;background:var(--dim);border-radius:2px;overflow:hidden}
.merchant-bar{height:100%;background:var(--green);border-radius:2px}
.merchant-total{font-size:.8rem;font-weight:500;min-width:88px;text-align:right}
.merchant-count{font-size:.67rem;color:var(--muted);min-width:28px;text-align:right}
.forecast-total{display:flex;align-items:baseline;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.forecast-month{font-family:var(--font-head);font-size:.9rem;color:var(--muted)}
.forecast-amount{font-family:var(--font-head);font-size:2.2rem;font-weight:800;letter-spacing:-.04em}
.forecast-sr{font-size:.78rem;margin-top:3px}
.forecast-item{display:flex;align-items:center;gap:9px;padding:6px 0;border-bottom:1px solid var(--border)}
.forecast-item:last-child{border:none}
.forecast-cat{flex:1;font-size:.78rem}
.forecast-bar-wrap{width:80px;height:3px;background:var(--dim);border-radius:2px;overflow:hidden}
.forecast-bar{height:100%;background:var(--purple);border-radius:2px}
.forecast-pred{font-size:.8rem;font-weight:500;min-width:88px;text-align:right}
.forecast-avg{font-size:.67rem;color:var(--muted);min-width:78px;text-align:right}
.conf{font-size:.58rem;padding:1px 5px;border-radius:3px;margin-left:4px}
.conf-high{background:rgba(0,229,160,.1);color:var(--green)}
.conf-med{background:rgba(255,184,0,.1);color:var(--amber)}
.conf-low{background:rgba(74,84,112,.18);color:var(--muted)}
.day-heat{display:flex;flex-wrap:wrap;gap:3px;margin-top:8px}
.day-cell{width:24px;height:24px;border-radius:4px;display:flex;align-items:center;justify-content:center;
  font-size:.58rem;cursor:default;position:relative}
.day-cell:hover .day-tip{display:block}
.day-tip{display:none;position:absolute;bottom:28px;left:50%;transform:translateX(-50%);
  background:var(--s2);border:1px solid var(--border2);border-radius:4px;
  padding:3px 8px;font-size:.65rem;white-space:nowrap;z-index:10}
.tx-toolbar{display:flex;gap:7px;margin-bottom:13px;flex-wrap:wrap;align-items:center}
.tx-toolbar input,.tx-toolbar select{background:var(--s2);border:1px solid var(--border);border-radius:6px;
  color:var(--text);font-family:var(--font-mono);font-size:.74rem;padding:6px 9px;outline:none;transition:.18s}
.tx-toolbar input:focus,.tx-toolbar select:focus{border-color:var(--green)}
.tx-toolbar input{flex:1;min-width:150px}
.edit-count{font-size:.68rem;color:var(--amber)}
.tx-wrap{overflow-x:auto;max-height:440px;overflow-y:auto;border-radius:7px;border:1px solid var(--border)}
table{width:100%;border-collapse:collapse;font-size:.75rem}
thead th{position:sticky;top:0;background:var(--s2);color:var(--muted);text-transform:uppercase;
  letter-spacing:.07em;font-size:.6rem;padding:9px 10px;text-align:left;
  border-bottom:1px solid var(--border);cursor:pointer;user-select:none;white-space:nowrap}
thead th:hover{color:var(--text)}
thead th.sort-asc::after{content:' ↑'}thead th.sort-desc::after{content:' ↓'}
tbody tr{border-bottom:1px solid rgba(30,35,48,.7);transition:background .1s}
tbody tr:hover{background:rgba(255,255,255,.022)}
tbody tr.edited{background:rgba(255,184,0,.035)}
tbody td{padding:7px 10px;vertical-align:middle}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:.63rem;
  background:rgba(0,229,160,.09);color:var(--green);white-space:nowrap;cursor:pointer;
  border:1px solid rgba(0,229,160,.18);transition:.13s}
.badge:hover{background:rgba(0,229,160,.18)}
.badge.expense{background:rgba(255,77,106,.09);color:var(--red);border-color:rgba(255,77,106,.18)}
.badge.income{background:rgba(61,158,255,.09);color:var(--blue);border-color:rgba(61,158,255,.18)}
.amt-neg{color:var(--red)}.amt-pos{color:var(--green)}
.edited-dot{width:5px;height:5px;border-radius:50%;background:var(--amber);
  display:inline-block;margin-right:5px;vertical-align:middle}
.edit-row{background:var(--s2) !important}
.edit-row td{padding:10px !important}
.edit-form{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
.edit-form input,.edit-form select{background:var(--bg);border:1px solid var(--border2);border-radius:5px;
  color:var(--text);font-family:var(--font-mono);font-size:.73rem;padding:5px 8px;outline:none;transition:.13s}
.edit-form input:focus,.edit-form select:focus{border-color:var(--green)}
.edit-form input[type=date]{color-scheme:dark}
.btn{padding:5px 12px;border-radius:5px;font-family:var(--font-mono);font-size:.7rem;
  cursor:pointer;border:1px solid;transition:.13s;font-weight:500}
.btn-save{background:rgba(0,229,160,.13);border-color:var(--green);color:var(--green)}
.btn-save:hover{background:rgba(0,229,160,.22)}
.btn-cancel{background:rgba(74,84,112,.13);border-color:var(--dim);color:var(--muted)}
.btn-cancel:hover{color:var(--text)}
.btn-revert{background:rgba(255,77,106,.1);border-color:rgba(255,77,106,.25);color:var(--red);font-size:.63rem}
.btn-dl{background:rgba(61,158,255,.1);border-color:rgba(61,158,255,.25);color:var(--blue)}
.btn-dl:hover{background:rgba(61,158,255,.2)}
.btn-danger{background:rgba(255,77,106,.08);border-color:rgba(255,77,106,.2);color:var(--red);font-size:.63rem}
.tx-footer{display:flex;align-items:center;gap:12px;margin-top:9px;flex-wrap:wrap}
.tx-count{font-size:.68rem;color:var(--muted)}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--dim);border-radius:3px}
</style>
</head>
<body>

<nav>
  <div class="nav-brand" id="navBrand">Finance</div>
  <div class="nav-links">
    <div class="nav-link active" data-page="overview">Overview</div>
    <div class="nav-link" data-page="cashflow">Cash Flow</div>
    <div class="nav-link" data-page="categories">Categories</div>
    <div class="nav-link" data-page="highlights">Highlights</div>
    <div class="nav-link" data-page="merchants">Merchants</div>
    <div class="nav-link" data-page="forecast">Forecast</div>
    <div class="nav-link" data-page="transactions">Transactions</div>
  </div>
  <div class="nav-period" id="navPeriod"></div>
</nav>

<!-- ① OVERVIEW -->
<div class="page active" id="page-overview">
  <div class="section-title">Command <span>Center</span></div>
  <div class="kpis" id="kpis"></div>
  <div id="swingBanner"></div>
  <div class="g2">
    <div class="card"><div class="card-label">Monthly Income vs Expenses</div><canvas id="cMonthly"></canvas></div>
    <div class="card"><div class="card-label">Spending by Category</div><canvas id="cDonut"></canvas></div>
  </div>
  <div class="g2">
    <div class="card"><div class="card-label">Fixed vs Variable</div><canvas id="cFixed"></canvas></div>
    <div class="card"><div class="card-label">Savings Rate by Month</div><canvas id="cSavingsRate"></canvas></div>
  </div>
</div>

<!-- ② CASH FLOW -->
<div class="page" id="page-cashflow">
  <div class="section-title">Cash <span>Flow</span></div>
  <div class="g2">
    <div class="card"><div class="card-label">Cumulative Balance</div><canvas id="cCumulative"></canvas></div>
    <div class="card"><div class="card-label">Monthly Net Savings</div><canvas id="cSavings"></canvas></div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-label">Day-of-Month Spending Pattern — which days do you spend most?</div>
    <div class="day-heat" id="dayHeat"></div>
  </div>
</div>

<!-- ③ CATEGORIES -->
<div class="page" id="page-categories">
  <div class="section-title">Category <span>Breakdown</span></div>
  <div class="g31">
    <div class="card">
      <div class="card-label">All categories — click to drill down</div>
      <div style="display:flex;gap:8px;font-size:.6rem;color:var(--muted);margin-bottom:8px;padding:0 9px">
        <span style="flex:1">Category</span><span style="min-width:36px;text-align:right">Share</span>
        <span style="min-width:90px;text-align:right">Total</span>
        <span style="min-width:70px;text-align:right">MoM Δ</span>
      </div>
      <div class="cat-list" id="catList"></div>
    </div>
    <div class="card" id="catDetail">
      <div class="card-label" id="catDetailLabel">Select a category</div>
      <div id="catDetailBody" style="color:var(--muted);font-size:.78rem">Click any row to see transactions.</div>
    </div>
  </div>
</div>

<!-- ④ HIGHLIGHTS -->
<div class="page" id="page-highlights">
  <div class="section-title"><span>Highlights</span> &amp; Anomalies</div>
  <div class="hl-grid" id="hlGrid"></div>
  <div class="g2">
    <div class="card"><div class="card-label">Spending Spikes vs 3-Month Average</div><div class="spike-list" id="spikeList"></div></div>
    <div class="card"><div class="card-label">Detected Recurring Charges</div><div id="recList"></div></div>
  </div>
</div>

<!-- ⑤ MERCHANTS -->
<div class="page" id="page-merchants">
  <div class="section-title">Merchant <span>Intelligence</span></div>
  <div class="g2">
    <div class="card"><div class="card-label">Top Merchants by Total Spend</div><div id="merchantList"></div></div>
    <div class="card"><div class="card-label">Frequency vs Avg Transaction Size</div><canvas id="cScatter" style="max-height:260px"></canvas></div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-label">New Merchants This Month</div>
    <div id="newMerchants" style="margin-top:6px"></div>
  </div>
</div>

<!-- ⑥ FORECAST -->
<div class="page" id="page-forecast">
  <div class="section-title">Next Month <span>Forecast</span></div>
  <div class="g2">
    <div class="card"><div class="forecast-total" id="forecastTotal"></div><div id="forecastList"></div></div>
    <div class="card"><div class="card-label">Predicted vs Historical Average</div><canvas id="cForecast"></canvas></div>
  </div>
</div>

<!-- ⑦ TRANSACTIONS -->
<div class="page" id="page-transactions">
  <div class="section-title">Transaction <span>Log</span></div>
  <div class="tx-toolbar">
    <input type="text" id="txSearch" placeholder="Search counterparty / title / category…">
    <select id="txCatFilter"><option value="">All categories</option></select>
    <select id="txDirFilter"><option value="">All</option><option value="expense">Expenses</option><option value="income">Income</option></select>
    <select id="txMonthFilter"><option value="">All months</option></select>
    <span class="edit-count" id="editCount" style="display:none"></span>
    <button class="btn btn-dl" id="btnDownload">↓ Download CSV</button>
    <button class="btn btn-danger" id="btnResetEdits" style="display:none">Reset Edits</button>
  </div>
  <div class="tx-wrap">
    <table><thead><tr>
      <th data-col="date">Date</th>
      <th data-col="counterparty">Counterparty</th>
      <th data-col="category">Category</th>
      <th data-col="amount">Amount</th>
      <th data-col="direction">Dir</th>
      <th style="width:34px"></th>
    </tr></thead><tbody id="txBody"></tbody></table>
  </div>
  <div class="tx-footer"><span class="tx-count" id="txCount"></span></div>
</div>

<script>
const RAW = __DATA__;

// ── Edit store (localStorage) ─────────────────────────────────────
const STORE_KEY = 'bank_edits_v1';
let edits = {};
try { edits = JSON.parse(localStorage.getItem(STORE_KEY)||'{}'); } catch(e){}
function saveEdits(){ localStorage.setItem(STORE_KEY, JSON.stringify(edits)); }
function getEff(tx){ return {...tx, ...(edits[tx.id]||{})}; }

// ── Rebuild live data from edits ──────────────────────────────────
function buildLive(){
  const txs = RAW.transactions.map(t => {
    const e = getEff(t);
    e.amount     = parseFloat(e.amount)||0;
    e.abs_amount = Math.abs(e.amount);
    e.direction  = e.amount < 0 ? 'expense' : 'income';
    // Recompute month from date if date was edited
    if(edits[t.id]?.date && edits[t.id].date !== t.date){
      try{ e.month = edits[t.id].date.slice(0,7); } catch(_){}
    }
    return e;
  });

  const exp = txs.filter(t=>t.direction==='expense');
  const inc = txs.filter(t=>t.direction==='income');
  const months = [...new Set(txs.map(t=>t.month))].sort();
  const totE = exp.reduce((s,t)=>s+t.abs_amount,0);
  const totI = inc.reduce((s,t)=>s+t.abs_amount,0);
  const n = Math.max(months.length,1);
  const FIXED = new Set(['Rent & Housing','Subscriptions','Accounting','Intermediary']);
  const fixedE = exp.filter(t=>FIXED.has(t.category)).reduce((s,t)=>s+t.abs_amount,0);

  const monthlyExp={}, monthlyInc={};
  months.forEach(m=>{monthlyExp[m]=0; monthlyInc[m]=0;});
  exp.forEach(t=>{ if(monthlyExp[t.month]!==undefined) monthlyExp[t.month]+=t.abs_amount; });
  inc.forEach(t=>{ if(monthlyInc[t.month]!==undefined) monthlyInc[t.month]+=t.abs_amount; });

  const catTotals={};
  exp.forEach(t=>{ catTotals[t.category]=(catTotals[t.category]||0)+t.abs_amount; });

  return {txs,exp,inc,months,totE,totI,n,fixedE,monthlyExp,monthlyInc,catTotals};
}

// ── Chart registry ────────────────────────────────────────────────
Chart.defaults.color='#4a5470'; Chart.defaults.font.family="'JetBrains Mono',monospace"; Chart.defaults.font.size=11;
const gc='rgba(255,255,255,0.04)';
const charts={};
function mkChart(id,cfg){
  if(charts[id]){charts[id].destroy();}
  const el=document.getElementById(id); if(!el) return;
  charts[id]=new Chart(el,cfg);
}

const PAL=['#00e5a0','#3d9eff','#ff4d6a','#ffb800','#a78bfa','#69f0ae','#ff8a65','#4dd0e1','#ce93d8','#e6ee9c','#80cbc4','#ffcc80'];
let _pi=0; const _cc={};
function cc(c){ if(!_cc[c]){_cc[c]=PAL[_pi++%PAL.length];} return _cc[c]; }
const fmt=(v)=>Math.abs(v).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+RAW.meta.currency;

// ── Nav ───────────────────────────────────────────────────────────
document.querySelectorAll('.nav-link').forEach(el=>{
  el.addEventListener('click',()=>{
    document.querySelectorAll('.nav-link').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('page-'+el.dataset.page).classList.add('active');
  });
});

// ── Main render ───────────────────────────────────────────────────
function renderAll(){
  const L = buildLive();
  document.getElementById('navBrand').textContent  = RAW.meta.title||'Finance';
  document.getElementById('navPeriod').textContent = RAW.meta.period;
  renderKPIs(L); renderSwing(L); renderOverview(L);
  renderCashFlow(L); renderCategories(L); renderHighlights(L);
  renderMerchants(L); renderForecast(L); renderTx(L);
}

// ── KPIs ──────────────────────────────────────────────────────────
function renderKPIs(L){
  const {totE,totI,n,fixedE} = L;
  const net=totI-totE, sr=totI>0?(totI-totE)/totI*100:0;
  const fixPct=totE>0?fixedE/totE*100:0, varE=totE-fixedE;
  const defs=[
    {l:'Total Income',   v:fmt(totI),          s:`avg ${fmt(totI/n)}/mo`,          cls:'green', bar:null},
    {l:'Total Expenses', v:fmt(totE),           s:`avg ${fmt(totE/n)}/mo`,          cls:'red',   bar:null},
    {l:'Net Balance',    v:fmt(net),            s:net>=0?'Positive ✓':'Deficit ⚠',  cls:net>=0?'green':'red', bar:null},
    {l:'Savings Rate',   v:sr.toFixed(1)+'%',  s:'of income saved',                cls:sr>=20?'green':sr>=10?'amber':'red',
      bar:{v:Math.max(0,Math.min(sr,100)),c:sr>=20?'var(--green)':sr>=10?'var(--amber)':'var(--red)'}},
    {l:'Fixed Costs',    v:fmt(fixedE),         s:fixPct.toFixed(0)+'% of expenses',cls:'blue',
      bar:{v:fixPct,c:'var(--blue)'}},
    {l:'Discretionary',  v:fmt(varE),           s:(100-fixPct).toFixed(0)+'% of expenses',cls:'purple',
      bar:{v:100-fixPct,c:'var(--purple)'}},
  ];
  document.getElementById('kpis').innerHTML=defs.map(d=>`
    <div class="kpi">
      <div class="kpi-label">${d.l}</div>
      <div class="kpi-value ${d.cls}">${d.v}</div>
      <div class="kpi-sub">${d.s}</div>
      ${d.bar?`<div class="kpi-bar"><div class="kpi-bar-fill" style="width:${d.bar.v}%;background:${d.bar.c}"></div></div>`:''}
    </div>`).join('');
}

function renderSwing(L){
  const sw=RAW.summary.swing; if(!sw?.category) return;
  const up=sw.delta>0;
  document.getElementById('swingBanner').innerHTML=`
    <div class="swing">
      <div style="font-size:1.3rem">${up?'📈':'📉'}</div>
      <div>
        <div class="swing-label">Biggest Month-over-Month Swing</div>
        <div class="swing-val" style="color:${up?'var(--red)':'var(--green)'}">${sw.category}
          <span style="color:var(--muted);font-size:.82rem;font-weight:400">${up?'+':''}${fmt(sw.delta)} vs prior month</span>
        </div>
      </div>
      <div style="margin-left:auto;text-align:right"><div class="swing-label">Last</div><div style="font-size:.88rem">${fmt(sw.last)}</div></div>
      <div style="text-align:right"><div class="swing-label">Prior</div><div style="font-size:.88rem">${fmt(sw.prev)}</div></div>
    </div>`;
}

function renderOverview(L){
  const {months,monthlyExp,monthlyInc,catTotals,fixedE,totE}=L;
  const ea=months.map(m=>+(monthlyExp[m]||0).toFixed(2));
  const ia=months.map(m=>+(monthlyInc[m]||0).toFixed(2));

  mkChart('cMonthly',{type:'bar',data:{labels:months,datasets:[
    {label:'Income',  data:ia,backgroundColor:'rgba(61,158,255,.38)',borderColor:'#3d9eff',borderWidth:1.5,borderRadius:4},
    {label:'Expenses',data:ea,backgroundColor:'rgba(255,77,106,.38)',borderColor:'#ff4d6a',borderWidth:1.5,borderRadius:4},
  ]},options:{responsive:true,maintainAspectRatio:true,
    plugins:{legend:{labels:{boxWidth:8,padding:14}}},
    scales:{x:{grid:{color:gc}},y:{grid:{color:gc},ticks:{callback:v=>v.toLocaleString('pl-PL')}}}}});

  const cats=Object.keys(catTotals);
  mkChart('cDonut',{type:'doughnut',data:{labels:cats,datasets:[{
    data:cats.map(c=>catTotals[c]),backgroundColor:cats.map(cc),borderColor:'#0d1018',borderWidth:2,hoverOffset:5
  }]},options:{responsive:true,maintainAspectRatio:true,cutout:'60%',
    plugins:{legend:{position:'right',labels:{boxWidth:8,padding:8,font:{size:10}}},
    tooltip:{callbacks:{label:ctx=>' '+fmt(ctx.raw)}}}}});

  mkChart('cFixed',{type:'doughnut',data:{labels:['Fixed','Variable'],datasets:[{
    data:[fixedE,totE-fixedE],backgroundColor:['rgba(61,158,255,.65)','rgba(167,139,250,.65)'],
    borderColor:'#0d1018',borderWidth:2
  }]},options:{responsive:true,maintainAspectRatio:true,cutout:'64%',
    plugins:{legend:{position:'right',labels:{boxWidth:8}},
    tooltip:{callbacks:{label:ctx=>' '+fmt(ctx.raw)+' ('+(ctx.raw/totE*100).toFixed(1)+'%)'}}}}});

  const srA=months.map(m=>{
    const i=monthlyInc[m]||0,e=monthlyExp[m]||0;
    return i>0?((i-e)/i*100):0;
  });
  mkChart('cSavingsRate',{type:'line',data:{labels:months,datasets:[{
    label:'Savings %',data:srA,borderColor:'#00e5a0',backgroundColor:'rgba(0,229,160,.07)',
    tension:.35,fill:true,pointBackgroundColor:'#00e5a0',pointRadius:4,borderWidth:2
  }]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},
    scales:{x:{grid:{color:gc}},y:{grid:{color:gc},ticks:{callback:v=>v.toFixed(0)+'%'}}}}});
}

function renderCashFlow(L){
  const {months,monthlyExp,monthlyInc}=L;
  const sav=months.map(m=>(monthlyInc[m]||0)-(monthlyExp[m]||0));
  let run=0; const cum=sav.map(s=>{run+=s; return +run.toFixed(2);});

  mkChart('cCumulative',{type:'line',data:{labels:months,datasets:[{
    label:'Cumulative',data:cum,borderColor:'#3d9eff',backgroundColor:'rgba(61,158,255,.07)',
    fill:true,tension:.4,pointBackgroundColor:'#3d9eff',pointRadius:4,borderWidth:2
  }]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},
    scales:{x:{grid:{color:gc}},y:{grid:{color:gc},ticks:{callback:v=>v.toLocaleString('pl-PL')}}}}});

  const sc=sav.map(s=>s>=0?'rgba(0,229,160,.55)':'rgba(255,77,106,.55)');
  mkChart('cSavings',{type:'bar',data:{labels:months,datasets:[{
    label:'Net Savings',data:sav,backgroundColor:sc,borderRadius:4
  }]},options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},
    scales:{x:{grid:{color:gc}},y:{grid:{color:gc},ticks:{callback:v=>v.toLocaleString('pl-PL')}}}}});

  const dh=RAW.monthly.day_heatmap;
  const maxD=Math.max(...Object.values(dh),1);
  const heat=document.getElementById('dayHeat'); heat.innerHTML='';
  for(let d=1;d<=31;d++){
    const v=dh[String(d)]||0, i=v/maxD;
    const bg=v>0?`rgba(${Math.round(255*i)},${Math.round(77*i)},${Math.round(106*i)},${(0.12+i*0.68).toFixed(2)})`:'var(--dim)';
    const tc=i>0.5?'#fff':'var(--muted)';
    heat.innerHTML+=`<div class="day-cell" style="background:${bg};color:${tc}">${d}<div class="day-tip">Day ${d}: ${v>0?fmt(v):'—'}</div></div>`;
  }
}

function renderCategories(L){
  const {exp,catTotals,totE,months}=L;
  const FIXED=new Set(['Rent & Housing','Subscriptions','Accounting','Intermediary']);
  const items=Object.entries(catTotals).map(([cat,total])=>{
    const txs=exp.filter(t=>t.category===cat);
    const mom=(()=>{
      if(months.length<2) return 0;
      const last=months[months.length-1],prev=months[months.length-2];
      return txs.filter(t=>t.month===last).reduce((s,t)=>s+t.abs_amount,0)
            -txs.filter(t=>t.month===prev).reduce((s,t)=>s+t.abs_amount,0);
    })();
    return {cat,total,count:txs.length,share:total/totE*100,fixed:FIXED.has(cat),mom,txs};
  }).sort((a,b)=>b.total-a.total);

  document.getElementById('catList').innerHTML=items.map(it=>`
    <div class="cat-item" data-cat="${it.cat}">
      <div class="cat-dot" style="background:${cc(it.cat)}"></div>
      <div class="cat-name">${it.cat}${it.fixed?'<span class="badge-fixed">fixed</span>':''}</div>
      <div class="cat-share">${it.share.toFixed(1)}%</div>
      <div class="cat-amount">${fmt(it.total)}</div>
      <div class="cat-mom" style="color:${it.mom>0?'var(--red)':it.mom<0?'var(--green)':'var(--muted)'}">
        ${it.mom!==0?(it.mom>0?'+':'')+fmt(it.mom):'—'}
      </div>
    </div>`).join('');

  document.querySelectorAll('.cat-item').forEach(el=>{
    el.addEventListener('click',()=>{
      document.querySelectorAll('.cat-item').forEach(x=>x.classList.remove('selected'));
      el.classList.add('selected');
      const it=items.find(x=>x.cat===el.dataset.cat);
      if(!it) return;
      document.getElementById('catDetailLabel').textContent=it.cat+' — '+it.count+' transactions';
      const sorted=[...it.txs].sort((a,b)=>new Date(b.date)-new Date(a.date));
      document.getElementById('catDetailBody').innerHTML=sorted.length?`
        <div style="max-height:300px;overflow-y:auto">
        ${sorted.map(t=>`
          <div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:.73rem">
            <span style="color:var(--muted);min-width:78px">${t.date}</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.counterparty}">${t.counterparty}</span>
            <span style="color:var(--red);min-width:88px;text-align:right">${fmt(t.abs_amount)}</span>
          </div>`).join('')}
        </div>
        <div style="margin-top:8px;font-size:.68rem;color:var(--muted)">
          Total: <span style="color:var(--text)">${fmt(sorted.reduce((s,t)=>s+t.abs_amount,0))}</span>
        </div>`:
        '<div style="color:var(--muted);font-size:.75rem">No transactions.</div>';
    });
  });
}

function renderHighlights(L){
  const {exp,totE}=L;
  const hl=RAW.highlights;
  const leakage=exp.filter(t=>['Food & Dining','Coffee','Uncategorized'].includes(t.category)).reduce((s,t)=>s+t.abs_amount,0);
  const uncatAmt=exp.filter(t=>t.category==='Uncategorized').reduce((s,t)=>s+t.abs_amount,0);
  const uncatN=exp.filter(t=>t.category==='Uncategorized').length;

  document.getElementById('hlGrid').innerHTML=[
    {icon:'💸',t:'Largest Expense',m:hl.largest_tx?.amount?fmt(hl.largest_tx.amount):'—',d:hl.largest_tx?.counterparty?`${hl.largest_tx.counterparty} · ${hl.largest_tx.date}`:''},
    {icon:'🔍',t:'Uncategorized Spend',m:fmt(uncatAmt),d:`${uncatN} transactions need review`},
    {icon:'🧩',t:'Discretionary Leakage',m:fmt(leakage),d:`${totE>0?(leakage/totE*100).toFixed(1):0}% of total (food, coffee, misc)`},
    {icon:'🆕',t:'New Merchants This Month',m:String(hl.new_merchants?.length||0),d:(hl.new_merchants||[]).slice(0,3).join(', ')},
  ].map(h=>`<div class="hl"><div class="hl-icon">${h.icon}</div><div class="hl-title">${h.t}</div>
    <div class="hl-main">${h.m}</div><div class="hl-detail">${h.d}</div></div>`).join('');

  const spikes=RAW.highlights.spikes||[];
  document.getElementById('spikeList').innerHTML=spikes.length?spikes.map(s=>`
    <div class="spike-item"><div class="spike-cat">${s.category}</div>
    <div><div class="spike-pct">+${s.pct_over}% over avg</div>
    <div class="spike-detail">${fmt(s.last)} vs avg ${fmt(s.avg)}</div></div></div>`).join('')
    :'<div style="color:var(--muted);font-size:.75rem;padding:8px 0">No significant spikes detected.</div>';

  const recs=RAW.recurring||[];
  document.getElementById('recList').innerHTML=recs.length?recs.map(r=>`
    <div class="rec-item">
      <div style="width:6px;height:6px;border-radius:50%;background:var(--green);flex-shrink:0;opacity:${r.regularity}"></div>
      <div class="rec-name" title="${r.counterparty}">${r.counterparty}</div>
      <div class="rec-period">${r.period}</div>
      <div class="rec-amount">${fmt(r.amount)}</div>
      <div class="rec-reg">${(r.regularity*100).toFixed(0)}% reg.</div>
    </div>`).join('')
    :'<div style="color:var(--muted);font-size:.75rem;padding:8px 0">Not enough data to detect recurring charges.</div>';
}

function renderMerchants(L){
  const top=Object.values(L.exp.reduce((acc,t)=>{
    const k=t.counterparty;
    if(!acc[k]) acc[k]={name:k,total:0,count:0};
    acc[k].total+=t.abs_amount; acc[k].count++; return acc;
  },{})).sort((a,b)=>b.total-a.total).slice(0,12);

  const maxT=top[0]?.total||1;
  document.getElementById('merchantList').innerHTML=top.map((m,i)=>`
    <div class="merchant-item">
      <span class="merchant-rank">${i+1}</span>
      <span class="merchant-name" title="${m.name}">${m.name}</span>
      <div class="merchant-bar-wrap"><div class="merchant-bar" style="width:${m.total/maxT*100}%"></div></div>
      <span class="merchant-total">${fmt(m.total)}</span>
      <span class="merchant-count">${m.count}×</span>
    </div>`).join('');

  mkChart('cScatter',{type:'scatter',data:{datasets:[{
    data:top.map(m=>({x:m.count,y:m.total/m.count,label:m.name})),
    backgroundColor:top.map((_,i)=>PAL[i%PAL.length]+'bb'),
    pointRadius:top.map(m=>Math.max(6,Math.min(18,m.total/maxT*16))),
    pointHoverRadius:10,
  }]},options:{responsive:true,maintainAspectRatio:true,
    plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.raw.label}: ${ctx.raw.x}× · avg ${fmt(ctx.raw.y)}`}}},
    scales:{x:{title:{display:true,text:'# Transactions',color:'#4a5470'},grid:{color:gc}},
            y:{title:{display:true,text:'Avg size',color:'#4a5470'},grid:{color:gc},ticks:{callback:v=>v.toLocaleString('pl-PL')}}}}});

  const nm=RAW.highlights.new_merchants||[];
  document.getElementById('newMerchants').innerHTML=nm.length
    ?nm.map(n=>`<span style="display:inline-block;margin:3px 4px 3px 0;padding:3px 9px;background:var(--s2);border:1px solid var(--border2);border-radius:4px;font-size:.75rem">${n}</span>`).join('')
    :'<span style="color:var(--muted);font-size:.75rem">No new merchants this month.</span>';
}

function renderForecast(L){
  const fc=RAW.forecast;
  const sr=fc.proj_savings_rate;
  document.getElementById('forecastTotal').innerHTML=`
    <div>
      <div class="forecast-month">${fc.next_month} projected</div>
      <div class="forecast-amount" style="color:${sr>=20?'var(--green)':sr>=0?'var(--amber)':'var(--red)'}">${fmt(fc.total)}</div>
      <div class="forecast-sr" style="color:${sr>=20?'var(--green)':sr>=10?'var(--amber)':'var(--red)'}">
        Projected savings rate: ${sr.toFixed(1)}%
      </div>
    </div>`;
  const maxP=fc.categories[0]?.predicted||1;
  document.getElementById('forecastList').innerHTML=fc.categories.map(c=>`
    <div class="forecast-item">
      <div class="forecast-cat">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${cc(c.category)};margin-right:5px;vertical-align:middle"></span>
        ${c.category}${c.fixed?'<span class="badge-fixed">fixed</span>':''}
        <span class="conf conf-${c.confidence}">${c.confidence}</span>
      </div>
      <div class="forecast-bar-wrap"><div class="forecast-bar" style="width:${c.predicted/maxP*100}%"></div></div>
      <div class="forecast-pred">${fmt(c.predicted)}</div>
      <div class="forecast-avg">avg ${fmt(c.avg)}</div>
    </div>`).join('');

  const cats=fc.categories.slice(0,8);
  mkChart('cForecast',{type:'bar',data:{labels:cats.map(c=>c.category),datasets:[
    {label:'Predicted',data:cats.map(c=>c.predicted),backgroundColor:'rgba(167,139,250,.55)',borderColor:'#a78bfa',borderWidth:1.5,borderRadius:4},
    {label:'Historical avg',data:cats.map(c=>c.avg),backgroundColor:'rgba(74,84,112,.35)',borderColor:'#4a5470',borderWidth:1.5,borderRadius:4},
  ]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:true,
    plugins:{legend:{labels:{boxWidth:8,padding:12}}},
    scales:{x:{grid:{color:gc},ticks:{callback:v=>v.toLocaleString('pl-PL')}},y:{grid:{color:gc},ticks:{font:{size:10}}}}}});
}

// ── Transactions ──────────────────────────────────────────────────
let sortCol='date', sortDir=-1, txOpen=null;

function populateTxFilters(){
  const cats=[...new Set(RAW.transactions.map(t=>t.category))].sort();
  document.getElementById('txCatFilter').innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option>${c}</option>`).join('');
  const months=[...new Set(RAW.transactions.map(t=>t.month))].sort();
  document.getElementById('txMonthFilter').innerHTML='<option value="">All months</option>'+months.map(m=>`<option>${m}</option>`).join('');
}

function renderTx(L){
  const q=document.getElementById('txSearch').value.toLowerCase();
  const cat=document.getElementById('txCatFilter').value;
  const dir=document.getElementById('txDirFilter').value;
  const mon=document.getElementById('txMonthFilter').value;

  let rows=L.txs.filter(t=>
    (!q||t.counterparty.toLowerCase().includes(q)||t.title.toLowerCase().includes(q)||t.category.toLowerCase().includes(q))&&
    (!cat||t.category===cat)&&(!dir||t.direction===dir)&&(!mon||t.month===mon));

  rows.sort((a,b)=>{
    let av=a[sortCol],bv=b[sortCol];
    if(['amount','abs_amount'].includes(sortCol)){av=+av;bv=+bv;}
    return av<bv?-sortDir:av>bv?sortDir:0;
  });

  const editIds=Object.keys(edits);
  document.getElementById('editCount').style.display=editIds.length?'':'none';
  document.getElementById('editCount').textContent=`${editIds.length} edited`;
  document.getElementById('btnResetEdits').style.display=editIds.length?'':'none';

  document.getElementById('txBody').innerHTML=rows.slice(0,500).map(t=>`
    <tr data-id="${t.id}" class="${edits[t.id]?'edited':''}">
      <td>${edits[t.id]?'<span class="edited-dot"></span>':''}${t.date}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.counterparty}">${t.counterparty}</td>
      <td><span class="badge">${t.category}</span></td>
      <td class="${t.direction==='expense'?'amt-neg':'amt-pos'}">${t.direction==='expense'?'−':'+'}${Math.abs(t.amount).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td><span class="badge ${t.direction}">${t.direction}</span></td>
      <td><span style="cursor:pointer;color:var(--muted);padding:2px 4px;border-radius:3px;transition:.1s" data-edit="${t.id}"
          onmouseenter="this.style.color='var(--text)'" onmouseleave="this.style.color='var(--muted)'">✏</span></td>
    </tr>`).join('');

  document.getElementById('txCount').textContent=`Showing ${Math.min(rows.length,500)} of ${rows.length} transactions`;
  document.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click',e=>{e.stopPropagation();openEdit(btn.dataset.edit,L);});
  });
}

function openEdit(id,L){
  if(txOpen===id){closeEdit();return;}
  closeEdit(); txOpen=id;
  const tx=L.txs.find(t=>t.id===id); if(!tx) return;
  const row=document.querySelector(`tr[data-id="${id}"]`); if(!row) return;
  const allCats=RAW.allCategories;
  const editRow=document.createElement('tr');
  editRow.className='edit-row'; editRow.id='er-'+id;
  editRow.innerHTML=`<td colspan="6"><div class="edit-form">
    <input type="date" id="ef-date" value="${tx.date}" title="Date">
    <input type="text" id="ef-cp" value="${tx.counterparty}" placeholder="Counterparty" style="min-width:150px">
    <select id="ef-cat">${allCats.map(c=>`<option${c===tx.category?' selected':''}>${c}</option>`).join('')}<option value="__new__">+ New…</option></select>
    <input type="number" id="ef-amt" value="${tx.amount}" step="0.01" style="width:95px" title="Amount (negative = expense)">
    <button class="btn btn-save" id="ef-save">Save</button>
    <button class="btn btn-cancel" id="ef-cancel">Cancel</button>
    ${edits[id]?'<button class="btn btn-revert" id="ef-revert">Revert</button>':''}
  </div></td>`;
  row.after(editRow);
  document.getElementById('ef-cancel').onclick=closeEdit;
  document.getElementById('ef-save').onclick=()=>{
    let cat=document.getElementById('ef-cat').value;
    if(cat==='__new__'){
      const nc=prompt('New category name:'); if(!nc) return;
      cat=nc.trim(); if(!RAW.allCategories.includes(cat)) RAW.allCategories.push(cat);
    }
    edits[id]={
      date:  document.getElementById('ef-date').value,
      counterparty: document.getElementById('ef-cp').value,
      category: cat,
      amount: parseFloat(document.getElementById('ef-amt').value)||tx.amount,
    };
    saveEdits(); closeEdit(); renderAll();
  };
  if(edits[id]) document.getElementById('ef-revert').onclick=()=>{delete edits[id];saveEdits();closeEdit();renderAll();};
}
function closeEdit(){const r=document.getElementById('er-'+txOpen);if(r)r.remove();txOpen=null;}

document.querySelectorAll('thead th[data-col]').forEach(th=>{
  th.addEventListener('click',()=>{
    const col=th.dataset.col;
    document.querySelectorAll('thead th').forEach(x=>x.classList.remove('sort-asc','sort-desc'));
    sortDir=sortCol===col?-sortDir:-1; sortCol=col;
    th.classList.add(sortDir===-1?'sort-desc':'sort-asc');
    renderAll();
  });
});

['txSearch','txCatFilter','txDirFilter','txMonthFilter'].forEach(id=>{
  document.getElementById(id).addEventListener('input',()=>{const L=buildLive();renderTx(L);});
});

document.getElementById('btnDownload').addEventListener('click',()=>{
  const L=buildLive();
  const H=['id','date','counterparty','title','amount','abs_amount','category','direction','month'];
  const rows=L.txs.map(t=>H.map(k=>{const v=String(t[k]??'');return v.includes(',')?`"${v}"`:v;}).join(','));
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent([H.join(','),...rows].join('\n'));
  a.download='enriched_edited.csv'; a.click();
});

document.getElementById('btnResetEdits').addEventListener('click',()=>{
  if(!confirm('Reset ALL manual edits?')) return;
  edits={}; saveEdits(); renderAll();
});

// ── Boot ──────────────────────────────────────────────────────────
populateTxFilters();
renderAll();
</script>
</body>
</html>"""


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import argparse, logging
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("input", help="enriched.parquet or enriched.csv")
    ap.add_argument("-o","--output", default="output/dashboard.html")
    ap.add_argument("--title", default="Finance")
    ap.add_argument("--no-open", action="store_true")
    args = ap.parse_args()
    p = Path(args.input)
    df = pd.read_parquet(p) if p.suffix==".parquet" else pd.read_csv(p)
    BankVisualizer(df, title=args.title).save(args.output, auto_open=not args.no_open)