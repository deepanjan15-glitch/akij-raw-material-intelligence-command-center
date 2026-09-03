# METHODOLOGY

## Guiding principles
1. **No fabrication.** Missing → UNAVAILABLE; partial → PARTIAL with the missing component named; estimated → labelled.
2. **Independent validation.** Movement/risk/index are recomputed by the engine, never trusted from the reference
   spreadsheet (instruction 007).
3. **Observation vs interpretation vs hypothesis** are kept distinct in the UI.

## Unit conversion (documented, not assumed)
- `$/short ton → $/MT` × 1.10231131
- `¢/lb → $/MT` × 22.0462262
- `$/bushel → $/MT` × commodity bushel factor (corn 39.3683; wheat/soybean 36.7437)
- `¢/bu → $/MT` ÷ 100 × bushel factor
- EUR/BRL/UAH/MYR/IDR quotes → `valueUsdMt = null` (no FX applied).

## Market index
Equal-weight fallback (instruction 036) over the **consistent basket** of materials that have both a base
period price (avg2025) and a current price. Formula: `Σ(Pₜ)/Σ(P₀) × 100`.

## Risk engine (instruction 046, 047)
Composite = Σ(dimension × weight). Default weights (configurable): Price 20%, Momentum 15%, Forecast 15%,
Origin concentration 15%, Supplier concentration 10%, Import dependency 10%, Procurement premium 10%,
Data uncertainty 5%. Bands: 0–30 Low · 31–50 Moderate · 51–70 High · 71–100 Critical.
Dimensions with no data contribute 0 (not fabricated).

## Evidence confidence (instruction 019)
`0.35·sourceQuality + 0.25·freshness + 0.20·completeness + 0.10·crossSourceAgreement + 0.10·observationDepth`.
Source quality: Fastmarkets 90, NBR 75, Volza 55.

## Landed cost (instruction 031, 033)
Components = origin + freight + insurance + duty/tax + port/handling + finance/LC + other.
Missing components → status **PARTIAL** with `missingComponents[]`; never treated as zero.

## Known limitations (honest)
- No time series → forecasting, scenarios, feed-cost impact are UNAVAILABLE.
- No Akij procurement prices/volumes → savings UNAVAILABLE.
- "Cheapest origin" uses FOB/FAS benchmark (not like-for-like with CIF import value).
- Import unit value mixes product forms (e.g. solid vs liquid choline).
- Untracked Fastmarkets families (Palm Oil, Sunflower Oil, Distiller's Corn Oil) have data but no master material.
