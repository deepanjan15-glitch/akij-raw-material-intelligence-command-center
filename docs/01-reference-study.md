# PHASE 1 — Reference Study

**Product:** AKIJ AGRO FEED — RAW MATERIAL MARKET INTELLIGENCE & PROCUREMENT COMMAND CENTER
**Document:** 01-reference-study.md
**Reference system studied:** https://deepanjan15-glitch.github.io/akij-agro-feed-raw-material-price-dashboard/
**Reference repository:** https://github.com/deepanjan15-glitch/akij-agro-feed-raw-material-price-dashboard
**Status:** READ-ONLY reference — no modification performed.

---

## 0. Purpose & scope

This study documents the reference dashboard's **information architecture, data architecture,
analytical architecture, visual system, UX, strengths, weaknesses, missing capabilities and
potentially incorrect methodologies**. It is the input to Phase 2 (Gap Analysis). Findings here are
**observations, not implementation requirements** (per instruction 017).

---

## 1. Executive summary

The reference is a **read-only, single-page, static web dashboard** (vanilla JS ES modules + Chart.js +
7 static JSON files served from GitHub Pages). It is a **price-reporting and simple risk-labelling
dashboard**, not an evidence-driven market-intelligence or procurement-decision system.

Strengths: polished visual design, clean module separation, a coherent filter model, a working
Fastmarkets/NBR source demarcation, and a genuinely useful "cheapest-origin vs Akij-origin" comparison.

Critical weaknesses: the data model is a **flat denormalized product table** (no entities for
observation, import, supplier, forecast); history/trend is **synthetic interpolation**; the "forecast"
is a **weighted blend of anchors, not a validated model**; "AI confidence" percentages are **fabricated**;
pricing bases (FOB/CIF/FAS/CFR) are **mixed without an Incoterm dimension**; and there is **no data-quality
score, no traceability, no landed-cost model, no feed-cost impact, and no statistical significance testing**.

The reference is a good **visual and structural benchmark**, but its analytical engine must be
**rebuilt from first principles** for the target system.

---

## 2. Information architecture

### 2.1 Application shell
- Single `index.html`, one main column + collapsible left sidebar.
- Top bar: page title, "last updated" live dot, global search, dark-mode toggle, Export PDF / Export Excel.
- Footer: attribution + data-as-of date + "Internal use only".

### 2.2 Navigation (9 views)
| View | Purpose |
|---|---|
| Dashboard | Executive brief, health score, KPIs, trend chart, risk donut, WoW bar, sourcing gap, AI cards, watchlist, signal cards, detail table |
| Price Analysis | Multi-material trend, volatility ranking, heatmap, current-vs-forecast, bar comparison |
| Country Analysis | Country rank, avg quoted price by country, origin treemap |
| Supplier Analysis | Supplier comparison chart, cost-gap table |
| Import Dependency | Monthly import trend, risk matrix, single-origin dependency grid |
| Market Signals | Full Go/Monitor/Risk signal card grid |
| Recommendations | Procurement recommendation table (priority-ranked) |
| AI Insights | Narrative "copilot" cards |
| Settings | Theme, currency, data source, analyst |

### 2.3 Shared components
- Filter panel (global): category, origin, risk, recommendation, **data source**, dependency, year,
  quarter, month, currency, price range.
- Detail table with sort/search/pagination + row detail modal.
- Executive brief (4 question cards: management / procurement / opportunity / risk).

---

## 3. Data architecture

### 3.1 Storage
7 static JSON files fetched at runtime (`data/*.json`):

| File | Shape |
|---|---|
| `products.json` | `{ asOfDate, materialsTracked, analyst, products: [...] }` |
| `history.json` | `{ months[12], note, series: { MAT-XXX: [12 numbers] } }` |
| `countries.json` | `{ countries: [{ country, productsSourced, rank1Count, totalAppearances, avgQuotedPrice, products[] }] }` |
| `suppliers.json` | `{ suppliers: [{ productId, akijSourcingCountry, akijQuotedPrice, bestBuyCountry, bestBuyPrice, costGapPct, riskSignal, procurementAction }] }` |
| `signals.json` | `{ signals: [{ productId, product, signal, label, color, icon, description }] }` |
| `recommendations.json` | `{ recommendations: [{ productId, product, action, priority, color, riskSignal, wowPct, forecastDeltaPct }] }` |
| `ai_insights.json` | `{ insights: [{ title, text }] }` |

### 3.2 The core entity is a **flat product row** (`products[].*`)
Each product carries ~30 fields including: `id, hsCode, product, unit, source, lastWeekPrice,
currentAvgPrice, lastMonthAvg, sixMoAvg, avg2024, avg2025, lastYearYtdAvg, ytdAvg2026, ytdPct, wowPct,
momPct, yoyPct, trend, nextWkForecast, forecastDeltaPct, cheapestCountry1..3, price1..3, bestBuyCountry,
akijSourcingCountry, riskSignal, procurementAction`.

### 3.3 Observations on the data model
- **No separate entities** for Material, Specification, Country, Supplier, Price Observation, Import,
  Procurement or Forecast (required by instruction 026).
- Derived metrics (`ytdPct`, `wowPct`, `momPct`, `yoyPct`, `trend`, `forecast`, `riskSignal`,
  `procurementAction`, `signals`, `recommendations`, `ai_insights`) are **pre-computed in the source
  spreadsheet and copied into JSON** — the dashboard does not re-derive them.
- **Source** is a single categorical field (`Fastmarkets` / `NBR Data` / `Volza`) with no per-observation
  provenance.
- **No date/observation-time dimension** on prices (only a single `asOfDate` for the whole snapshot).
- **No currency/unit/Incoterm dimension** per price — everything is pre-converted to "USD/MT".

---

## 4. Analytical architecture

### 4.1 KPIs (Dashboard view)
Computed client-side in `kpi.js` over the filtered set: Latest Price, Average Price, Highest Price,
Lowest Price, Monthly Change %, Price Volatility (σ of WoW%), Import Dependency %, Risk Level,
Top Recommendation.

### 4.2 Market health score
`computeMarketHealth()` in `insights.js` blends: optimal-share (35%), (1−risk-share) (30%), momentum
(20%), (1−single-origin-share) (15%) into a 0–100 score. **Weights are hard-coded, undocumented, and not
configurable.**

### 4.3 Trend / movement
- `trend` = ↑ / ↓ / → from a **fixed ±1% threshold** on `wowPct` (no statistical significance, no
  volatility context).
- `wowPct = (current − lastWeek) / lastWeek`, `momPct = (current − lastMonth) / lastMonth`,
  `yoyPct = (avg2025 − avg2024) / avg2024`, `ytdPct = (ytd2026 − lastYearYtd) / lastYearYtd`.

### 4.4 "Forecast" (`nextWkForecast`)
A **weighted blend of anchors**: `0.35·current + 0.20·lastMonth + 0.15·sixMo + 0.10·avg2025 +
0.10·lastYearYtd + 0.10·ytd2026`, normalized by the sum of available weights. **This is a
backward-looking weighted average, presented as "Next Week Forecast" — not a forecast model.**
`forecastDeltaPct = (forecast − current) / current`.

### 4.5 History / trend series (`history.json`)
`note` explicitly states: *"interpolated between tracked anchor points (2025 avg, 6-month avg,
last-month avg, current avg, last-week price) for visualization purposes."* Anchor positions:
`[0]=avg2025, [4]=sixMoAvg, [7]=lastMonthAvg, [9]=currentAvgPrice, [10]=[11]=lastWeekPrice`, with linear
interpolation between. **This is synthetic visualization data, not a real time series** — yet the chart is
labelled "Price Trend — Selected Materials / Monthly trend".

### 4.6 Risk signal (`riskSignal`)
Derived from a single formula comparing Akij's sourcing country to the three "cheapest" slots:
`OPTIMAL / ACCEPTABLE / MONITOR / HIGH_COST / REVIEW` (+ fallback `REVIEW` for missing). Signals map to
`GO/MONITOR/RISK` cards.

### 4.7 Procurement action
A nested IF over `riskSignal × trend`: `Strong Buy / Buy / Hold / Monitor / Review Supplier /
Diversify Source`.

### 4.8 Cheapest-origin / best-buy
`bestBuyCountry` = country with min of `price1/price2/price3`; `costGapPct = (akijQuoted − bestBuy) /
bestBuy`. **All three slots share one "USD/MT" field with no Incoterm/quality differentiation.**

### 4.9 Charts (Chart.js)
Multi-line trend, risk donut, WoW bar, sourcing-gap bar, volatility bar, forecast-vs-current, price bar,
country rank bar, country avg price bar, origin treemap, import-trend line, risk-matrix scatter,
heatmap table.

---

## 5. Visual system

- Font: Inter (UI) + JetBrains Mono (numeric).
- Palette: blue `#005BAC`, cyan `#00A3FF`, green `#16A34A`, amber `#F59E0B`, red `#DC2626`,
  violet `#7C3AED`, etc.
- Semantic colors used only partially: green = favorable, red = risk/rise, amber = watch, gray = unavailable.
  **Inconsistency:** "cell-change" styles positive price change as **red** and negative as **green**
  (a deliberate procurement convention), but this collides with the general "green = good" reading and is
  not labelled.
- Dark mode via CSS variables; skeleton loading screen; toasts; tooltips.

---

## 6. UX

- Global search + filter panel (multi-select + chips + clear-all) shared across views; **all views read
  the same filter state** (good — matches instruction 068).
- Sortable/searchable/paginated table + row-detail modal.
- 12M/6M/3M trend tabs; Export PDF / Export Excel / Export CSV.
- **No drill-down** beyond the row modal (no Market→Category→Material→Specification→Country→Supplier→
  Observation→Source hierarchy).
- **No role-based views**, no responsive mobile-optimized layout (single desktop-first layout).

---

## 7. Strengths (worth reusing conceptually)

1. Clean ES-module separation (`state / dataLoader / filters / kpi / charts / table / signals /
   insights / utils / theme`).
2. Single shared filter state propagated to every chart/table (filter integrity).
3. Fastmarkets vs NBR Data source demarcation (filter + badges + breakdown strip) — directly reusable.
4. Cheapest-origin vs Akij-origin comparison with cost-gap — a genuine procurement insight.
5. Polished, professional visual language and skeleton/empty/error states.
6. Static-JSON architecture is simple, versionable, and deployable to GitHub Pages.

---

## 8. Weaknesses & limitations

1. **Flat denormalized model** — no observation-level data; every metric is a pre-baked cell.
2. **Synthetic trend series** presented as real "monthly trend" without a DEMO/SIMULATION label.
3. **"Forecast" is not a forecast** — weighted anchor blend, no model, no backtest, no accuracy metric.
4. **Fabricated "AI confidence"** — the AI insight cards show confidence percentages with no evidence basis
   (violates instruction 019 / 009 spirit).
5. **Pricing bases mixed** (FOB/FAS/CFR/CIF all flattened to "USD/MT") — no Incoterm dimension; the
   "cheapest country" ranking compares unequal freight terms.
6. **No landed-cost model** (no freight/insurance/duty/handling/LC decomposition).
7. **No feed-cost impact** (no formulation/inclusion-rate link to Broiler/Layer/Fish/Cattle).
8. **No forecasting** with backtesting/MAE/RMSE/MAPE; no scenario engine.
9. **No statistical rigor** — fixed ±1% trend threshold, no z-score, percentile, significance, or
   anomaly-vs-data-error separation.
10. **No data-quality score** (completeness/freshness/validity/consistency/source coverage).
11. **No traceability** — no observation date, loading date, specification, Incoterm, currency, or
    transformation lineage on any metric.
12. **No alerting, no action tracking, no value-realization** tracking.
13. **No import-volume/value intelligence** (only price; the "Import Dependency" view is illustrative).
14. **No governance/methodology center**; formulas are hidden in the source spreadsheet.
15. **No configurable risk weights/bands**; weights hard-coded.
16. **No tests, no CI, no QA gates**; single analyst-maintained snapshot.

---

## 9. Missing capabilities (vs target — summary register)

| # | Capability | Status in reference |
|---|---|---|
| 1 | Command Center (What/How/Why/So-What/Now-What) | Partial (exec brief only) |
| 2 | Normalized entities (Material/Country/Supplier/Source/Observation/Import/Procurement/Forecast) | Absent |
| 3 | Layered architecture (data / analytics / intelligence / presentation) | Absent |
| 4 | Landed-cost & saving model | Absent |
| 5 | Market index (base-100, weighted) | Absent |
| 6 | Statistics (mean/median/σ/CV/percentile/z-score/4W-12W-26W-52W) | Absent |
| 7 | Anomaly detection (market vs data) | Absent |
| 8 | Price fairness score (0–100) | Absent |
| 9 | Supplier intelligence | Absent |
| 10 | Risk engine (7 risks, configurable weights, bands) | Partial (single risk signal) |
| 11 | Risk-weighted exposure | Absent |
| 12 | Evidence confidence | Absent (fabricated "AI confidence") |
| 13 | Forecast (Naïve/MA/ES/ARIMA + backtest + MAE/RMSE/MAPE) | Absent |
| 14 | Scenario engine (SIMULATION-labelled) | Absent |
| 15 | Feed-cost impact (formulation × inclusion rate) | Absent |
| 16 | Import intelligence (volume/value/YoY/origin/arbitrage) | Absent |
| 17 | Alert center (Magnitude × Abnormality × Exposure × Confidence) | Absent |
| 18 | "What changed" narrative | Partial (AI text) |
| 19 | Action tracking + value realization | Absent |
| 20 | Data quality score | Absent |
| 21 | Traceability / lineage | Absent |
| 22 | Methodology center | Absent |
| 23 | Role-based views (CEO/Procurement/Research/Commercial) | Absent |
| 24 | Responsive mobile UX | Absent |
| 25 | Governance documentation (ARCHITECTURE/DATA_DICTIONARY/KPI_DICTIONARY/METHODOLOGY/DATA_GOVERNANCE/QA) | Absent |

---

## 10. Potentially incorrect / unvalidated methodologies (data-honesty findings)

1. **Synthetic history presented as trend** — `history.json` interpolation is not real observations but
   is charted as "Monthly trend" (risk of misleading).
2. **"Next Week Forecast"** is a weighted historical blend, not a validated forecast — mislabelled.
3. **Fabricated confidence** — AI insight "confidence %" (e.g. "72% confidence") has no statistical basis.
4. **Mixed pricing bases** — FOB/CIF/CFR/FAS flattened to one "USD/MT" per product without Incoterm
   segregation; "cheapest country" ranking is therefore not like-for-like.
5. **WoW/MoM/YoY mixing of vintages** — "last week" vs "current" vs "last month" come from different
   sources/dates (Fastmarkets snapshot vs NBR import window), so WoW% can be misleading.
6. **Fixed ±1% trend threshold** — no volatility-aware or significance-based classification.
7. **Hard-coded, undocumented weights** — market-health score (35/30/20/15) and forecast blend
   (0.35/0.20/0.15/0.10/0.10/0.10) with no justification or configurability.
8. **Risk-signal collapse** — `ACCEPTABLE` and missing (`-`) are folded into simplified enum values;
   emoji→enum mapping loses nuance.
9. **No zero/negative-denominator guards** documented in the source spreadsheet for percentage formulas
   (partial; some `IFERROR` present but not all edge cases).
10. **First-render price-filter bug** — the default `priceMax=3500` clips high-price materials
    (e.g. L-Methionine, DL-Methionine) until a filter interaction corrects it (confirmed and fixed in the
    deployed copy, but indicates the original shipped a latent bug).
11. **Volatility metric** computed as σ of WoW% across materials (cross-sectional), not time-series
    volatility per material — semantically different from what the label implies.
12. **"Import Dependency" view is illustrative**, not computed from real import records.

---

## 11. Implications for the new system

| Reference concept | Reuse | Rebuild / new |
|---|---|---|
| Visual language, layout, module separation | Keep as benchmark | — |
| Single shared filter state | Keep | Extend (Incoterm, market, spec, data-quality) |
| Source demarcation (Fastmarkets/NBR) | Keep | Add per-observation provenance |
| Cheapest-origin vs Akij gap | Keep concept | Rebuild on landed-cost & like-for-like basis |
| Flat product JSON | — | Rebuild as normalized entities + layered engine |
| Synthetic trend / blended "forecast" | — | Replace with real observations + validated forecast |
| "AI confidence" | — | Replace with Evidence Confidence (source/freshness/completeness/agreement) |
| Single risk signal | — | Replace with 7-dimension risk engine (configurable weights/bands) |
| Static-only dashboard | — | Add Command Center, scenarios, alerts, methodology, exports, tests, docs |

---

*End of Phase 1 — Reference Study. Next: Phase 2 Gap Analysis (prioritized register).*
