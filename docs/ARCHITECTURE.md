# ARCHITECTURE

Four clean layers, one-way dependencies (data ← analytics ← intelligence ← presentation). Full detail in
`04-technical-architecture.md`.

```
presentation/   app/            static vanilla JS + Chart.js (thin, deterministic)
intelligence/   engine/core     risk, evidence confidence, landed cost, savings, alerts
analytics/      engine/core     statistics, movement, index, DQ, origin stats
data/           engine/ingest   Fastmarkets + NBR -> normalized entities -> app/data/*.json
```

## Directory layout
```
engine/ingest/   fastmarkets.py, nbr.py, materials.py   (readers)
engine/core/     entities.py, mapping.py, analytics.py  (normalize + compute)
engine/run.py    orchestration -> writes app/data/*.json
tests/           pytest mathematical QA
app/             deployable presentation (index.html, css/, js/, data/)
docs/            reference study, gap analysis, requirements, architecture, dictionaries
```

## Data flow
1. `ingest_*` reads raw spreadsheets into dataclasses.
2. `map_*` links observations/imports to the 87-material master (unmapped items are preserved with
   `materialId=null`, never discarded).
3. `analytics.py` recomputes movement, origin stats, index, DQ, confidence, risk, landed cost, savings.
4. `run.py` writes `app/data/*.json` + a `meta.json` data-honesty manifest.

## Key decisions
- Python engine (not browser JS) for analytics → testable, auditable, versioned (instruction 076).
- Browser is a thin renderer reading precomputed JSON.
- Every unavailable/partial input is labelled, never zero-filled (instructions 009, 033, 036, 054).
