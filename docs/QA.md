# QA

## Mathematical QA (instruction 076)
`python3 -m pytest tests/ -q` — 13 tests, all passing.

Coverage:
- `pct_change` guards (None / zero denominator).
- `compute_movement` vs hand-calculated WoW/MoM/YoY/YTD.
- `compute_origin_stats` mean/min/max/spread on known values + empty-input handling.
- `compute_market_index` equal-weight + consistent-basket (no asymmetric base).
- `compute_data_quality` completeness + issue flags.
- `compute_confidence` bounds + level thresholds.
- `band()` thresholds (0–30/31–50/51–70/71–100).
- `RISK_WEIGHTS` sums to 1.0.
- End-to-end: 87 materials, no non-positive prices, honest meta present.

## Quality gates (instruction 077)
| Gate | Criterion | Status |
|---|---|---|
| Architecture | 4 layers, one-way deps, normalized entities | ✅ docs/ARCHITECTURE.md |
| Data model | entities + data dictionary | ✅ docs/DATA_DICTIONARY.md |
| Calculations | pytest mathematical QA | ✅ 13/13 pass |
| Analytics | movement/index/DQ/confidence/risk | ✅ engine/core/analytics.py |
| UI | modules + role views + honest states | ✅ app/ (verified in browser, 0 console errors) |
| Integration | engine → JSON → frontend | ✅ load verified |
| Deployment | GitHub Pages | ✅ live |

## Known limitations (not defects)
Forecast / scenario / feed-cost / savings are UNAVAILABLE by design (missing inputs) and are rendered
explicitly rather than estimated — see DATA_GOVERNANCE.md open items.
