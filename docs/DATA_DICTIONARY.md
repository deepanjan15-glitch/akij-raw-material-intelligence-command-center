# DATA DICTIONARY

## Entities (normalized, instruction 026)

| Entity | Key fields | Source |
|---|---|---|
| Material | id, name, category, hsCode, unit, sources[] | Input_Sheet (87 products) |
| Source | id, name, type, quality, notes | Fastmarkets / NBR / Volza |
| PriceObservation | id, materialId, sourceId, countryCode, incoterm, currency, unit, value, valueUsdMt, market, specification, observationDate | Fastmarkets sheets |
| Import | id, materialId, hsCode, countryCode, description, period, volumeMt, valueUsd, unitValueUsdMt | NBR sheets |
| Procurement | (schema defined; **no data provided** → UNAVAILABLE) | — |

## `app/data/materials.json` (per material)
```
benchmark  { lastWeek, current, lastMonth, sixMo, avg2024, avg2025, lastYearYtd, ytd2026 }
movement   { wow, mom, yoy, ytd }           # recomputed by engine (not trusted)
opportunity{ status, positionVs2025, momentumWow, quadrant }   # DERIVED; quadrant is an analytical label
priceHistory{ points, start, end, dates[], values[], changePct, lastChangePct, returnVolPct, frequency }
                                           # DERIVED from 7 dated snapshots (exact-name match)
originStats{ count, min, max, mean, std, cv, spreadPct, countries[] }
dataQuality{ score, completeness, freshness, sourceCoverage, issues[] }
evidenceConfidence{ score, level, basis{} }
risk       { composite, band, dimensions{price,momentum,forecast,originConcentration,
             supplierConcentration,importDependency,procurementPremium,dataUncertainty} }
landedCost { status, components{}, missingComponents[], importUnitValueUsdMt, note }
savings    { status, reason }               # UNAVAILABLE (no Akij prices)
importIntelligence { volumeMt, valueUsd, unitValueUsdMt, originCount, origins[], topOrigin, concentrationPct }
procurement { akijSourcingCountry, procurementAction, premiumVsBest }
```

## `app/data/meta.json`
`dataHonesty.notes[]` — the explicit list of UNAVAILABLE / PARTIAL inputs and unmapped-record counts.

## `app/data/import-trends.json`
```
groups[] { hs, name, months[]{ym, volumeMt, valueUsd, unitValueUsdMt},
           totalVolumeMt, totalValueUsd, avgUnitValueUsdMt, records,
           origins[]{origin, volumeMt, sharePct},
           seasonality{month:int->index}, yoy{latestYear,priorYear,volumeYoYPct,valueYoYPct} }
```
Multi-year (2014–2025) customs import records deduplicated by Bill Of Entry No; unit value =
USD invoice value ÷ quantity MT (source "Price In MT" column not trusted). See METHODOLOGY.

## Value semantics
- All prices are USD/MT unless `value`/`currency`/`unit` say otherwise on the observation.
- Non-USD quotes (EUR/BRL/UAH/MYR/IDR/CNY) are converted to `valueUsdMt` via the documented "Live FX" rates
  (see METHODOLOGY); `valueUsdMt = null` only when no documented rate/unit exists (not fabricated).
- Unmapped observations/imports are **kept** with `materialId = null` for traceability.
