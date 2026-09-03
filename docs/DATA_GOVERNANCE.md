# DATA GOVERNANCE

## Data honesty rules (enforced by the engine)
- Never convert missing → zero, estimated → actual, benchmark → procurement, forecast → actual.
- Never mix FOB/FAS/CFR/CIF without preserving the pricing basis (each observation retains its incoterm).
- Every price retains Material + Specification + Date + Location + Market + Incoterm + Currency + Unit + Source.

## Traceability
- Each observation/import has an `id` and `loadedAt`, plus `sourceId`/`countryCode`/`incoterm`/`unit`.
- Unmapped records are preserved (`materialId = null`), never dropped.
- `meta.json` records the unmapped counts and the full honesty-note list.

## Source ownership
| Source | Provenance | Quality |
|---|---|---|
| Fastmarkets | Exchange-assessed physical price sheets (snapshot 2026-09-02) | 90 |
| NBR | Bangladesh customs import records (Jul–Sep 2026) | 75 |
| Volza | Third-party trade record (single material) | 55 |

## Change control
- Master material list = the 87-product Input_Sheet (owner: procurement/market-research).
- Adding a material, changing a risk weight/band, or enabling a forecast model is a configuration change with a
  CHANGELOG entry and a QA re-run.

## Known data gaps (open items for the business)
1. Akij procurement prices + volumes (enables savings & negotiation).
2. Freight / insurance / duty / handling / LC cost components (completes landed cost).
3. Feed formulations + inclusion rates (enables feed-cost impact & scenarios).
4. Historical time series (enables forecasting).
5. Supplier performance records (enables supplier intelligence).
6. Missing master materials: Palm Oil, Sunflower Oil, Distiller's Corn Oil.
