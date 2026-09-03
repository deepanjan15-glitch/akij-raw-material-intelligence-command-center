# PHASE 2 — Gap Analysis

**Input:** Phase 1 Reference Study (`docs/01-reference-study.md`)
**Method:** Each gap is scored on Business Impact, Analytical Risk, User Value, Implementation Feasibility,
then classified CRITICAL / HIGH / MEDIUM / LOW. Priority drives the Phase 4 target architecture and the
implementation order (instruction 078).

---

## 1. Prioritization dimensions

| Dimension | Meaning |
|---|---|
| Business impact | Effect on cost, savings, risk or speed of procurement decisions |
| Analytical risk | Likelihood of wrong or misleading numbers if left unaddressed |
| User value | Direct usefulness to CEO / Procurement / Research / Commercial |
| Feasibility | Effort + data dependency to implement |

Classification rule: CRITICAL = high impact AND high analytical risk; HIGH = high impact OR high risk;
MEDIUM = moderate; LOW = nice-to-have.

---

## 2. Gap register

| ID | Domain | Gap | Evidence (reference) | Impact | Priority |
|---|---|---|---|---|---|
| G-01 | Data | No normalized entities (Material, Specification, Country, Supplier, Source, Price Observation, Import, Procurement, Forecast) | Flat `products[]` array | Blocks every analytics layer | CRITICAL |
| G-02 | Data | No per-observation provenance (date, location, market, Incoterm, currency, unit, source) | Single `asOfDate`, single "source" field | Violates traceability (inst 030) | CRITICAL |
| G-03 | Pricing | Pricing bases (FOB/FAS/CFR/CIF) mixed into one "USD/MT" | `cheapestCountry1..3` + `price1..3` flattened | "Cheapest origin" not like-for-like | CRITICAL |
| G-04 | Pricing | No landed-cost model (origin + freight + insurance + duty + handling + LC + other) | Absent | Cannot compute real saving | CRITICAL |
| G-05 | Forecasting | "Next Week Forecast" is a weighted historical blend, not a validated forecast | `nextWkForecast` formula (0.35/0.2/0.15/0.1/0.1/0.1) | Misleading forward guidance | CRITICAL |
| G-06 | Analytics | Synthetic trend series presented as real "monthly trend" | `history.json` interpolation note | Misleading trend chart | CRITICAL |
| G-07 | Analytics | Fabricated "AI confidence" percentages | `ai_insights.json` shows confidence with no basis | Misleading; violates data honesty | CRITICAL |
| G-08 | Procurement | No landed-cost-based saving (Akij − best landed × quantity) | Absent | No dollar-denominated action | CRITICAL |
| G-09 | Procurement | No negotiation targets / fair-price range / max-acceptable price | Absent | Procurement cannot act | CRITICAL |
| G-10 | Risk | Single risk signal vs required 7-dimension risk engine (configurable weights/bands) | `riskSignal` only | Under/over-states risk | CRITICAL |
| G-11 | Data quality | No completeness/freshness/validity/consistency/source-coverage score | Absent | No trust measure | HIGH |
| G-12 | Statistics | No mean/median/σ/CV/percentile/z-score/4W-12W-26W-52W windows | Absent | Weak evidence basis | HIGH |
| G-13 | Statistics | No market-vs-data anomaly separation; fixed ±1% trend threshold | `trend` fixed threshold | False signals | HIGH |
| G-14 | Forecasting | No backtested models (Naïve/MA/ES/ARIMA) nor MAE/RMSE/MAPE/Bias | Absent | Cannot validate forecast | HIGH |
| G-15 | Scenario | No what-if engine (maize/SBM/oil/wheat/FX/freight) with SIMULATION labels | Absent | No forward planning | HIGH |
| G-16 | Feed cost | No formulation × inclusion-rate feed-cost impact (Broiler/Layer/Fish/Cattle) | Absent | Core business question unserved | HIGH |
| G-17 | Import | No volume/value/unit-value/YoY/origin-concentration/arbitrage intelligence | "Import Dependency" illustrative only | Missed arbitrage insight | HIGH |
| G-18 | Alerts | No configurable Price/Procurement/Supply/Forecast/Data alert center | Absent | Reactive, not proactive | HIGH |
| G-19 | Traceability | No lineage (transformation, loading date, quality status) on metrics | Absent | Cannot audit a number | HIGH |
| G-20 | Governance | No methodology/KPI dictionary; formulas hidden in spreadsheet | Absent | Unexplained numbers | HIGH |
| G-21 | Market index | No base-100 weighted Raw Material Market Index | Absent | No macro signal | MEDIUM |
| G-22 | Supplier | No supplier price/quality/reliability/lead-time/terms intelligence | Absent | Sourcing blind spot | MEDIUM |
| G-23 | Evidence | No Evidence Confidence model (source/freshness/completeness/agreement) | Absent | Confidence untrustworthy | MEDIUM |
| G-24 | Action tracking | No Generated→Assigned→Reviewed→Approved→Executed→Savings flow | Absent | No value realization | MEDIUM |
| G-25 | UX | No role-based views (CEO/Procurement/Research/Commercial) | Single generic view | Poor fit per persona | MEDIUM |
| G-26 | UX | No drill-down hierarchy (Market→Category→Material→Spec→Country→Supplier→Observation→Source) | Row modal only | Limited investigation | MEDIUM |
| G-27 | UX | No responsive mobile layout (Alerts/Risk/Savings/Movement/Recommendations) | Desktop-first only | Poor mobile UX | MEDIUM |
| G-28 | Reporting | No structured management PDF/Excel (exec/analytical/risk/reco/historical/DQ/methodology) | Simple PDF/CSV only | Weak exec reporting | MEDIUM |
| G-29 | Performance | Repeated computation & full re-render on every filter change | `renderCurrentView()` re-renders all | Scalability ceiling | MEDIUM |
| G-30 | Robustness | No explicit failure states for malformed data/empty sets (partial only) | Partial empty states | Fragile | LOW |
| G-31 | Testing | No test suite, no mathematical QA, no CI | Absent | Regression risk | LOW–HIGH* |

> \* G-31 (Testing) is LOW impact now but becomes HIGH risk as the system grows — schedule it into the
> Phase 5+ quality gates regardless.

---

## 3. Prioritized implementation sequence (feeds instruction 078)

1. **Data model + master data** (G-01, G-02, G-03) — foundational.
2. **Data quality engine** (G-11) — gate before analytics.
3. **Pricing + landed cost** (G-04, G-08, G-09) — core procurement value.
4. **Statistics + anomaly detection** (G-12, G-13) — evidence basis.
5. **Risk engine + exposure** (G-10) — configurable weights/bands.
6. **Forecasting + backtesting** (G-05, G-14, G-06) — replace synthetic/blended.
7. **Scenario + feed-cost** (G-15, G-16) — commercial value.
8. **Import + market index + alerts** (G-17, G-18, G-21) — intelligence layer.
9. **Evidence confidence + traceability + governance** (G-23, G-19, G-20).
10. **Supplier + action tracking** (G-22, G-24).
11. **Command Center + role views + drill-down + responsive** (G-25, G-26, G-27).
12. **Reporting + performance + robustness + testing** (G-28..G-31).

---

*End of Phase 2 — Gap Analysis. Next: Phase 3 (Product Requirements) + Phase 4 (Target Architecture).*
