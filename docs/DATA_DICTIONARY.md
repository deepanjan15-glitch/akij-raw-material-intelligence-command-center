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

## Value semantics
- All prices are USD/MT unless `value`/`currency`/`unit` say otherwise on the observation.
- `valueUsdMt = null` when the raw quote is EUR/BRL/UAH/MYR/IDR (no FX applied — not fabricated).
- Unmapped observations/imports are **kept** with `materialId = null` for traceability.
