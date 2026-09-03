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
