# KPI DICTIONARY

| KPI | Formula | Data requirement | Interpretation | Limitation |
|---|---|---|---|---|
| WoW % | (current − lastWeek)/lastWeek | lastWeek + current | week-on-week move | lastWeek/current are different source vintages (snapshot vs import window) |
| MoM % | (current − lastMonth)/lastMonth | lastMonth + current | month-on-month move | same vintage caveat |
| YoY % | (avg2025 − avg2024)/avg2024 | both annual averages | year-on-year | annual averages hide intra-year shape |
| YTD % | (ytd2026 − lastYearYtd)/lastYearYtd | both YTD | year-to-date drift | YTD windows differ in length |
| Origin spread % | (max−min)/min of origin prices | ≥2 origin observations | origin cost dispersion | cross-sectional, NOT time volatility |
| Origin CV | std/mean of origin prices | ≥2 origins | relative origin dispersion | as above |
| Market Index | Σ(Pₜ·w)/Σ(P₀·w)×100 | base + current prices | portfolio price level vs base | equal-weight fallback (no spend weights) |
| Data Quality | 0.4·completeness + 0.25·freshness + 0.15·coverage + 0.2·validity | per-material fields | trust measure | weights are starting defaults |
| Evidence Confidence | 0.35·sourceQuality + 0.25·freshness + 0.20·completeness + 0.10·crossSource + 0.10·depth | source + DQ | how much to trust a number | replaces "AI confidence" |
| Risk composite | Σ(dimension·weight) | movement, origin, import, confidence | multi-factor risk 0–100 | weights configurable (see Settings) |
| Risk band | 0–30 Low · 31–50 Moderate · 51–70 High · 71–100 Critical | composite | decision threshold | bands configurable |
| Landed cost | origin+freight+insurance+duty+handling+finance+other | all components | true cost | PARTIAL — freight/insurance/duty/handling/finance missing |
| Potential saving | (Akij − best landed)×qty | Akij price + landed + volume | dollar opportunity | UNAVAILABLE — Akij prices not provided |
| Financial exposure | Σ import value USD | NBR records | import value at risk | only tracked import lines |
| Import arbitrage % | (import unit value − benchmark)/benchmark | import + benchmark | landed vs world price | mixes CIF import vs FOB benchmark |
| Price position vs 2025 | (current − avg2025)/avg2025 | current + avg2025 | cheap/expensive vs historical mean | deviation, NOT a Z-score (too few anchors) |
| Opportunity quadrant | 2x2 sign classification of (position, WoW momentum) | current + avg2025 + lastWeek | procurement prioritisation | analytical label, not a buy/sell instruction |
| Price history change % | (last − first)/first over snapshot series | ≥2 snapshots (exact-name) | longer-run price move | 7 irregular snapshots (9–22 day gaps), coarse |
| Price history return vol | std dev of log returns across snapshots | ≥5 snapshots | price uncertainty | per-period, NOT annualised; n≤6 returns |

**Forecast:** enabled only with sufficient history + backtesting (Naïve/MA/ES/ARIMA; MAE/RMSE/MAPE/Bias).
Currently **UNAVAILABLE** — the engine has a snapshot + 6-week import window, no monthly/weekly time series.
