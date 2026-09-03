# FINAL REPORT (instruction 083)

## 1. Reference Study Findings (Phase 1)
The reference dashboard is a **price-reporting dashboard**, not an intelligence/decision system. Its data model
is a flat denormalized product table; its "trend" is synthetic interpolation; its "forecast" is a weighted
historical blend; its "AI confidence" is unsupported; pricing bases are mixed. It has a strong visual system and
a working Fastmarkets/NBR demarcation worth reusing conceptually. (Full: docs/01-reference-study.md)

## 2. Major Gaps (Phase 2)
31 gaps → 10 CRITICAL (no normalized entities, no provenance, mixed pricing bases, no landed cost, no real
forecast, synthetic trend, fabricated confidence, no saving model, no negotiation targets, no multi-dimension
risk). (Full: docs/02-gap-analysis.md)

## 3. New Architecture
Four layers (data / analytics / intelligence / presentation) with a Python testable engine and a thin static
frontend. Normalized entities: Material, Source, Country, PriceObservation, Import, Procurement, Forecast.

## 4. Analytical Improvements
- Movement (WoW/MoM/YoY/YTD) **recomputed** (not trusted from the spreadsheet).
- Origin statistics (spread/CV) computed from real observations.
- Market index with a consistent equal-weight basket (labelled fallback).
- Data quality score (completeness/freshness/coverage/validity) + issues.
- **Evidence confidence** replacing "AI confidence".

## 5. Procurement Improvements
- Benchmark vs import unit value vs premium-vs-best-origin.
- Landed cost model (PARTIAL — missing freight/insurance/duty/handling/finance).
- Savings model scaffold (UNAVAILABLE — Akij prices not provided).

## 6. Statistical Improvements
- Mean/std/CV/percentile-ready origin statistics; guarded percentage formulas; risk bands; configurable weights.
- Forecasting/scenario/feed-cost are honestly disabled (no time series / formulations).

## 7. Data Governance
- No fabrication; PARTIAL/UNAVAILABLE labels; observation provenance; unmapped records preserved; meta honesty manifest.

## 8. QA Results
13/13 pytest tests pass; browser load verified with 0 console errors.

## 9. Known Limitations
Forecast, scenario, feed-cost, savings, supplier intelligence are UNAVAILABLE (missing business inputs).
Untracked families (Palm Oil, Sunflower Oil, Distiller's Corn Oil) have data but no master material.

## 10. Deployment
Live at the GitHub Pages URL for this repository (see README / repo settings).
