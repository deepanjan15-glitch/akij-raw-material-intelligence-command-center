"""Mathematical QA for the analytics engine (instruction 076).

Each test uses KNOWN input data, a MANUALLY-calculated expected result, and
asserts the engine matches. Run: python3 -m pytest tests/ -q
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.core.analytics import (
    pct_change, compute_movement, compute_origin_stats, compute_market_index,
    compute_data_quality, compute_confidence, compute_risk, band,
)


# ---------- movement ----------
def test_pct_change_known():
    assert pct_change(110, 100) == 0.10
    assert pct_change(90, 100) == -0.10
    assert pct_change(None, 100) is None
    assert pct_change(100, 0) is None       # guarded zero denominator
    assert pct_change(100, None) is None


def test_compute_movement():
    import math
    b = {"current": 115, "lastWeek": 100, "lastMonth": 120, "avg2025": 130, "avg2024": 125,
         "ytd2026": 110, "lastYearYtd": 100}
    m = compute_movement(b)
    assert m["wow"] == 0.15
    assert math.isclose(m["mom"], (115 - 120) / 120, rel_tol=1e-12)
    assert math.isclose(m["yoy"], (130 - 125) / 125, rel_tol=1e-12)
    assert m["ytd"] == 0.10


# ---------- origin stats ----------
def test_origin_stats_known():
    # 3 origins: 200, 220, 240 -> mean 220, min 200, max 240, spread 20%
    s = compute_origin_stats([200, 220, 240], ["A", "B", "C"])
    assert s["min"] == 200 and s["max"] == 240
    assert abs(s["mean"] - 220) < 1e-6
    assert s["spreadPct"] == 20.0
    assert s["count"] == 3


def test_origin_stats_empty():
    assert compute_origin_stats([], []) is None
    assert compute_origin_stats([None, None], []) is None


# ---------- market index ----------
def test_market_index_equal_weight():
    # materials: two with base 100 and current 110 -> index 110
    class M:
        def __init__(self, name):
            self.name = name
    mats = [M("A"), M("B")]
    b = {"A": {"current": 110, "avg2025": 100}, "B": {"current": 110, "avg2025": 100}}
    idx = compute_market_index(mats, b)
    assert idx["status"] == "OK"
    assert idx["index"] == 110.0
    assert idx["materialsIncluded"] == 2


def test_market_index_consistent_basket():
    # A has base+current; B has only current (no base) -> B excluded from BOTH sides
    class M:
        def __init__(self, name):
            self.name = name
    mats = [M("A"), M("B")]
    b = {"A": {"current": 110, "avg2025": 100}, "B": {"current": 9999, "avg2025": None}}
    idx = compute_market_index(mats, b)
    assert idx["index"] == 110.0  # B does not distort the index


# ---------- data quality ----------
def test_data_quality_completeness():
    full = {k: 1.0 for k in ["lastWeek", "current", "lastMonth", "sixMo", "avg2024", "avg2025", "lastYearYtd", "ytd2026"]}
    dq = compute_data_quality("X", full, obs_count=2, import_count=2, latest_obs="2026-09-01")
    assert dq["completeness"] == 100.0
    assert dq["issues"] == []


def test_data_quality_flags_stale_and_missing():
    empty = {}
    dq = compute_data_quality("X", empty, obs_count=0, import_count=0, latest_obs=None)
    assert dq["completeness"] == 0.0
    assert any("No current price" in i for i in dq["issues"])
    assert any("No observations or import records" in i for i in dq["issues"])


# ---------- confidence ----------
def test_confidence_bounds():
    dq = {"freshness": 100, "completeness": 100}
    c = compute_confidence("Fastmarkets", dq, obs_count=5, import_count=5, cross_source=True)
    assert 0 <= c["score"] <= 100
    assert c["level"] == "High"
    c2 = compute_confidence("Volza", {"freshness": 0, "completeness": 0}, 0, 0, False)
    assert c2["level"] == "Low"


# ---------- risk ----------
def test_risk_bands():
    assert band(15) == "Low"
    assert band(45) == "Moderate"
    assert band(60) == "High"
    assert band(90) == "Critical"


def test_risk_weights_sum_to_one():
    from engine.core.analytics import RISK_WEIGHTS
    assert abs(sum(RISK_WEIGHTS.values()) - 1.0) < 1e-9


def test_risk_composite_in_range():
    mov = {"wow": 0.5, "mom": 0.4}
    origin = {"count": 1}
    conf = {"score": 50}
    r = compute_risk(mov, origin, {"concentrationPct": 100}, conf, premium=0.5)
    assert 0 <= r["composite"] <= 100


# ---------- end-to-end data sanity (run the real engine) ----------
def test_end_to_end_data_sanity():
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "data")
    mats = json.load(open(os.path.join(data_dir, "materials.json")))
    assert mats["materialsTracked"] == 87
    # no fabricated negative/zero current prices
    for m in mats["materials"]:
        cur = m["benchmark"]["current"]
        if cur is not None:
            assert cur > 0, f"{m['name']} has non-positive current price"
        # movement must be recomputed (not trusted), and null-safe
        assert isinstance(m["movement"], dict)
    idx = json.load(open(os.path.join(data_dir, "market-index.json")))
    assert idx["status"] == "OK" and 0 < idx["index"] < 1000
    meta = json.load(open(os.path.join(data_dir, "meta.json")))
    assert meta["dataHonesty"]["notes"], "data-honesty notes must be present"


# ---------- phase-5 completions ----------
def test_forecast_sample():
    from engine.core.analytics import compute_forecast
    b = {"avg2024": 100, "avg2025": 105, "sixMo": 110, "lastMonth": 108, "lastWeek": 112, "current": 115}
    f = compute_forecast(b)
    assert f["status"] == "SAMPLE"
    assert f["nextWeek"] is not None
    assert f["method"] in ("Naive", "MA(3)", "ExponentialSmoothing")
    assert f["direction"] in ("up", "down", "flat")
    assert f["upper"] >= f["nextWeek"] >= f["lower"] or (f["lower"] is None)


def test_forecast_insufficient():
    from engine.core.analytics import compute_forecast
    assert compute_forecast({"current": 100})["status"] == "UNAVAILABLE"


def test_landed_cost_complete_vs_partial():
    from engine.core.analytics import compute_landed_cost
    complete = compute_landed_cost({}, 500.0, [450.0, 460.0])
    assert complete["status"] == "COMPLETE"
    assert complete["landedCostUsdMt"] == 500.0
    assert complete["impliedLogisticsPremium"] == 50.0  # 500 - 450 (best origin)
    partial = compute_landed_cost({}, None, [450.0])
    assert partial["status"] == "PARTIAL"


def test_savings_estimate():
    from engine.core.analytics import compute_savings
    s = compute_savings({}, 500.0, 1000, [450.0])
    assert s["status"] == "ESTIMATE"
    assert s["gapUsdMt"] == 50.0
    assert s["potentialSavingUsd"] == 50000.0  # 50 * 1000
    assert compute_savings({}, None, 1000, [450.0])["status"] == "UNAVAILABLE"


def test_feed_cost_estimate():
    from engine.core.analytics import compute_feed_cost
    fc = compute_feed_cost({"status": "OK", "index": 110.0}, 8.32)
    assert fc["status"] == "ESTIMATE"
    assert abs(fc["totalFeedCostPressurePct"] - (10.0 + 8.32)) < 1e-9


# ---------- opportunity matrix ----------
def test_position_known():
    from engine.core.analytics import compute_position
    assert compute_position({"current": 115, "avg2025": 100}) == 0.15
    assert compute_position({"current": 100, "avg2025": None}) is None
    assert compute_position({"current": None, "avg2025": 100}) is None
    assert compute_position({"current": 100, "avg2025": 0}) is None  # guarded zero base


def test_opportunity_quadrants():
    from engine.core.analytics import compute_opportunity
    base = {"avg2025": 100}
    # low price + rising -> early opportunity
    o = compute_opportunity({"current": 90, "avg2025": 100}, {"wow": 0.05})
    assert o["status"] == "OK" and o["quadrant"] == "Potential Early Procurement Opportunity"
    # high price + rising -> pressure
    o = compute_opportunity({"current": 110, "avg2025": 100}, {"wow": 0.05})
    assert o["quadrant"] == "Procurement Pressure"
    # high price + declining -> monitor / waiting
    o = compute_opportunity({"current": 110, "avg2025": 100}, {"wow": -0.05})
    assert o["quadrant"] == "Monitor / Potential Waiting Zone"
    # low price + declining -> value zone
    o = compute_opportunity({"current": 90, "avg2025": 100}, {"wow": -0.05})
    assert o["quadrant"] == "Potential Value Zone"


def test_opportunity_unavailable():
    from engine.core.analytics import compute_opportunity
    # no base price -> position unknown
    o = compute_opportunity({"current": 100}, {"wow": 0.05})
    assert o["status"] == "UNAVAILABLE" and o["quadrant"] is None
    # no week-over-week -> momentum unknown
    o = compute_opportunity({"current": 100, "avg2025": 100}, {})
    assert o["status"] == "UNAVAILABLE" and o["quadrant"] is None


# ---------- price history ----------
def test_price_history_basic():
    from engine.core.analytics import compute_price_history
    s = [("2026-06-17", 200.0), ("2026-07-02", 220.0), ("2026-08-02", 209.0)]
    h = compute_price_history(s)
    assert h["points"] == 3
    assert h["start"] == "2026-06-17" and h["end"] == "2026-08-02"
    assert abs(h["changePct"] - (209 - 200) / 200) < 1e-9
    assert abs(h["lastChangePct"] - (209 - 220) / 220) < 1e-9
    assert h["returnVolPct"] is None  # n<5 -> no volatility (honest, not fabricated)


def test_price_history_volatility():
    from engine.core.analytics import compute_price_history
    s = [("d1", 100.0), ("d2", 110.0), ("d3", 99.0), ("d4", 108.9), ("d5", 119.79)]
    h = compute_price_history(s)
    assert h["points"] == 5
    assert h["returnVolPct"] is not None and h["returnVolPct"] >= 0


def test_price_history_insufficient():
    from engine.core.analytics import compute_price_history
    assert compute_price_history([]) is None
    assert compute_price_history([("d1", 100.0)]) is None


# ---------- FX conversion (documented Live FX rates) ----------
def test_fx_conversion():
    from engine.ingest.fastmarkets import _to_usd_mt
    assert _to_usd_mt("AG-X", "Corn CIF $/mt", 100.0, "USD", "mt") == 100.0
    assert abs(_to_usd_mt("AG-X", "Corn €/mt", 100.0, "EUR", "mt") - 117.0) < 1e-9
    assert abs(_to_usd_mt("AG-X", "real/tonne", 100.0, "BRL", "mt") - 18.1) < 1e-9
    assert abs(_to_usd_mt("AG-X", "real/60kg", 100.0, "BRL", "60kg") - (100 * 0.181 * 1000 / 60)) < 1e-9
    assert abs(_to_usd_mt("AG-X", "rupiah/kg", 1000.0, "IDR", "kg") - (1000 * 0.000061 * 1000)) < 1e-9
    assert abs(_to_usd_mt("AG-X", "ringgit", 100.0, "MYR", "mt") - 23.6) < 1e-9
    assert abs(_to_usd_mt("AG-X", "hryvnia", 100.0, "UAH", "mt") - 2.4) < 1e-9


# ---------- import trends (seasonality + YoY) ----------
def test_seasonality_insufficient():
    from engine.core.analytics import compute_seasonality_index
    # 23 months -> below the 24-month threshold -> None
    months = [{"ym": f"2020-{m:02d}", "volumeMt": 100.0} for m in range(1, 12)] + \
             [{"ym": f"2021-{m:02d}", "volumeMt": 100.0} for m in range(1, 13)]
    assert compute_seasonality_index(months) is None


def test_seasonality_flat():
    from engine.core.analytics import compute_seasonality_index
    # constant volume every month over 2 years -> index 100 everywhere
    months = []
    for y in (2020, 2021):
        for m in range(1, 13):
            months.append({"ym": f"{y}-{m:02d}", "volumeMt": 100.0})
    idx = compute_seasonality_index(months)
    assert idx is not None and len(idx) == 12
    assert all(abs(v - 100.0) < 0.5 for v in idx.values())


def test_seasonality_peak():
    from engine.core.analytics import compute_seasonality_index
    # December has 2x the volume of other months -> its index should be higher
    months = []
    for y in (2020, 2021):
        for m in range(1, 13):
            months.append({"ym": f"{y}-{m:02d}", "volumeMt": 200.0 if m == 12 else 100.0})
    idx = compute_seasonality_index(months)
    assert idx[12] > 100 and all(idx[m] < 100 for m in range(1, 12))


def test_yoy_complete_years():
    from engine.core.analytics import compute_yoy
    months = []
    for m in range(1, 13):
        months.append({"ym": f"2023-{m:02d}", "volumeMt": 100.0, "valueUsd": 1000.0})
    for m in range(1, 13):
        months.append({"ym": f"2024-{m:02d}", "volumeMt": 120.0, "valueUsd": 1200.0})
    # partial 2025 (not complete) must be excluded from YoY
    for m in range(1, 6):
        months.append({"ym": f"2025-{m:02d}", "volumeMt": 200.0, "valueUsd": 2000.0})
    yoy = compute_yoy(months)
    assert yoy["latestYear"] == 2024 and yoy["priorYear"] == 2023
    assert abs(yoy["volumeYoYPct"] - 0.20) < 1e-9
    assert abs(yoy["valueYoYPct"] - 0.20) < 1e-9


def test_yoy_insufficient():
    from engine.core.analytics import compute_yoy
    months = [{"ym": f"2024-{m:02d}", "volumeMt": 100.0} for m in range(1, 8)]
    assert compute_yoy(months) is None





# ---------- sourcing gap / country normalisation ----------
def test_sourcing_gap():
    from engine.core.analytics import compute_sourcing_gap
    b = {"cheapestCountry1": "Ukraine", "price1": 216.0, "cheapestCountry2": "Argentina", "price2": 229.75,
         "cheapestCountry3": "Brazil", "price3": 241.5, "bestBuyCountry": "Ukraine", "akijSourcingCountry": "Brazil"}
    g = compute_sourcing_gap(b)
    assert g["bestBuyPrice"] == 216.0
    assert g["akijQuotedPrice"] == 241.5
    assert g["costGapUsdMt"] == 25.5
    assert abs(g["costGapPct"] - 0.1181) < 1e-4


def test_sourcing_gap_no_match():
    from engine.core.analytics import compute_sourcing_gap
    b = {"cheapestCountry1": "Ukraine", "price1": 216.0, "akijSourcingCountry": "Morocco"}
    g = compute_sourcing_gap(b)
    assert g["akijQuotedPrice"] is None
    assert g["costGapUsdMt"] is None


def test_sourcing_gap_no_price():
    from engine.core.analytics import compute_sourcing_gap
    assert compute_sourcing_gap({}) is None


def test_normalize_country():
    from engine.core.analytics import normalize_country
    assert normalize_country("USA") == "United States"
    assert normalize_country("United States of America") == "United States"
    assert normalize_country("United States (USA)") == "United States"
    assert normalize_country("RUssia") == "Russia"
    assert normalize_country("Brazil") == "Brazil"
    assert normalize_country(None) is None


def test_clean_signal():
    from engine.core.analytics import clean_signal
    assert clean_signal("🔴 HIGH COST") == "HIGH COST"
    assert clean_signal("✅ OPTIMAL") == "OPTIMAL"
    assert clean_signal("-") is None
    assert clean_signal(None) is None
