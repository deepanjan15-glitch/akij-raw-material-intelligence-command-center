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
