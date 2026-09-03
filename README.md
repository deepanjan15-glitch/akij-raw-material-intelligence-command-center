# AKIJ AGRO FEED — Raw Material Market Intelligence & Procurement Command Center

Independent, evidence-driven raw-material market-intelligence and procurement-decision system.

The previous dashboard (https://deepanjan15-glitch.github.io/akij-agro-feed-raw-material-price-dashboard/)
is **read-only reference material** — never modified.

## Status
v0.1.0 — first independent build complete (reference study → gap analysis → architecture → engine → frontend → QA → deploy).

## Run locally
```bash
# (1) rebuild data + analytics (optional — data is already committed under app/data/)
python3 -m engine.run
# (2) serve the presentation
cd app && python3 -m http.server 8080
# open http://localhost:8080
```

## Test
```bash
python3 -m pytest tests/ -q
```

## Architecture
`engine/` (Python: ingest → normalize → analytics → intelligence) → `app/data/*.json` → `app/` (static frontend).
See `docs/ARCHITECTURE.md`.

## Documentation
- `docs/01-reference-study.md` · `02-gap-analysis.md` · `03-product-requirements.md` · `04-technical-architecture.md`
- `docs/ARCHITECTURE.md` · `DATA_DICTIONARY.md` · `KPI_DICTIONARY.md` · `METHODOLOGY.md` · `DATA_GOVERNANCE.md` · `QA.md` · `CHANGELOG.md` · `08-final-report.md`

## Data honesty
Forecasting, scenarios, feed-cost and savings are **UNAVAILABLE** (missing inputs) and rendered explicitly —
never fabricated. Landed cost is **PARTIAL** (freight/insurance/duty/handling/finance not provided).
See `app/data/meta.json` for the full honesty manifest.

## Open business inputs (to unlock disabled capabilities)
Akij procurement prices/volumes · cost components · feed formulations · historical time series · supplier records.
