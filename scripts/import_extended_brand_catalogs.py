#!/usr/bin/env python3
"""Import the official catalogues and direct store offers added on 2026-08-24.

Brand and seller are kept as separate concepts.  Direct prices come only from
the named shop or manufacturer; comparison engines are not used as sources.
"""

# ruff: noqa: RUF001 -- Polish product copy intentionally uses typographic Unicode.

from __future__ import annotations

import html
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable
from urllib.parse import urljoin

from import_partner_brand_catalogs import (
    BRAND_DIR,
    PROJECT_ROOT,
    add_downloads,
    clean_html,
    direct_offer,
    download_asset,
    fetch,
    fetch_json,
    presentation_from,
    product_metadata,
    sentence,
    slugify,
    text_values,
)

OUTPUT_PATH = PROJECT_ROOT / "apps/api/app/services/extended_brand_catalogs.json"
REVIEWED_AT = "2026-08-24"

SKINFINITY_URL = "https://skinfinitycare.pl/products?categoryId=3"
SKINFINITY_API = "https://skinfinity-xgmcoxcadq-ew.a.run.app/api/products"
BIODERMA_URL = "https://www.bioderma.pl/"
BIODERMA_SITEMAP = "https://www.bioderma.pl/sitemap.xml"
CLAYLY_URL = "https://clayly.pl/"
FEDUA_URL = "https://fedua.com/en"
OPPOLINE_URL = "https://www.oppolinecosmetics.eu/pl-pl"
MEDESTELLE_URL = "https://www.medestelle.eu/"
TEOXANE_URL = "https://www.teoxane.pl/pl/category/all-products"
INFINI_URL = "https://infinifiller.pl/"
ASK_URL = "https://askbeauty.sklep.pl/Twarz-c35/"
SK_BEAUTY_URL = "https://skbeauty.pl/pielegnacja-twarzy"


def html_attribute(fragment: str, name: str) -> str:
    match = re.search(rf'\b{name}=["\']([^"\']*)["\']', fragment, flags=re.I)
    return html.unescape(match.group(1)).strip() if match else ""


def first_available_variant(row: dict[str, Any]) -> dict[str, Any] | None:
    variants = [item for item in row.get("variants", []) if isinstance(item, dict)]
    return next((item for item in variants if item.get("available")), variants[0] if variants else None)


def product_images(urls: list[str], name: str) -> list[dict[str, Any]]:
    return [
        {
            "path": path,
            "alt": f"{name} — oficjalne zdjęcie {index}",
            "label": "Produkt" if index == 1 else f"Zdjęcie {index}",
            "scale": 1.0,
            "fit": "cover",
        }
        for index, path in enumerate(urls, start=1)
    ]


def beauty_metadata(name: str, summary: str, category: str = "") -> dict[str, Any]:
    meta = product_metadata(name, summary, category)
    normalized_name = slugify(name)
    explicit_device_terms = (
        "urzadzenie",
        "device",
        "laser",
        "maska-led",
        "corneo-pen",
        "mesopen",
        "wirowka",
        "wytrzasarka",
    )
    if meta["kind"] == "DEVICE" and not any(
        token in normalized_name for token in explicit_device_terms
    ):
        meta = product_metadata(name, "", category)
    normalized = slugify(" ".join((name, summary, category)))
    if any(token in normalized for token in ("nail", "paznok", "gel-polish", "lakier")):
        meta.update(
            {
                "productCategory": "Produkt do paznokci",
                "productFamily": "Stylizacja i pielęgnacja paznokci",
                "treatmentCategories": ["Stylizacja paznokci"],
                "applicationAreas": [],
            }
        )
    if any(token in normalized for token in ("filler", "wypelniacz", "usieciowany")):
        meta.update(
            {
                "kind": "PRODUCT",
                "productCategory": "Wyrób medyczny do iniekcji",
                "productFamily": "Wypełniacz na bazie kwasu hialuronowego",
                "manufacturerUses": ["Wypełnianie i modelowanie"],
                "treatmentCategories": ["Wypełnianie i modelowanie", "Medycyna estetyczna"],
            }
        )
    elif any(
        token in normalized
        for token in ("mezoterapia", "meso-", "stymulator", "aquabooster", "biorewital")
    ):
        meta.update(
            {
                "kind": "PRODUCT",
                "productCategory": "Preparat profesjonalny do zabiegów",
                "productFamily": "Preparat do mezoterapii lub biostymulacji",
                "manufacturerUses": ["Mezoterapia lub biostymulacja skóry"],
                "treatmentCategories": ["Mezoterapia", "Biostymulacja skóry"],
            }
        )
    areas: list[dict[str, str]] = []

    def add_area(code: str, label: str) -> None:
        if not any(area["code"] == code for area in areas):
            areas.append({"code": code, "label": label})

    if any(token in normalized for token in ("twarz", "face", "facial")):
        add_area("FACE", "Skóra twarzy")
    if any(token in normalized for token in ("oko", "oczu", "eye")):
        add_area("EYES", "Okolica oczu")
    if any(token in normalized for token in ("ust", "lip")):
        add_area("LIPS", "Usta i ich kontur")
    if any(token in normalized for token in ("szyj", "neck")):
        add_area("NECK", "Szyja")
    if any(token in normalized for token in ("dekolt", "decollete")):
        add_area("DECOLLETE", "Dekolt")
    if any(token in normalized for token in ("cial", "body")):
        add_area("BODY", "Skóra ciała")
    if any(token in normalized for token in ("intym", "bikini")):
        add_area("BIKINI", "Okolica bikini i miejsca intymne")
    if any(token in normalized for token in ("wlos", "hair", "skora-glowy")):
        areas = [{"code": "SCALP", "label": "Włosy i skóra głowy"}]
    if areas:
        meta["applicationAreas"] = areas
    return meta


def merge_products(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for product in products:
        key = "|".join((slugify(str(product["brand"])), slugify(str(product["name"]))))
        current = merged.get(key)
        if current is None:
            merged[key] = product
            continue
        known_offers = {
            (str(offer.get("seller")), str(offer.get("url")))
            for offer in current.get("offers", [])
            if isinstance(offer, dict)
        }
        current.setdefault("offers", []).extend(
            offer
            for offer in product.get("offers", [])
            if isinstance(offer, dict)
            and (str(offer.get("seller")), str(offer.get("url"))) not in known_offers
        )
        current.setdefault("_sourceImages", []).extend(product.get("_sourceImages", []))
    return list(merged.values())


def skinfinity_products() -> list[dict[str, Any]]:
    rows = fetch_json(SKINFINITY_API)
    if not isinstance(rows, list):
        raise RuntimeError("Skinfinity: nieprawidłowy katalog API")
    merge_ids = {
        7: "professional-product:revolax-fine-1-1ml",
        9: "professional-product:revolax-deep-1-1ml",
        8: "professional-product:revolax-sub-q-1-1ml",
    }
    brand_names = {
        "REVOLAX™": "REVOLAX / Across",
        "PromoItalia": "Nucleofill / Promoitalia",
    }
    products: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict) or row.get("hideProduct") or int(row.get("id") or 0) == 3:
            continue
        product_id = int(row["id"])
        name = clean_html(row.get("name"))
        summary = sentence(row.get("description"), "Profesjonalny preparat zabiegowy.")
        brand = brand_names.get(str(row.get("brand")), clean_html(row.get("brand")))
        category = "Wypełniacze" if row.get("categoryId") == 3 else "Stymulatory tkankowe"
        meta = beauty_metadata(name, summary, category)
        price = float(row.get("discountedPrice") or row.get("price") or 0)
        url = f"https://skinfinitycare.pl/product/{product_id}"
        product = {
            "slug": f"skinfinity-{slugify(name)}",
            "name": name,
            "brand": brand,
            "summary": summary,
            "presentation": presentation_from(name),
            **meta,
            "keyIngredients": text_values(re.findall(r"(?:Skład|HA).*?(?:</ul>|</p>)", str(row.get("description")), re.I | re.S)),
            "aliases": [clean_html(row.get("productCode"))],
            "offers": [direct_offer("Skinfinity Care", price, url, available=int(row.get("quantity") or 0) > 0)],
            "sourceUrl": url,
            "professionalOnly": True,
            "assetDirectory": "skinfinity",
            "_sourceImages": [str(row.get("imageUrl"))] if row.get("imageUrl") else [],
        }
        if product_id in merge_ids:
            product["mergeExternalId"] = merge_ids[product_id]
        products.append(product)
    if len(products) != 9:
        raise RuntimeError(f"Skinfinity: oczekiwano 9 prawidłowych kart, jest {len(products)}")
    return products


def bioderma_product(url: str) -> dict[str, Any] | None:
    page = fetch(url).decode("utf-8", errors="replace")
    gtin = re.search(r'<meta itemprop="gtin" content="([^"]+)"', page)
    if not gtin:
        return None
    names = re.findall(r'<meta itemprop="name" content="([^"]+)"', page)
    image = re.search(r'<meta itemprop="image" content="([^"]+)"', page)
    description = re.search(r'<h2 itemprop="description"[^>]*>(.*?)</h2>', page, flags=re.S)
    if len(names) < 2 or not image:
        return None
    name = clean_html(names[-1])
    summary = clean_html(description.group(1)) if description else f"Oficjalny dermokosmetyk Bioderma {name}."
    range_name = re.search(r'"item_name"\s*:\s*"([^"]+)"', page)
    line = clean_html(range_name.group(1)).split()[0] if range_name else "Bioderma"
    capacities = [clean_html(value) for value in re.findall(r'<option[^>]*data-ean="[^"]*"[^>]*>(.*?)</option>', page, flags=re.S)]
    meta = beauty_metadata(name, summary, line)
    product: dict[str, Any] = {
        "slug": f"bioderma-{slugify(name)}-{gtin.group(1)}",
        "name": name,
        "brand": "Bioderma",
        "summary": sentence(summary, f"Oficjalny dermokosmetyk Bioderma {name}."),
        "presentation": " / ".join(capacities[:4]) or presentation_from(name),
        **meta,
        "keyIngredients": [],
        "aliases": [gtin.group(1)],
        "offers": [],
        "sourceUrl": url,
        "professionalOnly": False,
        "assetDirectory": "bioderma",
        "_sourceImages": [html.unescape(image.group(1))],
        "series": line,
    }
    if url.rstrip("/").endswith("/cicabio/cicabio-creme"):
        product["mergeExternalId"] = "professional-cosmetic:bioderma-cicabio-creme-plus"
    return product


def bioderma_products() -> list[dict[str, Any]]:
    sitemap = fetch(BIODERMA_SITEMAP).decode("utf-8", errors="replace")
    urls = list(dict.fromkeys(re.findall(r"<loc>(https://www\.bioderma\.pl/produkty/[^<]+)</loc>", sitemap)))
    products: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=14) as executor:
        futures = {executor.submit(bioderma_product, url): url for url in urls}
        for future in as_completed(futures):
            try:
                product = future.result()
            except Exception as error:
                print(f"Pominięto Bioderma {futures[future]}: {error}")
                continue
            if product:
                products.append(product)
    unique = {product["slug"]: product for product in products}
    if len(unique) < 100:
        raise RuntimeError(f"Bioderma: niepełny katalog ({len(unique)})")
    return sorted(unique.values(), key=lambda item: str(item["name"]))


def json_ld_product(page: str) -> dict[str, Any] | None:
    for raw in re.findall(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', page, flags=re.I | re.S):
        try:
            data = json.loads(html.unescape(raw))
        except json.JSONDecodeError:
            continue
        candidates = data if isinstance(data, list) else [data]
        for candidate in candidates:
            if isinstance(candidate, dict) and str(candidate.get("@type", "")).casefold() == "product":
                return candidate
    return None


def clayly_products() -> list[dict[str, Any]]:
    home = fetch(CLAYLY_URL).decode("utf-8", errors="replace")
    urls = list(
        dict.fromkeys(
            re.findall(r'href="(https://clayly\.pl/\d+-[^"#?]+\.html)"', home, flags=re.I)
        )
    )
    products: list[dict[str, Any]] = []
    for url in urls:
        try:
            page = fetch(url).decode("utf-8", errors="replace")
        except RuntimeError as error:
            print(f"Pominięto nieaktywną kartę Clayly {url}: {error}")
            continue
        data = json_ld_product(page)
        if not data:
            continue
        name = clean_html(data.get("name"))
        summary = sentence(data.get("description"), f"Oficjalny kosmetyk Clayly {name}.")
        meta = beauty_metadata(name, summary)
        offer = data.get("offers", {}) if isinstance(data.get("offers"), dict) else {}
        image_value = data.get("image")
        images = image_value if isinstance(image_value, list) else [image_value]
        price = float(offer.get("price") or 0)
        products.append(
            {
                "slug": f"clayly-{slugify(name)}",
                "name": name,
                "brand": "Clayly",
                "summary": summary,
                "presentation": presentation_from(" ".join((name, summary))),
                **meta,
                "keyIngredients": [],
                "aliases": [clean_html(data.get("sku"))],
                "offers": [direct_offer("Clayly", price, url, available="OutOfStock" not in str(offer.get("availability")))] if price else [],
                "sourceUrl": url,
                "professionalOnly": False,
                "assetDirectory": "clayly",
                "_sourceImages": [str(value) for value in images if isinstance(value, str) and value.startswith("http")][:3],
            }
        )
    if len(products) < 10:
        raise RuntimeError(f"Clayly: niepełny katalog ({len(products)})")
    return products


def shopify_rows(url: str) -> list[dict[str, Any]]:
    payload = fetch_json(url)
    rows = payload.get("products", []) if isinstance(payload, dict) else []
    return [row for row in rows if isinstance(row, dict)]


def shopify_products(
    rows: list[dict[str, Any]],
    *,
    base_url: str,
    seller: str,
    brand: str,
    asset_directory: str,
    currency: str,
    include: Callable[[dict[str, Any]], bool],
) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    for row in rows:
        if not include(row):
            continue
        name = clean_html(row.get("title"))
        summary = sentence(row.get("body_html"), f"Oficjalny produkt {brand} {name}.")
        category = clean_html(row.get("product_type"))
        tags = [clean_html(value) for value in row.get("tags", []) if clean_html(value)]
        meta = beauty_metadata(name, summary, " ".join((category, *tags)))
        variant = first_available_variant(row)
        price = float(variant.get("price") or 0) if variant else 0
        url = f"{base_url.rstrip('/')}/products/{row['handle']}"
        offers = []
        reference_price = None
        if price > 1 and currency == "PLN":
            offers = [direct_offer(seller, price, url, available=bool(variant.get("available")))]
        elif price > 0 and currency != "PLN":
            reference_price = {
                "amount": price,
                "currency": currency,
                "seller": seller,
                "url": url,
                "updatedAt": REVIEWED_AT,
            }
        images = [
            str(image.get("src"))
            for image in row.get("images", [])
            if isinstance(image, dict) and image.get("src")
        ][:3]
        product = {
            "slug": f"{asset_directory}-{slugify(name)}",
            "name": name,
            "brand": brand,
            "summary": summary,
            "presentation": presentation_from(" ".join((name, summary))),
            **meta,
            "manufacturerUses": tags[:10] or meta["manufacturerUses"],
            "keyIngredients": [],
            "aliases": [clean_html(variant.get("sku"))] if variant else [],
            "offers": offers,
            "sourceUrl": url,
            "professionalOnly": "profesjonal" in slugify(" ".join((summary, *tags))),
            "assetDirectory": asset_directory,
            "_sourceImages": images,
        }
        if reference_price:
            product["officialReferencePrice"] = reference_price
        products.append(product)
    return products


def fedua_products() -> list[dict[str, Any]]:
    rows = shopify_rows("https://fedua.com/en/products.json?limit=250")
    products = shopify_products(
        rows,
        base_url="https://fedua.com/en",
        seller="FEDUA",
        brand="FEDUA",
        asset_directory="fedua",
        currency="EUR",
        include=lambda row: bool(row.get("title")),
    )
    if len(products) < 130:
        raise RuntimeError(f"FEDUA: niepełny katalog ({len(products)})")
    return products


def oppoline_products() -> list[dict[str, Any]]:
    rows = shopify_rows("https://www.oppolinecosmetics.eu/pl-pl/products.json?limit=250")
    allowed = {
        "zestaw-pelnego-rytualu-oppoline",
        "trichology-mask-maska-trychologiczna",
        "trichology-shampoo-szampon-trychologiczny-new",
        "body-oil-olejek-do-ciala",
        "limited-ritual-zestaw-krem-i-zel",
        "pure-soul-cleanser-zel-micelarny-do-twarzy",
        "divine-glow-cream-krem-przeciwzmarszczkowy-do-twarzy",
        "body-scrub-peeling-cukrowy-do-ciala",
    }
    products = shopify_products(
        rows,
        base_url="https://www.oppolinecosmetics.eu/pl-pl",
        seller="Oppoline",
        brand="Oppoline",
        asset_directory="oppoline",
        currency="PLN",
        include=lambda row: str(row.get("handle")) in allowed,
    )
    if len(products) != len(allowed):
        raise RuntimeError(f"Oppoline: oczekiwano {len(allowed)} kosmetyków, jest {len(products)}")
    return products


def medestelle_include(row: dict[str, Any]) -> bool:
    text = slugify(" ".join((str(row.get("title") or ""), *(str(tag) for tag in row.get("tags", [])))))
    excluded = (
        "psychologia-sprzedazy",
        "prezentacja-marki",
        "krolewski-masaz-karku",
        "masaz-krolewski-lift",
        "voucher",
        "zaproszenie",
        "koszulka",
        "fartuch",
        "pareo",
        "recznik",
        "kosmetyczka",
        "notes",
        "naklejka",
        "woreczek",
        "torba",
        "torebki",
        "pudelko",
        "ulotki",
        "katalog-detaliczny",
        "podreczniki",
        "materialy-szkoleniowe",
        "plakaty",
        "pankarty",
        "roll-up",
        "obrazy-na-plotnie",
        "taca-ekspozycyjna",
        "ekspozytor",
        "ramka",
        "gift",
        "tester",
        "beauty-plan",
    )
    if any(token in text for token in excluded):
        return False
    product_terms = (
        "krem",
        "serum",
        "maska",
        "tonik",
        "pianka",
        "balsam",
        "peeling",
        "olej",
        "maslo",
        "zel",
        "koncentrat",
        "ampulka",
        "mgielka",
        "emulsja",
        "esencja",
        "platki",
        "spf",
        "corneo-pen",
        "urzadzenie",
        "bio-alginat",
    )
    return any(token in text for token in product_terms)


def medestelle_products() -> list[dict[str, Any]]:
    rows = shopify_rows("https://www.medestelle.eu/products.json?limit=250")
    products = shopify_products(
        rows,
        base_url="https://www.medestelle.eu",
        seller="MedEstelle",
        brand="MedEstelle",
        asset_directory="medestelle",
        currency="PLN",
        include=medestelle_include,
    )
    if len(products) < 80:
        raise RuntimeError(f"MedEstelle: niepełny katalog kosmetyków ({len(products)})")
    return products


def find_dicts(value: object, predicate: Callable[[dict[str, Any]], bool]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(value, dict):
        if predicate(value):
            found.append(value)
        for child in value.values():
            found.extend(find_dicts(child, predicate))
    elif isinstance(value, list):
        for child in value:
            found.extend(find_dicts(child, predicate))
    return found


def teoxane_products() -> list[dict[str, Any]]:
    page = fetch(TEOXANE_URL).decode("utf-8", errors="replace")
    match = re.search(r'<script id="mobify-data" type="application/json">(.*?)</script>', page, flags=re.S)
    if not match:
        raise RuntimeError("TEOXANE: brak danych katalogu Mobify")
    payload = json.loads(match.group(1))
    containers = find_dicts(payload, lambda row: isinstance(row.get("hits"), list) and row.get("total") == 15)
    if not containers:
        raise RuntimeError("TEOXANE: brak listy 15 produktów")
    hits = containers[0]["hits"]
    products: list[dict[str, Any]] = []
    for row in hits:
        if not isinstance(row, dict):
            continue
        name = clean_html(row.get("productName"))
        represented = row.get("representedProduct", {})
        represented = represented if isinstance(represented, dict) else {}
        concerns = [clean_html(value) for value in represented.get("c_Concern", [])]
        use_description = clean_html(represented.get("c_Use_Description"))
        summary = sentence(". ".join((*concerns, use_description)), f"Oficjalny dermokosmetyk TEOXANE {name}.")
        category_values = represented.get("c_Category_Range", [])
        category = " ".join(clean_html(value) for value in category_values)
        meta = beauty_metadata(name, summary, category)
        product_id = str(row["productId"])
        url = f"https://www.teoxane.pl/pl/product/{product_id}"
        price = float(row.get("price") or 0)
        image = row.get("image", {}) if isinstance(row.get("image"), dict) else {}
        size = represented.get("c_Size")
        products.append(
            {
                "slug": f"teoxane-{slugify(name)}-{slugify(product_id)}",
                "name": name,
                "brand": "TEOXANE",
                "summary": summary,
                "presentation": f"{size} ml" if size else presentation_from(name),
                **meta,
                "manufacturerUses": concerns or meta["manufacturerUses"],
                "keyIngredients": [clean_html(value) for value in represented.get("c_Key_Ingredients", [])][:12],
                "aliases": [product_id],
                "offers": [direct_offer("TEOXANE", price, url, available=bool(row.get("orderable")))] if price else [],
                "sourceUrl": url,
                "professionalOnly": False,
                "assetDirectory": "teoxane",
                "_sourceImages": [str(image.get("link"))] if image.get("link") else [],
                "skinTypes": text_values(represented.get("c_Skin_Type")),
                "series": category,
            }
        )
    if len(products) != 15:
        raise RuntimeError(f"TEOXANE: oczekiwano 15 produktów, jest {len(products)}")
    return products


INFINI_CATEGORIES = {
    "infini-premium-filler": "Wypełniacze",
    "meso": "Mezoterapia",
    "aquabooster": "Aquabooster",
    "stymulatory": "Stymulatory tkankowe",
    "skincare": "Pielęgnacja skóry",
    "urzadzenia": "Urządzenia",
    "peel": "Peelingi profesjonalne",
}


def infini_product(url: str, category: str) -> dict[str, Any] | None:
    page = fetch(url).decode("utf-8", errors="replace")
    title = re.search(r'<meta property="og:title" content="([^"]+)"', page)
    image = re.search(r'<meta property="og:image" content="([^"]+)"', page)
    description = re.search(r'<meta property="og:description" content="([^"]+)"', page)
    if not title or not image:
        return None
    name = clean_html(title.group(1)).split(" - ")[0]
    if len(name) < 3 or name.casefold() in {"infini", "infinifiller"}:
        return None
    summary = sentence(description.group(1) if description else "", f"Oficjalny produkt INFINI {name}.")
    meta = beauty_metadata(name, summary, category)
    if category == "Urządzenia":
        meta["kind"] = "DEVICE"
        meta["productCategory"] = "Urządzenie profesjonalne"
        meta["productFamily"] = "Urządzenie do medycyny estetycznej"
    elif category == "Pielęgnacja skóry":
        meta["kind"] = "COSMETIC"
    else:
        meta["kind"] = "PRODUCT"
        meta["productCategory"] = "Profesjonalny preparat zabiegowy"
    return {
        "slug": f"infini-{slugify(name)}",
        "name": name,
        "brand": "INFINI",
        "summary": summary,
        "presentation": presentation_from(" ".join((name, summary))),
        **meta,
        "keyIngredients": [],
        "aliases": [],
        "offers": [],
        "sourceUrl": url,
        "professionalOnly": category != "Pielęgnacja skóry",
        "assetDirectory": "infini",
        "_sourceImages": [html.unescape(image.group(1))],
        "series": category,
    }


def infini_products() -> list[dict[str, Any]]:
    excluded_paths = {
        "/",
        "/infini-premium-filler/",
        "/meso/",
        "/aquabooster/",
        "/stymulatory/",
        "/skincare/",
        "/urzadzenia/",
        "/peel/",
        "/szkolenia/",
        "/trenerzy-infini/",
        "/aktualnosci/",
        "/kontakt/",
    }
    candidates: dict[str, str] = {}
    for path_slug, category in INFINI_CATEGORIES.items():
        page = fetch(f"https://infinifiller.pl/{path_slug}/").decode("utf-8", errors="replace")
        for path in re.findall(r'href=["\'](/[^"\'#?]+/)["\']', page, flags=re.I):
            if path in excluded_paths or any(token in path for token in ("wp-", "feed", "author", "category", "tag")):
                continue
            candidates[urljoin(INFINI_URL, path)] = category
    products: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=12) as executor:
        futures = {executor.submit(infini_product, url, category): url for url, category in candidates.items()}
        for future in as_completed(futures):
            try:
                product = future.result()
            except Exception as error:
                print(f"Pominięto INFINI {futures[future]}: {error}")
                continue
            if product:
                products.append(product)
    products = merge_products(products)
    if len(products) < 35:
        raise RuntimeError(f"INFINI: niepełny katalog ({len(products)})")
    return products


def ask_products() -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    for page_number in (1, 2):
        url = ASK_URL if page_number == 1 else f"https://askbeauty.sklep.pl/Twarz-c35/pa/{page_number}"
        page = fetch(url).decode("utf-8", errors="replace")
        tracking = re.search(r"gtag\('event', 'view_item_list', (\{.*?\})\);", page, flags=re.S)
        if not tracking:
            raise RuntimeError(f"ASK Beauty: brak listy danych na stronie {page_number}")
        items = json.loads(tracking.group(1)).get("items", [])
        tile_by_id: dict[str, str] = {}
        for tile in re.findall(r'<figure class="product-tile">(.*?)</figure>', page, flags=re.S):
            product_id = re.search(r'data-product-id="(\d+)"', tile)
            if product_id:
                tile_by_id[product_id.group(1)] = tile
        for index, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            product_id = str(item.get("item_id"))
            tile = tile_by_id.get(product_id, "")
            link = re.search(r'<a[^>]+href="([^"]+)"[^>]+class="product-name', tile)
            image = re.search(r'([^" ]+_480\.(?:jpg|webp|png))\s+480w', tile)
            if not link or not image:
                continue
            name = clean_html(item.get("item_name"))
            brand = clean_html(item.get("item_brand")) or name.split()[0]
            product_url = urljoin("https://askbeauty.sklep.pl", link.group(1))
            summary = f"Kosmetyk {brand} do profesjonalnej lub domowej pielęgnacji twarzy."
            meta = beauty_metadata(name, summary, "Pielęgnacja twarzy")
            products.append(
                {
                    "slug": f"ask-{slugify(name)}-{product_id}",
                    "name": name,
                    "brand": brand,
                    "summary": summary,
                    "presentation": presentation_from(name),
                    **meta,
                    "keyIngredients": [],
                    "aliases": [product_id],
                    "offers": [direct_offer("ASK Beauty", float(item["price"]), product_url, available=int(item.get("quantity") or 0) > 0)],
                    "sourceUrl": product_url,
                    "professionalOnly": False,
                    "assetDirectory": "ask-beauty",
                    "_sourceImages": [urljoin("https://askbeauty.sklep.pl", html.unescape(image.group(1)))],
                    "popularityRank": (page_number - 1) * 30 + index + 1,
                }
            )
    if len(products) < 55:
        raise RuntimeError(f"ASK Beauty: niepełna lista popularnych produktów ({len(products)})")
    return products


def sk_beauty_products() -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    for page_number in range(1, 14):
        url = SK_BEAUTY_URL if page_number == 1 else f"{SK_BEAUTY_URL}/{page_number}"
        page = fetch(url).decode("utf-8", errors="replace")
        tiles = re.findall(r'(<product-tile\s+product-id="\d+".*?</product-tile>)', page, flags=re.S)
        for tile in tiles:
            opening = tile.split(">", 1)[0]
            name = html_attribute(opening, "name")
            brand = html_attribute(opening, "producer")
            category = html_attribute(opening, "category")
            product_id = html_attribute(opening, "product-id")
            price_text = html_attribute(opening, "price")
            link = re.search(r'<a href="([^"]+)"[^>]+title=', tile)
            image = re.search(r'<source\s+srcset="([^" ]+)', tile, flags=re.S)
            if not all((name, brand, product_id, price_text, link, image)):
                continue
            product_url = urljoin("https://skbeauty.pl", html.unescape(link.group(1)))
            summary = f"{category or 'Kosmetyk'} marki {brand}, dostępny bezpośrednio w SK Beauty."
            meta = beauty_metadata(name, summary, category)
            products.append(
                {
                    "slug": f"skbeauty-{slugify(name)}-{product_id}",
                    "name": name,
                    "brand": brand,
                    "summary": summary,
                    "presentation": presentation_from(name),
                    **meta,
                    "keyIngredients": [],
                    "aliases": [product_id],
                    "offers": [direct_offer("SK Beauty", float(price_text), product_url, available="niedostępny" not in tile.casefold())],
                    "sourceUrl": product_url,
                    "professionalOnly": False,
                    "assetDirectory": "sk-beauty",
                    "_sourceImages": [urljoin("https://skbeauty.pl", html.unescape(image.group(1)))],
                }
            )
    products = merge_products(products)
    if len(products) < 250:
        raise RuntimeError(f"SK Beauty: niepełny katalog twarzy ({len(products)})")
    return products


def download_logos() -> dict[str, str]:
    sources = {
        "Clayly": ("https://clayly.pl/img/logo-1767956663.jpg", "clayly"),
        "FEDUA": (
            "https://cdn.shopify.com/s/files/1/0784/1601/9789/files/4d4220cd-2be4-4c85-a9c6-e4457a85d3b7.png?v=1760712913",
            "fedua",
        ),
        "Oppoline": (
            "https://www.oppolinecosmetics.eu/cdn/shop/files/Oppoline_logo_3D_version_without_expanding_copy.png?v=1776100731&width=500",
            "oppoline",
        ),
        "MedEstelle": (
            "https://www.medestelle.eu/cdn/shop/files/logo_medestelle.png?v=1780388398",
            "medestelle",
        ),
        "INFINI": (
            "https://infinifiller.pl/wp-content/uploads/2023/04/infinifiller-logo-black-flag-300.png",
            "infini",
        ),
        "TEOXANE": ("https://www.teoxane.pl/mobify/bundle/234/static/svg/teoxane-logo.svg", "teoxane"),
    }
    result: dict[str, str] = {}
    for brand, (url, filename) in sources.items():
        try:
            result[brand] = download_asset(url, BRAND_DIR / filename)
        except Exception as error:
            print(f"Pominięto logo {brand}: {error}")
    return result


def main() -> None:
    builders = (
        ("Skinfinity Care", skinfinity_products),
        ("Bioderma", bioderma_products),
        ("Clayly", clayly_products),
        ("FEDUA", fedua_products),
        ("Oppoline", oppoline_products),
        ("MedEstelle", medestelle_products),
        ("TEOXANE", teoxane_products),
        ("INFINI", infini_products),
        ("ASK Beauty — popularne produkty do twarzy", ask_products),
        ("SK Beauty — pielęgnacja twarzy", sk_beauty_products),
    )
    groups: list[tuple[str, list[dict[str, Any]]]] = []
    for label, builder in builders:
        products = builder()
        print(f"{label}: {len(products)} produktów")
        groups.append((label, products))

    all_products = merge_products([product for _, products in groups for product in products])
    add_downloads(all_products)
    logos = download_logos()
    for product in all_products:
        if product["brand"] in logos:
            product["brandLogoPath"] = logos[product["brand"]]
        product.pop("popularityRank", None)
    payload = {
        "reviewedAt": REVIEWED_AT,
        "count": len(all_products),
        "sources": [
            SKINFINITY_URL,
            BIODERMA_URL,
            CLAYLY_URL,
            FEDUA_URL,
            OPPOLINE_URL,
            MEDESTELLE_URL,
            TEOXANE_URL,
            INFINI_URL,
            ASK_URL,
            SK_BEAUTY_URL,
        ],
        "brandLogos": logos,
        "groups": [{"name": label, "count": len(products)} for label, products in groups],
        "products": all_products,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Zapisano {len(all_products)} produktów: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
