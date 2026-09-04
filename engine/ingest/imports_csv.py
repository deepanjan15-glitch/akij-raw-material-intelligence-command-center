"""Ingest multi-year Bangladesh customs import records -> per-material monthly trends.

Source: three "Master_Import_Data" CSV exports (V1/V2/V3). They overlap, so rows
are deduplicated by Bill Of Entry No. Only feed raw-material HS codes are kept.
Unit value is computed as (USD invoice value) / (quantity MT) — the source
"Price In MT" column is NOT trusted (contains unit-conversion outliers).
"""
from __future__ import annotations
import csv
from collections import defaultdict

CSV_FILES = [
    "/Users/deep/Downloads/Master_Import_Data_V1 - Master_Import_Data_V1.csv",
    "/Users/deep/Downloads/Master_Import_Data_V2 - Master_Import_Data_V2.csv",
    "/Users/deep/Downloads/Master_Import_Data_V3 - Master_Import_Data_V3.csv",
]

MONTH_NUM = {"january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
             "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12}

# HS code -> product-group display name (feed raw materials)
HS_GROUP = {
    "10059090": "Maize / Corn",
    "23040000": "Soybean Meal",
    "23033000": "DDGS",
    "23099090": "Feed Supplements & Premix",
    "25174900": "Limestone Powder",
    "29225000": "L-Threonine",
    "23064900": "Rapeseed Meal / Extract",
    "29224100": "L-Lysine",
    "28352600": "MCP",
    "12019090": "Soybean (Basis)",
    "29304000": "Methionine (L/DL)",
    "15079010": "Soybean Oil",
    "23031000": "Corn Gluten Feed/Meal",
    "23023000": "Wheat Bran",
    "28352500": "DCP",
    "12081000": "Soybean Flour",
    "29231000": "Choline Chloride",
    "10059000": "Corn (FOB/CIF/Basis)",
    "12019000": "Soybean",
    "10019990": "Wheat",
    "10039090": "Barley",
    "15042000": "Fish Oil",
    "15122100": "Cotton Seed Oil",
    "23064100": "Rapeseed Oil",
    "23080000": "Soybean Organic Feed",
}


def _num(v):
    if v is None:
        return None
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return None


def ingest_import_trends() -> list[dict]:
    """Return per-HS-group monthly import series (volume, USD value, unit value).

    Deduplicated by Bill Of Entry No. Value is aggregated from USD rows only.
    Resilient: returns [] if the CSV files are absent/unreadable.
    """
    hs_set = set(HS_GROUP)
    monthly = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))  # hs -> ym -> [qty, usd]
    origins = defaultdict(lambda: defaultdict(float))                # hs -> origin -> qty
    totals = defaultdict(lambda: [0.0, 0.0, 0])                      # hs -> [qty, usd, n]
    seen: set[str] = set()
    skipped_dup = 0
    try:
        for fn in CSV_FILES:
            with open(fn, newline="", encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    hs = (row.get("HS Code") or "").strip().split(".")[0]
                    if hs not in hs_set:
                        continue
                    boe = (row.get("Bill Of Entry No") or "").strip()
                    if boe and boe in seen:
                        skipped_dup += 1
                        continue
                    if boe:
                        seen.add(boe)
                    y = (row.get("Year") or "").strip()
                    mname = (row.get("Month") or "").strip().lower()
                    mnum = MONTH_NUM.get(mname)
                    if not y.isdigit() or mnum is None:
                        continue
                    qty = _num(row.get("Quantity In MT"))
                    val = _num(row.get("Invoice Value (Foreign Currency)"))
                    cur = (row.get("CURCODE") or "").strip().upper()
                    origin = (row.get("Origin") or row.get("Country of Origin") or "").strip().title()
                    if not qty or qty <= 0:
                        continue
                    ym = f"{y}-{mnum:02d}"
                    monthly[hs][ym][0] += qty
                    if cur == "USD" and val:
                        monthly[hs][ym][1] += val
                    totals[hs][0] += qty
                    if cur == "USD" and val:
                        totals[hs][1] += val
                    totals[hs][2] += 1
                    if origin and origin != "0":
                        origins[hs][origin] += qty
    except FileNotFoundError:
        return []

    out = []
    for hs, name in HS_GROUP.items():
        if not monthly[hs]:
            continue
        months = []
        for ym in sorted(monthly[hs]):
            q, v = monthly[hs][ym]
            months.append({
                "ym": ym,
                "volumeMt": round(q, 1),
                "valueUsd": round(v, 0) if v else None,
                "unitValueUsdMt": round(v / q, 2) if v else None,
            })
        top = sorted(origins[hs].items(), key=lambda kv: -kv[1])[:5]
        total_vol = totals[hs][0]
        origin_list = [{"origin": o, "volumeMt": round(v, 1),
                        "sharePct": round(v / total_vol * 100, 1) if total_vol else None}
                       for o, v in top]
        out.append({
            "hs": hs,
            "name": name,
            "months": months,
            "totalVolumeMt": round(total_vol, 1),
            "totalValueUsd": round(totals[hs][1], 0),
            "avgUnitValueUsdMt": round(totals[hs][1] / total_vol, 2) if total_vol else None,
            "records": totals[hs][2],
            "origins": origin_list,
        })
    out.sort(key=lambda g: -(g["totalValueUsd"] or 0))
    return out
