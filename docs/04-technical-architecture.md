# PHASE 4 — Technical Architecture

## 1. Architecture layers (instruction 027)
Four clean layers, one-way dependencies (data ← analytics ← intelligence ← presentation):

```
┌───────────────────────────────────────────────────────────────┐
│ PRESENTATION  (static web app: Command Center + 12 modules +    │
│                role views + filters + drill-down + exports)      │
├───────────────────────────────────────────────────────────────┤
│ INTELLIGENCE  (risk engine, evidence confidence, landed cost,   │
│                savings, recommendations, alerts, "what changed") │
├───────────────────────────────────────────────────────────────┤
│ ANALYTICS     (statistics, movement, volatility, anomaly,       │
│                market index, forecasting + backtesting)          │
├───────────────────────────────────────────────────────────────┤
│ DATA          (normalized entities + validation + data-quality) │
└───────────────────────────────────────────────────────────────┘
```

- **Data layer** = Python ingestion → normalized JSON entities + DQ scoring.
- **Analytics layer** = Python engine → statistics, index, forecasts (testable, backtested).
- **Intelligence layer** = Python engine → risk, confidence, savings, recommendations.
- **Presentation layer** = static vanilla JS + Chart.js reading the computed JSON (thin, deterministic).

## 2. Why a Python engine + static web app
- Analytics (statistics, forecast backtests, risk) are **testable and auditable** in Python (instruction 076).
- The browser stays a **thin renderer** — no duplicated, un-versioned calculation in JS.
- Static output deploys to GitHub Pages unchanged.

## 3. Normalized data model (instruction 026)
```
Material (id, name, category, hsCode, unit, specification)
Country  (code, name)
Source   (id, name, type, quality, freshnessPolicy)
Supplier (id, name, country)                          — populated only when data exists
PriceObservation (id, materialId, sourceId, countryCode, incoterm, currency, unit,
                  value, valueUsdMt, market, specification, observationDate, loadedAt)
Import   (id, materialId, countryCode, hsCode, period, volumeMt, valueUsd, unitValueUsdMt)
Procurement (id, materialId, supplierId, countryCode, incoterm, priceUsdMt, date) — EMPTY until provided
Forecast (id, materialId, method, horizon, value, lower, upper, mae, mape, window, modelNote)
```

Every price retains **Material + Specification + Date + Location + Market + Incoterm + Currency + Unit + Source**
(instruction 030).

## 4. Computed intelligence artifacts
- `data-quality.json` — completeness/freshness/validity/consistency/source-coverage per material.
- `analytics.json` — statistics (mean/median/σ/CV/percentile/z-score/4W-12W-26W-52W), WoW/MoM/YoY, momentum.
- `market-index.json` — base-100 index + weights used (equal-weight labelled fallback).
- `risk.json` — 7 risk dimensions + composite + risk-weighted exposure.
- `procurement.json` — benchmark/akij/supplier/landed-cost/saving/fairness/negotiation (PARTIAL where inputs missing).
- `forecast.json` — model comparison + chosen forecast + bounds + MAE/RMSE/MAPE/Bias.
- `scenario.json` — SIMULATION-labelled feed-cost sensitivity.
- `alerts.json` — priority = Magnitude × Abnormality × Exposure × Evidence Confidence.
- `evidence.json` — per-material evidence confidence.

## 5. Directory layout
```
akij-raw-material-intelligence-command-center/
├─ docs/            # 01.., ARCHITECTURE.md, DATA_DICTIONARY.md, KPI_DICTIONARY.md,
│                   # METHODOLOGY.md, DATA_GOVERNANCE.md, QA.md, CHANGELOG.md
├─ engine/          # Python: ingest → normalize → analytics → intelligence → export JSON
│   ├─ ingest/      # readers for Fastmarkets / NBR / (future) procurement, formulations
│   ├─ core/        # entities, validation, dq, statistics, index, forecast, risk, confidence
│   └─ run.py       # orchestration
├─ app/             # presentation (index.html, css/, js/, data/) — deployable to Pages
├─ tests/           # pytest: mathematical QA for every KPI (instruction 076)
└─ README.md
```

## 6. Quality gates (instruction 077)
Architecture → Data Model → Calculations → Analytics → UI → Integration → Deployment.
Each gate has an explicit exit criterion documented in `docs/QA.md`.

## 7. Technology choices
- Python 3.11 stdlib + `openpyxl` (already present) for ingestion/analytics.
- `pytest` for mathematical QA.
- Vanilla JS + Chart.js for presentation (no framework needed at this data scale).
- GitHub Pages for deployment; Git `main` stable + feature branches (instruction 041).

## 8. Constraints carried from the specification
- Risk weights are **configurable starting values**, not immutable truth (instruction 046).
- Risk bands 0–30 Low / 31–50 Moderate / 51–70 High / 71–100 Critical (instruction 047).
- Equal-weight market index is labelled a **fallback** (instruction 036).
- All scenario output labelled **SIMULATION — NOT ACTUAL** (instruction 054).
- Missing cost components ⇒ **Partial Landed Cost** with the missing component named (instruction 033).
