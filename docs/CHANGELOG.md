# CHANGELOG

## [0.1.0] — 2026-09-04 — First independent build
- Phase 1 Reference Study + Phase 2 Gap Analysis (docs/01, docs/02).
- Product requirements + technical architecture (docs/03, docs/04).
- Normalized data model (Material / Source / PriceObservation / Import / Procurement schema).
- Python engine: ingest Fastmarkets (18 sheets) + NBR (16 sheets), map to 87-material master,
  recompute movement / origin stats / market index / data quality / evidence confidence / risk /
  landed cost / savings.
- Presentation layer: 12 modules + role views (CEO/Procurement/Research/Commercial) + honest
  UNAVAILABLE/PARTIAL states.
- Mathematical QA (13 pytest tests) + documentation set (ARCHITECTURE, DATA_DICTIONARY,
  KPI_DICTIONARY, METHODOLOGY, DATA_GOVERNANCE, QA).
- Deployed to GitHub Pages.

## Known gaps (open business inputs)
- Akij procurement prices/volumes · cost components · formulations · time series · supplier records.

## [0.2.0] — 2026-09-04 — Gap completion
- Sample forecast (Naïve / MA(3) / Exponential Smoothing over 6 anchors + leave-one-out MAPE), labelled SAMPLE.
- Landed cost COMPLETE using actual NBR import (CIF) unit value + implied logistics premium.
- Savings ESTIMATE (landed − best origin × volume).
- Feed-cost impact ESTIMATE using Bangladesh CPI 8.32% (Jul 2026, Bangladesh Bank / Trading Economics).
- Scenario engine SIMULATION (index sensitivity to key-input shocks).
- Supplier intelligence from NBR exporter names (403 suppliers).
- Full country names (ISO-2 → name) across origins/suppliers.
- Market Signals view fed by the feed-intelligence MCP (10 signals, WoW movers, trajectory, predictions).
- Dynamic-color UI (teal/gold/blue/soft-red palette) + Supplier/Signals views.
- QA extended to 18 tests.

## [0.3.0] — 2026-09-04 — Executive visual theme redesign
- Centralized design-token system (`--theme-*`) + per-section color families via `[data-section]`.
- Section accents: Command=Sapphire, Material=Amber/Gold, Origin=Emerald, Supplier=Coral, Procurement=Teal, Signals=Maroon, Import=Ocean, Forecast=Indigo, Feed Cost=Sunflare, Alerts=Red, Governance=Slate.
- Premium dark navigation with dynamic active-section accent + left indicator.
- KPI/panel/table/filter/chip states follow the active section family; semantic status colors preserved.
- No functional or analytical changes.

## [0.4.0] — 2026-09-04 — Procurement decision intelligence (additive)
- Added `opportunity` analytics per material: price position vs 2025 average + 2x2 procurement-opportunity
  quadrant (Early Opportunity / Pressure / Monitor-Wait / Value Zone). DERIVED, never fabricated; null-safe.
- Added **Price Momentum Ranking** (Material Intelligence): diverging horizontal bar of WoW/MoM price change,
  top 15 by magnitude, filter-aware, with a WoW/MoM toggle.
- Added **Procurement Opportunity Matrix** (Procurement Intelligence): bubble scatter of price-vs-2025 × WoW
  momentum, quadrant-coloured, import-volume bubble sizing, zero-axis guide, analytical (not buy/sell) labels.
- Exposed position/quadrant in the material drill-down modal.
- QA extended to 21 tests (position + quadrant classification).
- No time-series analytics added (rolling volatility, SMA trend, Z-score, seasonality, correlation, itemised
  landed cost / FX) — the dataset is a snapshot + anchor points, not a price time series (see METHODOLOGY).

## [0.5.0] — 2026-09-04 — Price history + FX conversion (additive)
- Added **price history** ingest from the dated snapshot workbook (7 snapshots: 2026-06-17 → 2026-09-02),
  exact-name matched to the master (no forced renaming). 83 materials get a real snapshot series (41×2,
  30×3, 2×5, 10×7 points). Per-material DERIVED stats: change%, last-change%, return volatility (per-period,
  NOT annualised; only when ≥5 points).
- Added **FX conversion** of non-USD Fastmarkets quotes (EUR/BRL/UAH/MYR/IDR/CNY) → USD/MT using the
  documented "Live FX" rates from the raw source — 63 previously-null observations now converted, 0 remaining.
- Added **Core price trajectory line chart** (Market Signals): 8 core materials × 6 snapshots, indexed to 100.
- Added **per-material price-trend line chart** in the drill-down modal (snapshot history).
- QA extended to 25 tests (price-history stats + FX conversion).
- Still NOT implemented: rolling 30-obs volatility, SMA-30/90, Z-score(90), seasonality, correlation,
  itemised landed-cost/FX waterfall (see METHODOLOGY "NOT IMPLEMENTED").

## [0.6.0] — 2026-09-04 — Multi-year import trends (additive)
- Ingested multi-year Bangladesh customs import records (2014–2025) from the three Master_Import_Data CSV
  exports, deduplicated by Bill Of Entry No, filtered to feed raw-material HS codes (13 product groups).
- New **Import Trends** view (nav: Intelligence → Import Trends): per-material multi-year import trend
  (monthly volume bar + unit-value line), YoY (complete-year comparison), top origins, latest-12-month unit
  value, and a month × material **seasonality heatmap** (seasonal index, ≥24 months only).
- Unit value = USD invoice value ÷ quantity MT; the source "Price In MT" column is NOT trusted (outliers).
- QA extended to 30 tests (seasonality index + YoY).
