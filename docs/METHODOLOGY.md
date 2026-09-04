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
- Foreign-currency quotes → USD/MT via documented FX rates (source: raw source "Live FX" sheet):
  EUR 1.17 · BRL 0.181 · UAH 0.024 · MYR 0.236 · IDR 0.000061 · CNY 0.139. Unit math: BRL/60kg ×(1000/60);
  IDR/kg ×1000. (63 non-USD observations converted; 0 remaining null.)

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

## Price position & procurement opportunity matrix (instruction 048+, additive)
- **Price position vs 2025** = `(current − avg2025) / avg2025` — fraction, NULL when current or base is
  missing. `avg2025` is the historical mean because it is the same documented base as the Raw Material
  Market Index. This is a **deviation from a historical mean**, NOT a Z-score (a Z-score over ~6 anchors
  would be statistically indefensible, so it is intentionally not computed).
- **Momentum** = recomputed `movement.wow` (week-on-week) or `movement.mom` (month-on-month) price change.
  The dataset has no 30/90-observation price series, so WoW/MoM is the honest "recent momentum" proxy and is
  labelled as such (never called "30-observation momentum").
- **Opportunity quadrant** (2x2, analytical labels — NOT buy/sell instructions):
  - low price + rising → **Potential Early Procurement Opportunity**
  - high price + rising → **Procurement Pressure**
  - high price + declining → **Monitor / Potential Waiting Zone**
  - low price + declining → **Potential Value Zone**
- Classification is sign-based and deterministic; unavailable when position or momentum is NULL.

## Price history (snapshot series) — additive
- Source: "Feed Raw Material Price Dashboard..xlsx", 7 dated snapshot sheets (2026-06-17 → 2026-09-02),
  irregular cadence (9–22 day gaps). Each sheet is matched to the master by **exact** (case-insensitive)
  product name; names are never force-renamed, so a material simply carries however many snapshots hold its
  exact name (avoids misaligning one material's series onto another).
- Coverage: 83 of 87 materials have ≥2 points (10 materials have the full 7-point series; 30 have 3; 41 have 2).
- Derived per material (labelled DERIVED): `changePct` = last vs first; `lastChangePct` = last vs previous;
  `returnVolPct` = std dev of log returns across snapshots — reported **per-period, NOT annualised** (irregular
  cadence makes annualisation misleading) and only when ≥5 points exist.

## Import trends (multi-year customs) — additive
- Source: three "Master_Import_Data" CSV exports (V1/V2/V3), deduplicated by **Bill Of Entry No** (they
  overlap ~25%). Records span 2014–2025. Filtered to feed raw-material HS codes → 13 product groups.
  Known caveat: V1/V2 exports appear truncated at 200,000 rows; the data is therefore a large sample, not a
  guaranteed census.
- **Unit value** = USD invoice value ÷ quantity MT, aggregated monthly (volume-weighted). The source
  "Price In MT" column is NOT trusted (contains unit-conversion outliers). Value is aggregated from USD rows
  only (~99% of rows); non-USD rows contribute volume but not value.
- **YoY** = latest vs prior **complete** (12-month) year only — the in-progress 2025 is excluded.
- **Seasonal index** = (calendar-month average) / (long-term monthly average) × 100, computed only when a
  group has ≥24 monthly observations. 100 = normal; >100 = historically above normal.

## Executive summary & sourcing gap — additive
- **Market Health Score** (0–100) = 0.35·(OPTIMAL signal share) + 0.30·(1 − High-Cost/Review share) +
  0.20·momentum + 0.15·(1 − single-origin share), where momentum = clamp(50 − avgWoW×250, 0, 100).
  Bands: ≥75 Excellent · ≥55 Healthy · ≥35 Caution · else Elevated Risk. DERIVED, not a forecast.
- **Sourcing gap** = Akij sourcing-country quoted price (matched against the master cheapest-origin rows) vs
  the #1 cheapest ("Best Buy") origin: `costGapUsdMt = akijQuotedPrice − bestBuyPrice`, `costGapPct = gap/bestBuy`.
- **Price trend (selected materials)** = linear interpolation of the tracked anchor points
  (avg2024 → avg2025 → sixMo → lastMonth → lastWeek → current) onto a monthly grid, shown over 12/6/3 months.
  Labelled **DERIVED interpolation** — NOT observed monthly prices.

## Known limitations (honest)
- Time series is 7 **irregular** snapshots over ~11 weeks (not a daily/weekly series) → forecasting, scenarios,
  feed-cost impact remain UNAVAILABLE; trend/volatility are coarse and low-confidence.
- No Akij procurement prices/volumes → savings UNAVAILABLE.
- "Cheapest origin" uses FOB/FAS benchmark (not like-for-like with CIF import value).
- Import unit value mixes product forms (e.g. solid vs liquid choline).
- Untracked Fastmarkets families (Palm Oil, Sunflower Oil, Distiller's Corn Oil) have data but no master material.

## NOT IMPLEMENTED — insufficient time-series data (do not fabricate)
The following analytics require a price **time series** with ≥ ~30 synchronised observations, or inputs that
are not provided. The current data is 7 irregular snapshots over ~11 weeks (plus an 8-anchor benchmark and a
Jul–Sep import window). Each item was considered and withheld rather than computed from too few observations:
- **Rolling volatility (30-obs log-return std dev)** — only ≤7 irregular points per material (a per-period
  std dev over ≤6 returns is exposed for the few 5–7-point materials, labelled DERIVED and NOT annualised).
- **Price trend with SMA(30)/SMA(90)** — no 30/90 observation series (a raw 7-point line is shown instead).
- **Historical Z-score (90-obs window)** — replaced by the defensible deviation-vs-2025 metric.
- **Seasonality heatmap** — no multi-year monthly history.
- **Correlation heatmap** — no synchronised time series across commodities (7 points, irregularly spaced).
- **Feed-cost contribution (waterfall)** — no formulation/inclusion rates.
- **Itemised landed-cost waterfall** — freight/insurance/duty/handling/LC not provided (origin FX conversion IS
  now applied, but the landed-cost model still uses the actual CIF import value with an implied logistics
  premium rather than itemised components).
