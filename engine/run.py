#!/usr/bin/env python3
"""Orchestrate: ingest -> normalize -> analytics -> intelligence -> export JSON."""
import json, os
from datetime import datetime, timezone
from collections import defaultdict

from .ingest.materials import ingest_materials, ingest_benchmarks
from .ingest.fastmarkets import ingest_fastmarkets
from .ingest.nbr import ingest_nbr, ingest_suppliers
from .ingest.history import ingest_price_history
from .ingest.imports_csv import ingest_import_trends
from .core.entities import asdict, country_full
from .core.mapping import map_fastmarkets, map_nbr
from .core.analytics import (
    compute_movement, compute_origin_stats, compute_market_index,
    compute_data_quality, compute_confidence, compute_risk,
    compute_landed_cost, compute_savings, compute_import_intelligence,
    compute_forecast, compute_feed_cost, compute_scenario, compute_opportunity,
    compute_price_history, compute_seasonality_index, compute_yoy,
    compute_sourcing_gap, normalize_country, clean_signal,
)

APP_DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "data")
AS_OF = "2026-09-02"
ANALYST = "Dr. Deepanjan Bhattacharya"
BD_INFLATION_PCT = 8.32   # Bangladesh CPI, July 2026 (Bangladesh Bank / Trading Economics)


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
        {"id": "cme", "name": "CME Group", "type": "CME Group", "quality": 85,
         "notes": "Futures benchmark (CBOT soybean meal / soybean oil / wheat) for forward reference."},
        {"id": "te", "name": "Trading Economics", "type": "Trading Economics", "quality": 80,
         "notes": "Macro-economic indicators (Bangladesh CPI inflation 8.32%, Jul 2026; FX)."},
        {"id": "volza", "name": "Volza", "type": "Volza", "quality": 55,
         "notes": "Third-party trade record (single material)."},
    ]

    obs = ingest_fastmarkets(now)
    imps = ingest_nbr(now)
    history = ingest_price_history()

    # map observations/imports to materials
    obs_by_mat = defaultdict(list)
    imp_by_mat = defaultdict(list)
    unmapped_obs = 0
    unmapped_imp = 0
    for o in obs:
        mat_name = map_fastmarkets(o, {})
        o.materialId = name_to_id.get(mat_name) if mat_name else None
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

    import_intel = compute_import_intelligence(imp_by_mat)
    suppliers = ingest_suppliers([im for im in imps if im.materialId], now)

    result_materials = []
    for m in materials:
        b = benchmarks.get(m.name, {})
        mov = compute_movement(b)
        obs_list = obs_by_mat.get(m.id, [])
        imp_list = imp_by_mat.get(m.id, [])
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
        if akij and origin_vals.get(akij) and origin_values:
            best = origin_values[0]
            if best:
                premium = (min(origin_vals[akij]) - best) / best
        risk = compute_risk(mov, origin, import_dep, conf, premium)

        import_uv = import_dep["unitValueUsdMt"] if import_dep else None
        import_vol = import_dep["volumeMt"] if import_dep else None
        landed = compute_landed_cost(b, import_uv, origin_values)
        savings = compute_savings(b, import_uv, import_vol, origin_values)
        forecast = compute_forecast(b)

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
            "opportunity": compute_opportunity(b, mov),
            "priceHistory": compute_price_history(history.get(m.name.strip().upper())),
            "sourcingGap": compute_sourcing_gap(b),
            "originStats": origin,
            "dataQuality": dq,
            "evidenceConfidence": conf,
            "risk": risk,
            "landedCost": landed,
            "savings": savings,
            "forecast": forecast,
            "importIntelligence": import_dep,
            "procurement": {
                "akijSourcingCountry": b.get("akijSourcingCountry"),
                "procurementAction": b.get("procurementAction"),
                "riskSignal": clean_signal(b.get("riskSignal")),
                "premiumVsBest": round(premium, 4) if premium is not None else None,
            },
        })

    market_index = compute_market_index(materials, benchmarks)
    feed_cost = compute_feed_cost(market_index, BD_INFLATION_PCT)
    scenario = compute_scenario(market_index, BD_INFLATION_PCT)

    import_trends = ingest_import_trends()
    for g in import_trends:
        g["seasonality"] = compute_seasonality_index(g["months"])
        g["yoy"] = compute_yoy(g["months"])

    # origin summary (Best/Worst Origin for the executive summary)
    country_prices = defaultdict(list)
    country_rank1 = defaultdict(int)
    for m in materials:
        bb = normalize_country(benchmarks.get(m.name, {}).get("bestBuyCountry"))
        if bb:
            country_rank1[bb] += 1
    for o in obs:
        if o.valueUsdMt is not None and o.countryName:
            country_prices[normalize_country(o.countryName)].append(o.valueUsdMt)
    origins_summary = []
    for c, prices in country_prices.items():
        avg = sum(prices) / len(prices) if prices else None
        origins_summary.append({
            "country": c,
            "avgQuotedPrice": round(avg, 2) if avg else None,
            "quotes": len(prices),
            "rank1Count": country_rank1.get(c, 0),
        })
    origins_summary.sort(key=lambda c: -(c["rank1Count"] or 0))

    # supplier intelligence (top by volume + by country)
    supplier_by_country = defaultdict(lambda: {"volumeMt": 0.0, "valueUsd": 0.0, "suppliers": 0})
    for s in suppliers:
        supplier_by_country[s.countryName or s.countryCode]["volumeMt"] += s.volumeMt
        supplier_by_country[s.countryName or s.countryCode]["valueUsd"] += s.valueUsd
        supplier_by_country[s.countryName or s.countryCode]["suppliers"] += 1

    def dump(name, obj):
        with open(os.path.join(APP_DATA, name), "w") as f:
            json.dump(obj, f, ensure_ascii=False, indent=1)

    dump("materials.json", {"asOfDate": AS_OF, "generatedAt": now, "analyst": ANALYST,
                            "materialsTracked": len(result_materials), "materials": result_materials})
    dump("market-index.json", market_index)
    dump("feed-cost.json", feed_cost)
    dump("scenario.json", scenario)
    dump("suppliers.json", {"suppliers": [asdict(s) for s in suppliers],
                            "byCountry": [{"country": c, **v} for c, v in
                                          sorted(supplier_by_country.items(), key=lambda kv: kv[1]["volumeMt"], reverse=True)]})
    dump("sources.json", {"sources": sources})
    dump("origins.json", {"asOfDate": AS_OF, "countries": origins_summary})
    dump("observations.json", {"count": len(obs), "observations": [asdict(o) for o in obs]})
    dump("imports.json", {"count": len(imps), "imports": [asdict(im) for im in imps]})
    dump("import-trends.json", {
        "asOfDate": AS_OF, "generatedAt": now,
        "note": "Multi-year Bangladesh customs import records (2014-2025) deduplicated by Bill Of Entry No across three export files; unit value = USD invoice value / quantity MT (source 'Price In MT' column not trusted). Value aggregated from USD rows only.",
        "groups": import_trends,
    })
    dump("meta.json", {
        "asOfDate": AS_OF, "generatedAt": now, "analyst": ANALYST,
        "inflation": {"bangladeshCpiPct": BD_INFLATION_PCT, "period": "July 2026",
                      "source": "Bangladesh Bank / Trading Economics"},
        "dataHonesty": {
            "unmappedObservations": unmapped_obs,
            "unmappedImports": unmapped_imp,
            "notes": [
                "Forecast is SAMPLE (coarse 6-anchor series, no full time series) — low confidence.",
                "Landed cost uses actual NBR import (CIF) unit value where available; otherwise PARTIAL.",
                "Savings is an import-vs-best-origin ESTIMATE (Akij procurement prices not provided).",
                "Feed-cost impact is a portfolio ESTIMATE using Bangladesh CPI (8.32%, Jul 2026) — no formulation data.",
                "Scenario engine is SIMULATION — NOT ACTUAL (indicative category weights).",
                "Supplier intelligence derived from NBR exporter names (col 63) — price/quality/reliability beyond unit value are not assessed.",
                "Untracked families with data but no master material: Palm Oil, Sunflower Oil, Distiller's Corn Oil.",
                "Unmapped NBR imports are mostly pharma raw materials and pet/aquarium food.",
            ],
        },
    })

    print(f"materials: {len(result_materials)} | suppliers: {len(suppliers)}")
    print(f"observations: {len(obs)} (unmapped {unmapped_obs}) | imports: {len(imps)} (unmapped {unmapped_imp})")
    print(f"market index: {market_index.get('index')} | feed-cost pressure: {feed_cost.get('totalFeedCostPressurePct')}%")
    print(f"written to {APP_DATA}")


if __name__ == "__main__":
    main()
