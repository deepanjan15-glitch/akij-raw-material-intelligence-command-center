"""Map raw observations/imports onto the 87-material master list."""
from __future__ import annotations
from .entities import PriceObservation, Import, Material

# Fastmarkets family -> master material name (non-wheat, non-oilseeds special cases)
FAMILY_MATERIAL = {
    "Corn Gluten Feed": "CORN GLUTEN FEED",
    "Corn Gluten Meal": "CORN GLUTEN MEAL",
    "Corn DDGS": "DDGS",
    "Barley": "BERLEY",
    "Cotton Seed": "COTTON SEED OIL",
    "Sunflower Meal": "SUNFLOWER MEAL",
    "Fish Oil": "Fish Oil",
    "Rapeseed Meal": "RAPESEED Meal (RSM)",
    "Rapeseed Oil": "RAPESEED OIL FOB Refined",
}

# Fastmarkets families with no tracked material in the master (honest gap)
UNTRACKED_FAMILIES = {"Palm Oil", "Sunflower Oil", "Distiller's Corn Oil"}

_CORN_INCO = {"FOB": "CORN FOB", "CIF": "CORN CIF", "FAS": "CORN FAS", "CPT": "CORN CPT",
              "BASIS": "CORN BASIS"}


def map_fastmarkets(obs: PriceObservation, materials: dict[str, Material]) -> str | None:
    fam = getattr(obs, "_family", None)
    if fam in UNTRACKED_FAMILIES:
        return None
    if fam in FAMILY_MATERIAL:
        return FAMILY_MATERIAL[fam]
    name = obs.specification or ""
    inc = (obs.incoterm or "").upper()

    if fam == "Corn/Maize":
        if "DDGS" in name.upper():
            return "DDGS" if "FOB" in name.upper() else "Corn DDG CIF"
        return _CORN_INCO.get(inc, "MAIZE/CORN")

    if fam == "Soymeal":
        hipro = "HI-PRO" in name.upper() or "HIPRO" in name.upper()
        smp = "SMP" in name.upper()
        if inc == "FOB":
            return "SOYMEAL FOB Hi-Pro" if hipro else ("SOYMEAL FOB SMP" if smp else "SOYMEAL FOB")
        if smp:
            return "SOYMEAL CIF SMP"
        if hipro:
            return "SOYMEAL CIF Hi-Pro"
        return "SOYMEAL CIF"

    if fam == "Soybean":
        if inc == "CFR":
            return "Soybean CFR"
        if inc == "CIF":
            return "Soybean CIF"
        if inc == "FAS":
            return "Soybean FAS"
        return "SOYBEAN FOB"

    if fam == "Soybean Oil":
        if "REFINED" in name.upper() or "RBD" in name.upper():
            return "SOYBEAN OIL FOB Refined"
        if inc == "CFR":
            return "SOYBEAN OIL CFR Crude"
        return "SOYBEAN OIL FOB Crude"

    if fam == "Rapeseed/Canola":
        return "RAPESEED / CANOLA CPT" if inc == "CPT" else "RAPESEED / CANOLA FOB"

    if fam == "Wheat":
        u = name.upper()
        if "MIDDS" in u or "BRAN" in u:
            return "WHEAT FOB Midds"
        if "FEED" in u and inc == "CIF":
            return "WHEAT CIF Feed"
        if "FEED" in u:
            return "WHEAT FEED"
        pct = None
        import re
        m = re.search(r"(\d+(?:\.\d+)?)\s*%", u)
        if m:
            pct = m.group(1)
            if pct == "9.5":
                pct = "9.5"
        if pct and inc == "FOB":
            return f"WHEAT FOB {pct}%"
        if pct and inc == "CIF":
            return f"WHEAT CIF {pct}%"
        if pct:
            return f"WHEAT {pct}%"
        return None

    return None


def map_nbr(imp: Import, materials: dict[str, Material]) -> str | None:
    d = imp.description.upper()
    sheet = getattr(imp, "_sheet", "")

    # Exclude pharma / food-grade / non-feed records (honest: not feed raw materials)
    PHARMA = ["PH.R", "PH.RAW", "PH.R.M", "PHARMACEUTICAL", "USP", "BP ", " BP",
              "PH.EUR", "FCC", "FOOD GRADE", "ANHYDROUS", "DIHYDRATE", " PET ",
              "BIRD FOOD", "PET FOOD", "AQUARIUM", "FISH FOOD", "FISH FEED", "SMALL ANIMALS",
              "P.R.M", "TRICHOLINE", "CITRATE"]
    if any(t in d for t in PHARMA):
        return None

    if "CHOLINE" in d:
        return "CHOLINE CHLORIDE"
    if "MAIZE" in d:
        return "MAIZE/CORN"
    if "TAPIOCA" in d:
        return "TAPIOCA RESIDUE PELLETS"
    if "GLUTEN MEAL" in d or "CGM" in d or "MGM" in d:
        return "CORN GLUTEN MEAL"
    if "GLUTEN FEED" in d or "CGF" in d:
        return "CORN GLUTEN FEED"
    if "MONOCALCIUM" in d or ("MCP" in d and "FEED" in d):
        return "MONO CALCIUM PHOSPHATE (MCP)" if "FEED" in d else None
    if "DICALCIUM" in d or "CALPHORUS" in d or "DCP" in d or "DI-CALCIUM" in d or "DI CALCIUM" in d:
        return "DICALCIUM PHOSPHATE (DCP)" if "FEED" in d else None
    if "DDGS" in d or "DISTILLER" in d or "DISTRILLER" in d:
        return "DDGS"
    if "PREMIX" in d:
        return "FEED PREMIX"
    if "METAMINO" in d or "RHODIMET" in d or "HYDROXY ANALOGUE" in d:
        return "DL-METHIONINE"
    if "DL-METHIONINE" in d or "DL METHIONINE" in d:
        return "DL-METHIONINE"
    if "L-METHIONINE" in d:
        return "L-METHIONINE" if "FEED" in d else None
    if "LYSINE" in d:
        return "L-LYSINE" if "FEED" in d else None
    if "THREONINE" in d:
        return "L-THREONINE" if "FEED" in d else None
    if "LIMESTONE" in d or "LIME STONE" in d:
        return "LIMESTONE POWDER"
    if "RAPESEED" in d:
        return "RAPESEED EXTRACT"
    if "SOYBEAN FLOUR" in d or "SOY FLOUR" in d:
        return "SOYBEAN FLOUR"
    if "SOYABEAN" in d or "SOYA BEAN" in d:
        return "SOYMEAL CIF"
    if "WHEAT BRAN" in d:
        return "WHEAT BRAN"
    if "SUPPLEMENT" in d or "SUPPLIMENT" in d or "SUPP" in d or "ADDITIVE" in d:
        if "LIQUID" in d or "LTR" in d or " ML" in d or "ML " in d:
            return "FEED SUPPLEMENT (LIQUID)"
        if "POWDER" in d:
            return "FEED SUPPLEMENT (POWDER)"
        return "FEED SUPPLEMENT (OTHER)"
    return None
