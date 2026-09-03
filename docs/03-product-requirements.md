# PHASE 3 — Product Requirements

**Product name:** AKIJ AGRO FEED — RAW MATERIAL MARKET INTELLIGENCE & PROCUREMENT COMMAND CENTER

## 1. Objective
Move from a price-reporting dashboard to an **evidence-driven market-intelligence and
procurement-decision system**. Every number must be traceable to a source, every recommendation must
carry evidence + financial implication + confidence + next action, and every missing/estimated figure
must be explicitly labelled.

## 2. Users & role views
| Persona | Primary flow (instruction 070) |
|---|---|
| CEO / Senior Management | Situation → Risk → Opportunity → Action |
| Procurement | Benchmark → Supplier → Landed Cost → Negotiation |
| Market Research | Market → Statistics → Drivers → Forecast |
| Commercial | Feed Cost → Market Pressure → Scenario |

## 3. Modules (instruction 023)
1. **Command Center** — WHAT / HOW / WHY / SO WHAT / NOW WHAT.
2. **Market Intelligence** — market index, inflation, movement, drivers.
3. **Material Intelligence** — per-material statistics, volatility, percentile, trend.
4. **Origin & Supply** — origin concentration, arbitrage, dependency.
5. **Procurement Intelligence** — benchmark vs Akij vs supplier, landed cost, saving, fairness, negotiation.
6. **Forecast & Scenario** — validated forecast + what-if simulation (labelled SIMULATION).
7. **Feed Cost Impact** — formulation × inclusion-rate impact for Broiler/Layer/Fish/Cattle.
8. **Bangladesh Import Intelligence** — volume, value, unit value, YoY, origins, premium/discount.
9. **Alert Center** — Price/Procurement/Supply/Forecast/Data alerts.
10. **Data Quality & Governance** — DQ score, issues, lineage.
11. **Methodology** — definition/formula/data-requirement/interpretation/limitation for every KPI.
12. **Settings** — risk weights, bands, index base, alert thresholds, role default.

## 4. Core KPI set (Command Center — instruction 025)
Market Index · Market Inflation · Procurement Risk · Supply Risk · Potential Saving ·
Financial Exposure · Forecast Direction · Data Quality · Data Freshness.

## 5. Non-functional requirements
- Data honesty: no fabrication; label DEMO / ESTIMATE / SIMULATION / PARTIAL / UNAVAILABLE.
- Traceability: every metric exposes source, source type, observation date, loading date, material,
  specification, origin, Incoterm, currency, unit, transformation, quality status.
- Evidence confidence (not "AI confidence"): source quality, freshness, completeness, historical depth,
  cross-source agreement, model reliability.
- Configurable risk weights/bands; responsive UX; management PDF + structured Excel/CSV exports.
- Robustness: clear user-facing states on missing/malformed data; never silently fail.

## 6. Data inputs (honest inventory)
| Dataset | Status | Use |
|---|---|---|
| Fastmarkets price assessments (18 sheets) | Available (snapshot 2026-09-02) | Benchmark / origin prices |
| NBR customs import records (16 sheets) | Available (Jul–Sep 2026) | Landed import unit values |
| Procurement (Akij) actual prices | **Not yet provided** | Savings, fairness, negotiation |
| Freight / insurance / duty / LC cost components | **Not yet provided** | Landed cost (render PARTIAL) |
| Feed formulations (inclusion rates) | **Not yet provided** | Feed-cost impact (render UNAVAILABLE) |
| Historical time series (weekly/monthly) | Limited (snapshot + import window) | Forecasting (render LIMITED/backtest on available) |

> Per instruction 009/033: missing inputs are rendered explicitly as **PARTIAL / UNAVAILABLE**, never as zero.
