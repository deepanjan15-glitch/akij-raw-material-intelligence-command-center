"""Normalized entities + shared parsing helpers for the Command Center data model."""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Optional
import re

# ---------------------------------------------------------------------------
# Entities (instruction 026)
# ---------------------------------------------------------------------------

@dataclass
class Material:
    id: str
    name: str
    category: str
    hsCode: str
    unit: str
    specification: Optional[str] = None
    sources: list = field(default_factory=list)


@dataclass
class Source:
    id: str
    name: str
    type: str            # Fastmarkets | NBR | Volza | ...
    quality: int         # 0-100 source-quality proxy (documented, not fabricated)
    notes: str = ""


@dataclass
class PriceObservation:
    id: str
    materialId: str
    sourceId: str
    countryCode: Optional[str]
    countryName: Optional[str]
    incoterm: Optional[str]
    currency: str
    unit: str
    value: float
    valueUsdMt: Optional[float]   # None if currency/unit not USD-convertible
    market: Optional[str]         # e.g. "US Gulf", "CVB", "PNW", "Danube"
    specification: Optional[str]  # protein % / grade where present
    observationDate: str
    loadedAt: str


@dataclass
class Import:
    id: str
    materialId: Optional[str]
    hsCode: str
    countryCode: str
    countryName: Optional[str]
    description: str
    period: str            # YYYY-MM
    volumeMt: Optional[float]
    valueUsd: Optional[float]
    unitValueUsdMt: Optional[float]
    exporter: Optional[str]
    importer: Optional[str]
    loadedAt: str


@dataclass
class Procurement:
    id: str
    materialId: str
    supplierId: Optional[str]
    countryCode: Optional[str]
    incoterm: Optional[str]
    priceUsdMt: Optional[float]
    date: str


@dataclass
class Supplier:
    id: str
    name: str
    countryCode: str
    countryName: str
    materialId: Optional[str]
    volumeMt: float
    valueUsd: float
    unitValueUsdMt: float
    shipments: int


# ISO-2 code -> full country name (for origin/supplier display)
COUNTRY_NAMES = {
    "AR": "Argentina", "AU": "Australia", "AT": "Austria", "BD": "Bangladesh", "BE": "Belgium",
    "BR": "Brazil", "BG": "Bulgaria", "CA": "Canada", "CN": "China", "DK": "Denmark",
    "EG": "Egypt", "FR": "France", "DE": "Germany", "GB": "United Kingdom", "HK": "Hong Kong",
    "IN": "India", "ID": "Indonesia", "IT": "Italy", "JP": "Japan", "KE": "Kenya",
    "KR": "South Korea", "MY": "Malaysia", "MX": "Mexico", "MA": "Morocco", "MZ": "Mozambique",
    "NL": "Netherlands", "NG": "Nigeria", "NO": "Norway", "PK": "Pakistan", "PH": "Philippines",
    "PL": "Poland", "RO": "Romania", "RU": "Russia", "SA": "Saudi Arabia", "SG": "Singapore",
    "ES": "Spain", "LK": "Sri Lanka", "SE": "Sweden", "TW": "Taiwan", "TZ": "Tanzania",
    "TH": "Thailand", "TN": "Tunisia", "TR": "Turkey", "UG": "Uganda", "UA": "Ukraine",
    "AE": "United Arab Emirates", "US": "United States", "VN": "Vietnam", "ZA": "South Africa",
    "AO": "Angola", "GH": "Ghana", "OM": "Oman", "SC": "Seychelles", "MV": "Maldives",
}


def country_full(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    c = str(code).strip().upper()
    return COUNTRY_NAMES.get(c, c)


# ---------------------------------------------------------------------------
# Country code map (keyword -> ISO code / name)
# ---------------------------------------------------------------------------
COUNTRY_KEYWORDS = {
    "argentina": ("AR", "Argentina"),
    "australia": ("AU", "Australia"),
    "brazil": ("BR", "Brazil"),
    "canada": ("CA", "Canada"),
    "china": ("CN", "China"),
    "egypt": ("EG", "Egypt"),
    "france": ("FR", "France"),
    "germany": ("DE", "Germany"),
    "india": ("IN", "India"),
    "indonesia": ("ID", "Indonesia"),
    "japan": ("JP", "Japan"),
    "korea": ("KR", "South Korea"),
    "malaysia": ("MY", "Malaysia"),
    "netherlands": ("NL", "Netherlands"),
    "poland": ("PL", "Poland"),
    "romania": ("RO", "Romania"),
    "russia": ("RU", "Russia"),
    "singapore": ("SG", "Singapore"),
    "spain": ("ES", "Spain"),
    "taiwan": ("TW", "Taiwan"),
    "thailand": ("TH", "Thailand"),
    "turkey": ("TR", "Turkey"),
    "ukraine": ("UA", "Ukraine"),
    "vietnam": ("VN", "Vietnam"),
    "bulgaria": ("BG", "Bulgaria"),
    "belgium": ("BE", "Belgium"),
    "pakistan": ("PK", "Pakistan"),
    "nigeria": ("NG", "Nigeria"),
    "angola": ("AO", "Angola"),
    "kenya": ("KE", "Kenya"),
    "mozambique": ("MZ", "Mozambique"),
    "tanzania": ("TZ", "Tanzania"),
    "uganda": ("UG", "Uganda"),
    "morocco": ("MA", "Morocco"),
    "united states": ("US", "United States"),
    "usa": ("US", "United States"),
    "us gulf": ("US", "United States"),
    "us pacific": ("US", "United States"),
    "pacific northwest": ("US", "United States"),
    "pnw": ("US", "United States"),
    "decatur": ("US", "United States"),
    "minneapolis": ("US", "United States"),
    "toledo": ("US", "United States"),
    "kansas city": ("US", "United States"),
    "santos": ("BR", "Brazil"),
    "paranagua": ("BR", "Brazil"),
    "paranaguá": ("BR", "Brazil"),
    "ponta grossa": ("BR", "Brazil"),
    "rondonopolis": ("BR", "Brazil"),
    "cascavel": ("BR", "Brazil"),
    "sinop": ("BR", "Brazil"),
    "rotterdam": ("NL", "Netherlands"),
    "hamburg": ("DE", "Germany"),
    "marmara": ("TR", "Turkey"),
    "azov": ("RU", "Russia"),
    "danube": ("UA", "Ukraine"),
    "constanta": ("RO", "Romania"),
    "varna": ("BG", "Bulgaria"),
    "burgas": ("BG", "Bulgaria"),
    "cvb": ("BG", "Bulgaria"),
    "poc": ("RO", "Romania"),
    "black sea": ("BG", "Bulgaria"),
    "baltic": ("PL", "Baltic"),
    "manly": ("US", "United States"),
    "iowa": ("US", "United States"),
    "illinois": ("US", "United States"),
    "indiana": ("US", "United States"),
    "ohio": ("US", "United States"),
    "michigan": ("US", "United States"),
    "minnesota": ("US", "United States"),
    "chicago": ("US", "United States"),
    "velva": ("US", "United States"),
    "los angeles": ("US", "United States"),
    "mississippi": ("US", "United States"),
    "new orleans": ("US", "United States"),
    "st lawrence": ("CA", "Canada"),
    "vancouver": ("CA", "Canada"),
}

# locations within US that map to the USA but retain a market label
US_MARKETS = ["us gulf", "us pacific northwest", "pnw", "decatur", "minneapolis", "toledo",
              "kansas city", "central illinois", "iowa", "indiana", "ohio", "michigan",
              "minnesota", "dakotas", "chicago", "manly", "los angeles", "mississippi",
              "new orleans", "velva", "buffalo", "channahon", "illinois"]


def extract_country(text: str):
    """Return (code, name, market) by keyword match; market is a US/regional sub-location."""
    t = text.lower()
    best = None
    for kw, (code, name) in COUNTRY_KEYWORDS.items():
        if kw in t:
            if best is None or len(kw) > len(best[0]):
                best = (kw, code, name)
    if not best:
        return None, None, None
    market = None
    for m in US_MARKETS:
        if m in t:
            market = m.title()
            break
    return best[1], best[2], market


def extract_incoterm(text: str):
    t = text.upper()
    for term in ["FOB", "CIF", "CFR", "FAS", "CPT", "FCA", "C&F", "DELIVERED", "DOMESTIC"]:
        if re.search(rf"\b{term}\b", t):
            return term
    if "delivered" in t:
        return "DELIVERED"
    return None


def extract_unit(text: str):
    t = text.lower()
    if "$/short ton" in t or "$/st" in t:
        return "USD", "short ton"
    if "cts/lb" in t or "cents/lb" in t or "us cents/lb" in t or "c/lb" in t:
        return "USD", "lb"
    if "$/bushel" in t:
        return "USD", "bushel"
    if "c$/bu" in t or "c/bu" in t:
        return "USD", "bushel"  # cents per bushel
    if "€/mt" in t or "euro/mt" in t or "€/tonne" in t:
        return "EUR", "mt"
    if "real/60kg" in t or "r$/60kg" in t:
        return "BRL", "60kg"
    if "real/tonne" in t:
        return "BRL", "mt"
    if "hryvnia" in t:
        return "UAH", "mt"
    if "ringgit" in t:
        return "MYR", "mt"
    if "rupiah" in t:
        return "IDR", "kg"
    if "$/mt" in t or "$/tonne" in t or "$/ton" in t or "usd/mt" in t:
        return "USD", "mt"
    return "USD", "mt"


def extract_specification(text: str):
    """Extract protein/grade specification where present."""
    m = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
    pct = m.group(1) if m else None
    grade = None
    for g in ["Hi-Pro", "Hi Pro", "SMP", "Hipro", "RBD", "crude", "refined", "de-gummed",
              "CWRS", "HRW", "SRW", "APW", "ASW", "2CWAD"]:
        if g.lower() in text.lower():
            grade = g
            break
    parts = [x for x in [pct, grade] if x]
    return " ".join(parts) if parts else None
