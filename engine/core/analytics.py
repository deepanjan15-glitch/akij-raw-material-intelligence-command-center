"""Analytics + intelligence engine (data honesty enforced: no fabrication)."""
from __future__ import annotations
import math
from collections import defaultdict
from datetime import date

# Configurable risk weights (instruction 046) — starting values, not immutable truth
RISK_WEIGHTS = {
    "price": 0.20,
    "momentum": 0.15,
    "forecast": 0.15,
    "originConcentration": 0.15,
    "supplierConcentration": 0.10,
    "importDependency": 0.10,
    "procurementPremium": 0.10,
    "dataUncertainty": 0.05,
}

RISK_BANDS = [(0, 30, "Low"), (31, 50, "Moderate"), (51, 70, "High"), (71, 100, "Critical")]


def band(score: float) -> str:
    for lo, hi, name in RISK_BANDS:
        if lo <= round(score) <= hi:
            return name
    return "Critical" if score > 70 else "Low"


def pct_change(new, old):
    if new is None or old is None or old == 0:
        return None
    return (new - old) / old


def compute_movement(bench: dict) -> dict:
    return {
        "wow": pct_change(bench.get("current"), bench.get("lastWeek")),
        "mom": pct_change(bench.get("current"), bench.get("lastMonth")),
        "yoy": pct_change(bench.get("avg2025"), bench.get("avg2024")),
        "ytd": pct_change(bench.get("ytd2026"), bench.get("lastYearYtd")),
    }


def compute_origin_stats(values: list[float], countries: list[str]) -> dict | None:
    vals = [v for v in values if v is not None]
    if not vals:
        return None
    mean = sum(vals) / len(vals)
    std = math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals))
    lo = min(vals)
    hi = max(vals)
    return {
        "count": len(vals),
        "min": round(lo, 2),
        "max": round(hi, 2),
        "mean": round(mean, 2),
        "std": round(std, 2),
        "cv": round(std / mean, 4) if mean else None,
        "spreadPct": round((hi - lo) / lo * 100, 2) if lo else None,
        "countries": countries,
    }


def compute_position(bench: dict) -> float | None:
    """Current price deviation vs the 2025 calendar-year average (fraction).

    Uses avg2025 as the historical mean because it is the same documented base
    period as the Raw Material Market Index. Returns None (not zero) when the
    current price or the base is missing — never fabricated.
    """
    return pct_change(bench.get("current"), bench.get("avg2025"))


def compute_opportunity(bench: dict, mov: dict) -> dict:
    """2x2 procurement-opportunity classification (analytical interpretation).

    x = price deviation vs 2025 average (positive => above historical mean)
    y = week-on-week price change (positive => rising)

    Quadrants (analytical labels — NOT buy/sell instructions):
      low price + rising     -> Potential Early Procurement Opportunity
      high price + rising    -> Procurement Pressure
      high price + declining -> Monitor / Potential Waiting Zone
      low price + declining  -> Potential Value Zone
    """
    pos = compute_position(bench)
    wow = mov.get("wow")
    if pos is None or wow is None:
        return {"status": "UNAVAILABLE", "positionVs2025": pos, "momentumWow": wow, "quadrant": None}
    high = pos >= 0
    rising = wow >= 0
    if not high and rising:
        quadrant = "Potential Early Procurement Opportunity"
    elif high and rising:
        quadrant = "Procurement Pressure"
    elif high and not rising:
        quadrant = "Monitor / Potential Waiting Zone"
    else:
        quadrant = "Potential Value Zone"
    return {
        "status": "OK",
        "positionVs2025": round(pos, 4),
        "momentumWow": round(wow, 4),
        "quadrant": quadrant,
    }


def compute_price_history(series: list) -> dict | None:
    """Derived statistics over a material's snapshot price history.

    series = [(date, price), ...] chronological. Returns None when fewer than 2
    points exist (a single point is not a series). returnVolPct is the standard
    deviation of log returns over the (irregular) snapshots — reported per-period,
    NOT annualized (the cadence is 9–22 day, so annualization would be misleading).
    """
    if not series or len(series) < 2:
        return None
    dates = [d for d, _ in series]
    vals = [v for _, v in series]
    n = len(vals)
    change = pct_change(vals[-1], vals[0])
    last_change = pct_change(vals[-1], vals[-2])
    rets = []
    for i in range(1, n):
        if vals[i - 1] and vals[i]:
            rets.append(math.log(vals[i] / vals[i - 1]))
    vol = None
    if n >= 5 and len(rets) >= 2:
        m = sum(rets) / len(rets)
        vol = math.sqrt(sum((r - m) ** 2 for r in rets) / len(rets))
    return {
        "points": n,
        "start": dates[0],
        "end": dates[-1],
        "dates": dates,
        "values": [round(v, 2) for v in vals],
        "changePct": round(change, 4) if change is not None else None,
        "lastChangePct": round(last_change, 4) if last_change is not None else None,
        "returnVolPct": round(vol * 100, 2) if vol is not None else None,
        "frequency": "irregular snapshots (9–22 day gaps)",
    }


def compute_seasonality_index(months: list) -> dict | None:
    """Seasonal index = (calendar-month average) / (long-term monthly average) × 100.

    months = [{"ym": "YYYY-MM", "volumeMt": ...}, ...]. Returns {month_number: index}
    only when >= 24 monthly observations exist (2 years); otherwise None (a shorter
    series cannot support a defensible seasonal pattern).
    """
    by_month = defaultdict(list)
    for m in months:
        try:
            mm = int(str(m["ym"]).split("-")[1])
        except (KeyError, IndexError, ValueError):
            continue
        if m.get("volumeMt"):
            by_month[mm].append(m["volumeMt"])
    if len(months) < 24 or not by_month:
        return None
    all_vals = [v for vs in by_month.values() for v in vs]
    overall = sum(all_vals) / len(all_vals)
    if not overall:
        return None
    return {mm: round(sum(vs) / len(vs) / overall * 100, 1) for mm, vs in by_month.items()}


def compute_yoy(months: list) -> dict | None:
    """Year-over-year on volume/value using the last two COMPLETE (12-month) years.

    Partial years (e.g. the in-progress 2025) are excluded so the comparison is
    like-for-like. Returns None when fewer than two complete years exist.
    """
    by_year = defaultdict(lambda: [0.0, 0.0, 0])
    for m in months:
        try:
            y = int(str(m["ym"]).split("-")[0])
        except (KeyError, IndexError, ValueError):
            continue
        by_year[y][0] += m.get("volumeMt") or 0
        by_year[y][1] += m.get("valueUsd") or 0
        by_year[y][2] += 1
    complete = {y: v for y, v in by_year.items() if v[2] >= 12}
    if len(complete) < 2:
        return None
    years = sorted(complete)
    ly, py = years[-1], years[-2]
    lv, pv = complete[ly][0], complete[py][0]
    lval, pval = complete[ly][1], complete[py][1]
    return {
        "latestYear": ly, "priorYear": py,
        "latestVolumeMt": round(lv, 1), "priorVolumeMt": round(pv, 1),
        "volumeYoYPct": round((lv - pv) / pv, 4) if pv else None,
        "latestValueUsd": round(lval, 0), "priorValueUsd": round(pval, 0),
        "valueYoYPct": round((lval - pval) / pval, 4) if pval else None,
    }


def compute_market_index(materials, benchmarks) -> dict:
    """Equal-weight Raw Material Market Index (fallback — labelled).

    Uses a CONSISTENT set: materials with both a base-period price (avg2025) and a
    current price, so the numerator and denominator cover the same basket.
    """
    current_vals, base_vals, names = [], [], []
    for m in materials:
        b = benchmarks.get(m.name, {})
        cur = b.get("current")
        base = b.get("avg2025")
        if cur is not None and base is not None and base != 0:
            current_vals.append(cur)
            base_vals.append(base)
            names.append(m.name)
    if not current_vals:
        return {"status": "UNAVAILABLE", "reason": "No paired base/current prices available"}
    avg_current = sum(current_vals) / len(current_vals)
    avg_base = sum(base_vals) / len(base_vals)
    index = avg_current / avg_base * 100
    return {
        "status": "OK",
        "method": "Equal-weight fallback (no valid volume/spend weights provided)",
        "basePeriod": "avg2025 (2025 calendar-year average)",
        "baseValue": round(avg_base, 2),
        "currentAvg": round(avg_current, 2),
        "index": round(index, 2),
        "materialsIncluded": len(names),
        "weights": "equal",
    }


def compute_data_quality(name: str, bench: dict, obs_count: int, import_count: int, latest_obs: str | None) -> dict:
    fields = ["lastWeek", "current", "lastMonth", "sixMo", "avg2024", "avg2025", "lastYearYtd", "ytd2026"]
    present = sum(1 for f in fields if bench.get(f) is not None)
    completeness = present / len(fields) * 100
    issues = []
    if bench.get("current") is None:
        issues.append("No current price")
    if bench.get("current") is not None and bench["current"] <= 0:
        issues.append("Non-positive current price")
    if obs_count == 0 and import_count == 0:
        issues.append("No observations or import records")
    if latest_obs and latest_obs < "2026-08-15":
        issues.append("Stale observation (pre 2026-08-15)")
    freshness = 100 if (latest_obs and latest_obs >= "2026-08-15") else (50 if latest_obs else 0)
    source_coverage = 100 if (obs_count > 0 and import_count > 0) else (60 if (obs_count or import_count) else 0)
    score = round(0.4 * completeness + 0.25 * freshness + 0.15 * source_coverage + 0.2 * (100 if not issues else max(0, 100 - 15 * len(issues))), 1)
    return {
        "score": round(score, 1),
        "completeness": round(completeness, 1),
        "freshness": round(freshness, 1),
        "sourceCoverage": round(source_coverage, 1),
        "issues": issues,
    }


def compute_confidence(source: str, dq: dict, obs_count: int, import_count: int, cross_source: bool) -> dict:
    source_q = {"Fastmarkets": 90, "NBR Data": 75, "Volza": 55}.get(source, 50)
    score = round(
        0.35 * source_q + 0.25 * dq["freshness"] + 0.20 * dq["completeness"]
        + 0.10 * (100 if cross_source else 40) + 0.10 * (100 if (obs_count + import_count) > 0 else 0),
        1,
    )
    return {
        "score": score,
        "level": "High" if score >= 75 else "Medium" if score >= 50 else "Low",
        "basis": {
            "sourceQuality": source_q,
            "freshness": dq["freshness"],
            "completeness": dq["completeness"],
            "crossSourceAgreement": cross_source,
            "observationDepth": obs_count + import_count,
        },
    }


def compute_risk(mov: dict, origin: dict | None, import_dep: dict | None, confidence: dict, premium: float | None) -> dict:
    dims = {}
    if mov.get("mom") is not None:
        dims["price"] = min(100, max(0, abs(mov["mom"]) * 100 * 2.5))
    else:
        dims["price"] = 0
    if mov.get("wow") is not None:
        dims["momentum"] = min(100, max(0, abs(mov["wow"]) * 100 * 4))
    else:
        dims["momentum"] = 0
    dims["forecast"] = 0  # no validated forecast -> zero signal (not fabricating)
    if origin is not None:
        dims["originConcentration"] = 75 if origin["count"] == 1 else (40 if origin["count"] == 2 else 10)
    else:
        dims["originConcentration"] = 0
    dims["supplierConcentration"] = 0  # no supplier data
    if import_dep is not None and import_dep.get("concentrationPct") is not None:
        dims["importDependency"] = min(100, import_dep["concentrationPct"])
    else:
        dims["importDependency"] = 0
    dims["procurementPremium"] = min(100, max(0, premium * 100 * 3)) if premium is not None else 0
    dims["dataUncertainty"] = 100 - confidence["score"]

    composite = sum(dims[k] * RISK_WEIGHTS[k] for k in RISK_WEIGHTS)
    return {"composite": round(composite, 1), "band": band(composite), "dimensions": {k: round(v, 1) for k, v in dims.items()}}


def compute_landed_cost(bench, import_unit_value, obs_values) -> dict:
    origin = min([v for v in obs_values if v is not None], default=None)
    if origin is None and import_unit_value is None:
        return {"status": "UNAVAILABLE", "reason": "No origin or import value available"}
    components = {
        "originPrice": round(origin, 2) if origin else None,
        "freight": None,
        "insurance": None,
        "dutyTax": None,
        "portHandling": None,
        "financeLC": None,
        "other": None,
    }
    missing = [k for k, v in components.items() if v is None and k != "originPrice"]
    status = "PARTIAL" if missing else "COMPLETE"
    return {
        "status": status,
        "components": components,
        "missingComponents": missing,
        "importUnitValueUsdMt": round(import_unit_value, 2) if import_unit_value else None,
        "note": "Origin price is FOB/FAS benchmark; freight, insurance, duty, handling and finance are not provided." if missing else "",
    }


def compute_savings(bench, landed) -> dict:
    # Requires Akij procurement price — not provided. Render UNAVAILABLE honestly.
    return {
        "status": "UNAVAILABLE",
        "reason": "Akij procurement price and volume not provided. Cannot compute Akij − Best Landed × quantity.",
        "potentialSavingUsdMt": None,
        "financialExposureUsd": None,
    }


def compute_import_intelligence(imports_by_material: dict) -> dict:
    out = {}
    for mid, recs in imports_by_material.items():
        vol = [r.volumeMt for r in recs if r.volumeMt]
        val = [r.valueUsd for r in recs if r.valueUsd]
        uv = [r.unitValueUsdMt for r in recs if r.unitValueUsdMt]
        origins = defaultdict(lambda: [0.0, 0.0, ""])
        for r in recs:
            if r.volumeMt and r.countryCode:
                origins[r.countryCode][0] += r.volumeMt
            if r.valueUsd and r.countryCode:
                origins[r.countryCode][1] += r.valueUsd
            if r.countryName:
                origins[r.countryCode][2] = r.countryName
        total_vol = sum(v for v in vol)
        top = sorted(origins.items(), key=lambda kv: kv[1][0], reverse=True)
        concentration = round(top[0][1][0] / total_vol * 100, 1) if total_vol else None
        out[mid] = {
            "volumeMt": round(total_vol, 1) if total_vol else None,
            "valueUsd": round(sum(val), 0) if val else None,
            "unitValueUsdMt": round(sum(uv) / len(uv), 2) if uv else None,
            "originCount": len(origins),
            "origins": [{"countryCode": c, "country": (v[2] or c), "volumeMt": round(v[0], 1), "valueUsd": round(v[1], 0)} for c, v in origins.items()],
            "topOrigin": (top[0][1][2] or top[0][0]) if top else None,
            "concentrationPct": concentration,
        }
    return out


# ===========================================================================
# Phase-5 completions (sample/estimate labelled; no fabrication)
# ===========================================================================

ANCHOR_KEYS = ["avg2024", "avg2025", "sixMo", "lastMonth", "lastWeek", "current"]


def _anchor_series(bench: dict) -> list[float]:
    return [bench[k] for k in ANCHOR_KEYS if bench.get(k) is not None]


def _backtest_mape(series: list[float], predict_fn) -> float | None:
    """Leave-one-out MAPE: predict each point from all prior points."""
    if len(series) < 3:
        return None
    errs = []
    for i in range(2, len(series)):
        hist = series[:i]
        pred = predict_fn(hist)
        if pred and series[i]:
            errs.append(abs(pred - series[i]) / abs(series[i]))
    return sum(errs) / len(errs) if errs else None


def compute_forecast(bench: dict) -> dict:
    """SAMPLE forecast (timebeing) from the 6 anchor points. Clearly labelled."""
    s = _anchor_series(bench)
    if len(s) < 2:
        return {"status": "UNAVAILABLE", "reason": "insufficient anchor points"}
    last = s[-1]

    def naive(hist): return hist[-1] if hist else None
    def ma3(hist): return sum(hist[-3:]) / len(hist[-3:]) if hist else None
    def es(hist, alpha=0.5):
        if not hist: return None
        v = hist[0]
        for x in hist[1:]:
            v = alpha * x + (1 - alpha) * v
        return v

    std = (sum((x - (sum(s) / len(s))) ** 2 for x in s) / len(s)) ** 0.5
    f_naive = naive(s)
    f_ma = ma3(s)
    f_es = es(s)

    mape_naive = _backtest_mape(s, naive)
    mape_ma = _backtest_mape(s, ma3)
    mape_es = _backtest_mape(s, es)

    # choose the method with the lowest backtest MAPE (fallback: ES)
    methods = {
        "Naive": (f_naive, mape_naive),
        "MA(3)": (f_ma, mape_ma),
        "ExponentialSmoothing": (f_es, mape_es),
    }
    valid = {k: v for k, v in methods.items() if v[0] is not None}
    chosen = min(valid, key=lambda k: (valid[k][1] is None, valid[k][1] or 0)) if valid else None

    return {
        "status": "SAMPLE",
        "label": "SAMPLE forecast — low confidence (coarse anchors, no full time series)",
        "window": [f"{k}={bench.get(k)}" for k in ANCHOR_KEYS if bench.get(k) is not None],
        "nextWeek": round(f_es, 2) if f_es else None,
        "lower": round((f_es - std), 2) if f_es else None,
        "upper": round((f_es + std), 2) if f_es else None,
        "method": chosen,
        "methods": {k: {"value": round(v[0], 2) if v[0] else None,
                        "mape": round(v[1], 4) if v[1] is not None else None} for k, v in methods.items()},
        "direction": "up" if f_es and f_es > last else ("down" if f_es and f_es < last else "flat"),
    }


def compute_landed_cost(bench: dict, import_unit_value, obs_values) -> dict:
    """Landed cost. When an import (CIF) unit value exists, it IS the actual landed
    cost; the implied logistics premium = import value − best FOB origin. Otherwise PARTIAL."""
    origin = min([v for v in obs_values if v is not None], default=None)
    if import_unit_value is not None:
        implied = round(import_unit_value - origin, 2) if origin is not None else None
        return {
            "status": "COMPLETE",
            "originPriceFob": round(origin, 2) if origin else None,
            "landedCostUsdMt": round(import_unit_value, 2),
            "impliedLogisticsPremium": implied,  # freight + insurance + duty + handling + finance (not itemized)
            "note": "Landed cost taken from actual NBR import (CIF) unit value; logistics premium is implied (not itemized).",
        }
    components = {"originPrice": round(origin, 2) if origin else None,
                  "freight": None, "insurance": None, "dutyTax": None,
                  "portHandling": None, "financeLC": None, "other": None}
    missing = [k for k, v in components.items() if v is None and k != "originPrice"]
    return {"status": "PARTIAL", "components": components, "missingComponents": missing,
            "importUnitValueUsdMt": None,
            "note": "No import record for this material; freight/insurance/duty/handling/finance not provided."}


def compute_savings(bench: dict, import_unit_value, volume, obs_values) -> dict:
    """Sourcing-optimization saving: (landed − best FOB origin) × import volume.
    Positive = paying above the cheapest origin → saving opportunity."""
    best = min([v for v in obs_values if v is not None], default=None)
    if import_unit_value is None or best is None:
        return {"status": "UNAVAILABLE",
                "reason": "Need both an import (landed) value and a best-origin benchmark."}
    gap = import_unit_value - best
    saving = round(gap * volume, 0) if volume else None
    return {
        "status": "ESTIMATE",
        "label": "Sourcing-optimization estimate (landed vs best origin, not Akij procurement)",
        "gapUsdMt": round(gap, 2),
        "volumeMt": volume,
        "potentialSavingUsd": saving,
        "note": "Akij procurement price is not provided; this is the import-vs-best-origin gap, not Akij-specific saving.",
    }


def compute_feed_cost(index: dict, inflation_pct: float) -> dict:
    """Portfolio feed-cost pressure = market index change + Bangladesh CPI inflation (ESTIMATE)."""
    if index.get("status") != "OK":
        return {"status": "UNAVAILABLE", "reason": "no market index"}
    index_chg = index["index"] - 100
    total_pressure = round(index_chg + inflation_pct, 2)
    return {
        "status": "ESTIMATE",
        "label": "Portfolio feed-cost pressure (ESTIMATE — no formulation data)",
        "inflationPct": inflation_pct,
        "inflationSource": "Bangladesh Bank / Trading Economics, July 2026 CPI",
        "marketIndexChangePct": round(index_chg, 2),
        "totalFeedCostPressurePct": total_pressure,
        "note": "Feed-cost impact by animal (Broiler/Layer/Fish/Cattle) requires formulation/inclusion data — not provided.",
    }


def compute_scenario(index: dict, inflation_pct: float) -> dict:
    """SAMPLE scenario engine: sensitivity of the market index to ±% moves in key inputs.
    All output labelled SIMULATION."""
    if index.get("status") != "OK":
        return {"status": "UNAVAILABLE", "reason": "no market index"}
    base = index["index"]
    sensitivities = [
        {"input": "Maize", "weight": 0.20, "shockPct": 10, "indexImpactPts": round(base * 0.20 * 0.10, 2)},
        {"input": "Soybean Meal", "weight": 0.25, "shockPct": 10, "indexImpactPts": round(base * 0.25 * 0.10, 2)},
        {"input": "Soybean Oil", "weight": 0.15, "shockPct": 10, "indexImpactPts": round(base * 0.15 * 0.10, 2)},
        {"input": "Wheat", "weight": 0.15, "shockPct": 10, "indexImpactPts": round(base * 0.15 * 0.10, 2)},
        {"input": "Additives/Amino acids", "weight": 0.15, "shockPct": 10, "indexImpactPts": round(base * 0.15 * 0.10, 2)},
        {"input": "FX (BDT/USD)", "weight": 0.10, "shockPct": 5, "indexImpactPts": round(base * 0.10 * 0.05, 2)},
        {"input": "Freight", "weight": 0.00, "shockPct": 10, "indexImpactPts": None},
    ]
    return {
        "status": "SIMULATION",
        "label": "SIMULATION — NOT ACTUAL",
        "baseIndex": base,
        "note": "Category weights are indicative (no formulation/spend weights). Freight impact is excluded (no freight data).",
        "sensitivities": sensitivities,
    }
