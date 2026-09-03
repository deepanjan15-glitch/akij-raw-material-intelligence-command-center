#!/usr/bin/env python3
"""Orchestrate: ingest -> normalize -> analytics -> intelligence -> export JSON."""
import json, os
from datetime import datetime, timezone
from collections import defaultdict

from .ingest.materials import ingest_materials, ingest_benchmarks
from .ingest.fastmarkets import ingest_fastmarkets
from .ingest.nbr import ingest_nbr
from .core.entities import asdict
from .core.mapping import map_fastmarkets, map_nbr
from .core.analytics import (
    compute_movement, compute_origin_stats, compute_market_index,
    compute_data_quality, compute_confidence, compute_risk,
    compute_landed_cost, compute_savings, compute_import_intelligence,
)

APP_DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "data")
AS_OF = "2026-09-02"
ANALYST = "Dr. Deepanjan Bhattacharya"

def main():
    os.makedirs(APP_DATA, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()

    materials = ingest_materials()
    benchmarks = ingest_benchmarks()
    name_to_id = {m.name: m.id for m in materials}

    sources = [
        {"id": "fastmarkets", "name": "Fastmarkets", "type": "Fastmarkets", "quality": 90,
         "notes": "Exchange-assessed physical price assessments (snapshot 2026-09-02)."},
        {"id": "nbr", "name": "NBR Customs", "type": "NBR Data", "quality": 75,
         "notes": "Bangladesh customs import records (Jul-Sep 2026 window)."},
        {"id": "volza", "name": "Volza", "type": "Volza", "quality": 55,
         "notes": "Third-party trade record (single material)."},
    ]

    obs = ingest_fastmarkets(now)
    imps = ingest_nbr(now)

    # map observations/imports to materials
    obs_by_mat = defaultdict(list)
    imp_by_mat = defaultdict(list)
    unmapped_obs = 0
    unmapped_imp = 0
    for o in obs:
        mat_name = map_fastmarkets(o, {})
        o.materialId = name_to_id.get(mat_name) if mat_name else None
        o._family = None
        if o.materialId:
            obs_by_mat[o.materialId].append(o)
        else:
            unmapped_obs += 1
    for im in imps:
        mat_name = map_nbr(im, {})
        im.materialId = name_to_id.get(mat_name) if mat_name else None
        if im.materialId:
            imp_by_mat[im.materialId].append(im)
        else:
            unmapped_imp += 1

    # import intelligence
    import_intel = compute_import_intelligence(imp_by_mat)

    # per-material analytics + intelligence
    result_materials = []
    for m in materials:
        b = benchmarks.get(m.name, {})
        mov = compute_movement(b)
        obs_list = obs_by_mat.get(m.id, [])
        imp_list = imp_by_mat.get(m.id, [])
        # origin-level observations (current USD/MT, dedup by country keeping min)
        origin_vals = defaultdict(list)
        for o in obs_list:
            if o.valueUsdMt is not None and o.countryName:
                origin_vals[o.countryName].append(o.valueUsdMt)
        origin_countries = list(origin_vals.keys())
        origin_values = [min(v) for v in origin_vals.values()]
        origin = compute_origin_stats(origin_values, origin_countries)
        latest_obs = max((o.observationDate for o in obs_list if o.observationDate), default=None)

        dq = compute_data_quality(m.name, b, len(obs_list), len(imp_list), latest_obs)
        cross_source = len(obs_list) > 0 and len(imp_list) > 0
        conf = compute_confidence((m.sources or ["Other"])[0], dq, len(obs_list), len(imp_list), cross_source)
        import_dep = import_intel.get(m.id)
        premium = None
        akij = b.get("akijSourcingCountry")
        if akij and origin_vals.get(akij):
            best = origin_values[0] if origin_values else None
            if best:
                premium = (min(origin_vals[akij]) - best) / best if best else None
        risk = compute_risk(mov, origin, import_dep, conf, premium)
        landed = compute_landed_cost(b, import_dep["unitValueUsdMt"] if import_dep else None, origin_values)
        savings = compute_savings(b, landed)

        result_materials.append({
            "id": m.id,
            "name": m.name,
            "category": m.category,
            "hsCode": m.hsCode,
            "unit": m.unit,
            "source": (m.sources or ["Other"])[0],
            "benchmark": {
                "lastWeek": b.get("lastWeek"), "current": b.get("current"),
                "lastMonth": b.get("lastMonth"), "sixMo": b.get("sixMo"),
                "avg2024": b.get("avg2024"), "avg2025": b.get("avg2025"),
                "lastYearYtd": b.get("lastYearYtd"), "ytd2026": b.get("ytd2026"),
            },
            "movement": {k: (round(v, 4) if v is not None else None) for k, v in mov.items()},
            "originStats": origin,
            "dataQuality": dq,
            "evidenceConfidence": conf,
            "risk": risk,
            "landedCost": landed,
            "savings": savings,
            "importIntelligence": import_dep,
            "procurement": {
                "akijSourcingCountry": b.get("akijSourcingCountry"),
                "procurementAction": b.get("procurementAction"),
                "premiumVsBest": round(premium, 4) if premium is not None else None,
            },
        })

    market_index = compute_market_index(materials, benchmarks)

    def dump(name, obj):
        with open(os.path.join(APP_DATA, name), "w") as f:
            json.dump(obj, f, ensure_ascii=False, indent=1)

    dump("materials.json", {"asOfDate": AS_OF, "generatedAt": now, "analyst": ANALYST,
                            "materialsTracked": len(result_materials), "materials": result_materials})
    dump("market-index.json", market_index)
    dump("sources.json", {"sources": sources})
    dump("observations.json", {"count": len(obs), "observations": [asdict(o) for o in obs]})
    dump("imports.json", {"count": len(imps), "imports": [asdict(im) for im in imps]})
    dump("meta.json", {
        "asOfDate": AS_OF, "generatedAt": now, "analyst": ANALYST,
        "dataHonesty": {
            "unmappedObservations": unmapped_obs,
            "unmappedImports": unmapped_imp,
            "notes": [
                "Forecasting is UNAVAILABLE (no time series; only a snapshot + 6-week import window).",
                "Landed cost is PARTIAL — freight, insurance, duty, handling and finance are not provided.",
                "Savings is UNAVAILABLE — Akij procurement prices and volumes not provided.",
                "Feed-cost impact and scenarios are UNAVAILABLE — formulation data not provided.",
                "Market index uses an equal-weight fallback (no valid volume/spend weights provided).",
                "Supplier intelligence is UNAVAILABLE — no supplier records provided.",
                "Untracked families with data but no master material: Palm Oil, Sunflower Oil, Distiller's Corn Oil (observations kept, materialId null).",
                "Unmapped NBR imports are mostly pharma raw materials and pet/aquarium food — correctly excluded from feed-material mapping.",
            ],
        },
    })

    print(f"materials: {len(result_materials)}")
    print(f"observations: {len(obs)} (unmapped {unmapped_obs})")
    print(f"imports: {len(imps)} (unmapped {unmapped_imp})")
    print(f"market index: {market_index.get('index')} ({market_index.get('method','')[:40]}...)")
    print(f"written to {APP_DATA}")


if __name__ == "__main__":
    main()
