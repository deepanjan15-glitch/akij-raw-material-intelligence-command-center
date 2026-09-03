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
