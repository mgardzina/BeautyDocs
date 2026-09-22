#!/usr/bin/env python3
"""Import official catalogues added to BeautyDocs on 2026-08-24.

The snapshot deliberately separates a product's brand from the shop that
publishes its price.  Only first-party brand pages and direct store cards are
used; comparison engines are never treated as offer sources.
"""

# ruff: noqa: RUF001 -- product text and matching patterns use Polish typography.

from __future__ import annotations

import html
import json
import re
import time
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "apps/api/app/services/partner_brand_catalogs.json"
CATALOG_DIR = PROJECT_ROOT / "public/beautydocs/catalog"
BRAND_DIR = PROJECT_ROOT / "public/beautydocs/brands"
REVIEWED_AT = "2026-08-24"

GLOW_CATALOG_URL = "https://glow360.pl/promocje-1"
DERMOMEDICA_URL = "https://pl.dermomedica.us/"
DERMOCITY_API_URL = "https://dermocity.com/wp-json/wc/store/v1/products"
AUTHENTIC_URL = "https://www.authenticbeautyconcept.pl/products.html"
BELNEA_URL = "https://belnea.pl/"
LAGUEL_URL = "https://www.laguel.pl/sklep/"
CAUDALIE_URL = "https://pl.caudalie.com/"
CAUDALIE_SITEMAP_URL = "https://pl.caudalie.com/sitemap.xml"

SUPABASE_URL = "https://ouctwnawgxhgpuoubqiv.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91Y3R3bmF3Z3hoZ3B1b3VicWl2Iiw"
    "icm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MjkxODYsImV4cCI6MjA3NzIwNTE4Nn0."
    "16_VxzI2LrHsRX0ep9xxyrzaLkirlPyC1Hd5JnD-PXw"
)


def fetch(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    attempts: int = 4,
) -> bytes:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 BeautyDocsCatalog/1.0",
                    "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.7",
                    **(headers or {}),
                },
            )
            with urlopen(request, timeout=75) as response:
                return response.read()
        except Exception as error:
            last_error = error
            if attempt + 1 < attempts:
                time.sleep(1.25 * (attempt + 1))
    raise RuntimeError(f"Nie udało się pobrać {url}: {last_error}") from last_error


def fetch_json(url: str, *, headers: dict[str, str] | None = None) -> Any:
    return json.loads(fetch(url, headers=headers))


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold()).replace("ł", "l")
    ascii_value = "".join(
        character for character in normalized if not unicodedata.combining(character)
    )
    return re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")


def clean_html(value: object) -> str:
    text = str(value or "")
    text = re.sub(r"<br\s*/?>|</p\s*>|</li\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return " ".join(html.unescape(text).split())


def sentence(value: object, fallback: str) -> str:
    text = clean_html(value)
    if not text:
        return fallback
    return text[:597] + "..." if len(text) > 600 else text


def text_values(value: object, *, limit: int = 12) -> list[str]:
    if isinstance(value, list):
        raw = [clean_html(item) for item in value]
    elif isinstance(value, str):
        raw = [clean_html(item) for item in re.split(r"[\n;,•]+", value)]
    else:
        raw = []
    return list(dict.fromkeys(item for item in raw if 2 < len(item) < 120))[:limit]


def price_from_minor(prices: object) -> float | None:
    if not isinstance(prices, dict):
        return None
    if prices.get("currency_code") != "PLN":
        return None
    try:
        return round(
            int(str(prices["price"])) / (10 ** int(prices.get("currency_minor_unit", 2))),
            2,
        )
    except (KeyError, TypeError, ValueError):
        return None


def direct_offer(
    seller: str,
    price: float,
    url: str,
    *,
    available: bool = True,
    shipping: float | None = None,
) -> dict[str, Any]:
    return {
        "seller": seller,
        "pricePln": round(float(price), 2),
        "shippingPricePln": shipping,
        "availability": "IN_STOCK" if available else "OUT_OF_STOCK",
        "sourceType": "STORE",
        "updatedAt": REVIEWED_AT,
        "url": url,
    }


def presentation_from(name: str, fallback: str = "1 szt.") -> str:
    matches = re.findall(
        r"(?:\d+\s*[×x]\s*)?\d+(?:[,.]\d+)?\s*(?:ml|g|kg|szt\.?|ampuł(?:ka|ki|ek)|capsules?)",
        name,
        flags=re.I,
    )
    return matches[-1].replace(".", "") if matches else fallback


def product_metadata(name: str, summary: str, category: str = "") -> dict[str, Any]:
    normalized = slugify(" ".join((name, summary, category)))
    category_name = "Kosmetyk do pielęgnacji"
    family = "Kosmetyk pielęgnacyjny"
    treatments = ["Pielęgnacja domowa"]
    areas = [{"code": "FACE", "label": "Skóra twarzy"}]
    uses: list[str] = []
    kind = "COSMETIC"

    if any(token in normalized for token in ("urzadzenie", "device", "maska-led", "tech")):
        category_name = "Urządzenie kosmetyczne"
        family = "Urządzenie do pielęgnacji"
        treatments = ["Pielęgnacja aparaturowa"]
        kind = "DEVICE"
    elif any(token in normalized for token in ("szampon", "hair", "wlos", "odzywka")):
        category_name = "Kosmetyk do włosów"
        family = "Pielęgnacja włosów"
        treatments = ["Pielęgnacja włosów"]
        areas = [{"code": "SCALP", "label": "Włosy i skóra głowy"}]
    elif any(token in normalized for token in ("cial", "body", "dloni", "rak-i-ciala")):
        category_name = "Kosmetyk do ciała"
        family = "Pielęgnacja ciała"
        treatments = ["Pielęgnacja ciała"]
        areas = [{"code": "BODY", "label": "Skóra ciała"}]
    elif any(token in normalized for token in ("eye", "oczu", "pod-oko", "powiek")):
        family = "Pielęgnacja okolicy oczu"
        treatments = ["Pielęgnacja okolicy oczu"]
        areas = [{"code": "EYES", "label": "Okolica oczu"}]
    elif any(token in normalized for token in ("lip", "ust")):
        family = "Pielęgnacja ust"
        treatments = ["Pielęgnacja ust"]
        areas = [{"code": "LIPS", "label": "Usta"}]

    family_terms = (
        (("spf", "sun", "uv"), "Ochrona przeciwsłoneczna", "Fotoprotekcja"),
        (("serum", "concentrate", "ampoule"), "Serum lub koncentrat", "Pielęgnacja serum"),
        (("cream", "krem", "creme"), "Krem pielęgnacyjny", "Pielęgnacja kremem"),
        (("tonic", "tonik", "lotion"), "Tonik lub esencja", "Tonizacja"),
        (
            ("clean", "wash", "zel", "mydlo", "foam", "szampon"),
            "Produkt oczyszczający",
            "Oczyszczanie",
        ),
        (("mask", "maska"), "Maska pielęgnacyjna", "Pielęgnacja maską"),
        (("peel", "kwas", "acid"), "Produkt złuszczający", "Eksfoliacja"),
    )
    for tokens, detected_family, treatment in family_terms:
        if any(token in normalized for token in tokens):
            family = detected_family
            treatments = list(dict.fromkeys([treatment, *treatments]))
            break

    use_terms = (
        (("nawil", "hydrat", "hyalur"), "Nawilżenie"),
        (
            ("anti-age", "zmarszcz", "retinol", "retinal", "peptide"),
            "Pielęgnacja przeciwstarzeniowa",
        ),
        (("przebarw", "bright", "glow", "radiance", "vitamin-c"), "Wyrównanie kolorytu"),
        (("tradzik", "acne", "purif", "sebum", "niedoskonal"), "Skóra z niedoskonałościami"),
        (("naczyn", "rumien", "rosacea", "redness"), "Skóra naczyniowa i zaczerwieniona"),
        (("barier", "regener", "repair", "ceramide"), "Wsparcie bariery skórnej"),
        (("antioxid", "antyoksyd"), "Ochrona antyoksydacyjna"),
    )
    for tokens, label in use_terms:
        if any(token in normalized for token in tokens):
            uses.append(label)
    if not uses:
        uses.append(treatments[0])
    return {
        "kind": kind,
        "productCategory": category_name,
        "productFamily": family,
        "manufacturerUses": uses,
        "treatmentCategories": treatments,
        "applicationAreas": areas,
    }


def image_suffix(data: bytes, source_url: str) -> str:
    if data.lstrip().startswith(b"<svg") or b"<svg" in data[:500]:
        return ".svg"
    if data.startswith(b"\x89PNG"):
        return ".png"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return ".webp"
    if data.startswith(b"\xff\xd8"):
        return ".jpg"
    suffix = Path(urlparse(source_url).path).suffix.lower()
    return suffix if suffix in {".webp", ".png", ".jpg", ".jpeg", ".svg"} else ".webp"


def download_asset(source_url: str, target_stem: Path) -> str:
    for suffix in (".webp", ".png", ".jpg", ".jpeg", ".svg"):
        existing = target_stem.with_suffix(suffix)
        if existing.exists() and existing.stat().st_size > 100:
            return "/" + str(existing.relative_to(PROJECT_ROOT / "public"))
    data = fetch(source_url)
    suffix = image_suffix(data, source_url)
    target = target_stem.with_suffix(suffix)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return "/" + str(target.relative_to(PROJECT_ROOT / "public"))


def add_downloads(products: list[dict[str, Any]]) -> None:
    # Authentic Beauty Concept exposes the exfoliating ritual as a bundle card
    # without a standalone media URL. Reuse the official product photo that is
    # already part of the bundle instead of dropping the card from the catalog.
    for product in products:
        if product.get("name") == "Detoksykujący Rytuał Peelingujący i Pędzel":
            fallback_path = (
                "/beautydocs/catalog/authentic-beauty-concept/"
                "zmyslowy-kremowy-peeling-do-skory-glowy-ciala-i-twarzy-250ml-1.webp"
            )
            product["imagePath"] = fallback_path
            product["imageAlt"] = f"{product['name']} — oficjalne zdjęcie produktu w zestawie"
            product["productImages"] = [
                {
                    "path": fallback_path,
                    "alt": product["imageAlt"],
                    "label": "Produkt",
                    "scale": 1.0,
                    "fit": "cover",
                }
            ]

    tasks: dict[Any, tuple[dict[str, Any], int]] = {}
    with ThreadPoolExecutor(max_workers=14) as executor:
        for product in products:
            if product.get("productImages") and product.get("imagePath"):
                continue
            source_images = product.pop("_sourceImages", [])
            if not isinstance(source_images, list):
                continue
            product["_attemptedImages"] = source_images[:3]
            directory = CATALOG_DIR / str(product["assetDirectory"])
            for index, url in enumerate(source_images[:3], start=1):
                if isinstance(url, str) and url.startswith("http"):
                    future = executor.submit(
                        download_asset,
                        url,
                        directory / f"{product['slug']}-{index}",
                    )
                    tasks[future] = (product, index)
        for future in as_completed(tasks):
            product, index = tasks[future]
            try:
                path = future.result()
            except Exception as error:
                print(f"Pominięto zdjęcie {product['slug']} #{index}: {error}")
                continue
            product.setdefault("_downloadedImages", []).append((index, path))

    for product in products:
        if product.get("productImages") and product.get("imagePath"):
            product.pop("assetDirectory", None)
            product.pop("_sourceImages", None)
            continue
        downloaded = sorted(product.pop("_downloadedImages", []))
        if not downloaded:
            attempted = product.pop("_attemptedImages", [])
            raise RuntimeError(
                f"Brak zdjęcia produktu: {product['brand']} / {product['name']} "
                f"(źródła: {attempted})"
            )
        images = [
            {
                "path": path,
                "alt": f"{product['name']} — oficjalne zdjęcie {index}",
                "label": "Produkt" if index == 1 else f"Zdjęcie {index}",
                "scale": 1.0,
                "fit": "cover",
            }
            for index, path in downloaded
        ]
        product["imagePath"] = images[0]["path"]
        product["imageAlt"] = images[0]["alt"]
        product["productImages"] = images
        product.pop("assetDirectory", None)
        product.pop("_attemptedImages", None)


def supabase_table(name: str) -> list[dict[str, Any]]:
    url = f"{SUPABASE_URL}/rest/v1/{name}?select=*&limit=1000"
    result = fetch_json(
        url,
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
    )
    if not isinstance(result, list):
        raise RuntimeError(f"Nieprawidłowa tabela Dermomedica: {name}")
    return [row for row in result if isinstance(row, dict)]


def woo_products(api_url: str) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    for page in range(1, 10):
        payload = fetch_json(f"{api_url}?per_page=100&page={page}")
        if not isinstance(payload, list):
            raise RuntimeError(f"Nieprawidłowy WooCommerce Store API: {api_url}")
        products.extend(row for row in payload if isinstance(row, dict))
        if len(payload) < 100:
            break
    return products


def glow_products() -> list[dict[str, Any]]:
    page = fetch(GLOW_CATALOG_URL).decode("utf-8", errors="replace")
    products: list[dict[str, Any]] = []
    for match in re.finditer(
        r'<article class="flex items-center flex-wrap h-full">(.*?)</article>',
        page,
        flags=re.S,
    ):
        card = match.group(1)
        link = re.search(r'href="(/[^"]+)"', card)
        image = re.search(r'<img alt="([^"]*)"[^>]+src="(https:[^"]+)"', card)
        title = re.search(r"<h3[^>]*>.*?<a[^>]*>(.*?)</a>", card, flags=re.S)
        price = re.search(r'text-error-600">([0-9\s]+,[0-9]{2})\s*zł', card)
        if not all((link, image, title, price)):
            continue
        name = clean_html(title.group(1))
        slug = slugify(link.group(1))
        summary = "Naturalny kosmetyk Pur Eden do codziennej pielęgnacji skóry."
        meta = product_metadata(name, summary)
        products.append(
            {
                "slug": slug,
                "name": name,
                "brand": "Pur Eden",
                "summary": summary,
                "presentation": presentation_from(name),
                **meta,
                "keyIngredients": [],
                "aliases": [name.replace("Pur Eden ", "")],
                "offers": [
                    direct_offer(
                        "Glow360",
                        float(price.group(1).replace(" ", "").replace(",", ".")),
                        urljoin("https://glow360.pl", link.group(1)),
                    )
                ],
                "sourceUrl": urljoin("https://glow360.pl", link.group(1)),
                "professionalOnly": False,
                "assetDirectory": "pur-eden",
                "_sourceImages": [image.group(2).replace("/450/", "/max/")],
            }
        )
    if len(products) < 15:
        raise RuntimeError(f"Glow360: oczekiwano co najmniej 15 produktów, jest {len(products)}")
    return products


def dermomedica_products() -> list[dict[str, Any]]:
    official = [row for row in supabase_table("products") if row.get("is_published")]
    variants = supabase_table("product_variants")
    gallery = supabase_table("product_images")
    subcategories = {row["id"]: row for row in supabase_table("product_subcategories")}
    links = supabase_table("product_subcategory_links")
    dermocity = woo_products(DERMOCITY_API_URL)
    store_by_slug = {str(row.get("slug", "")): row for row in dermocity}
    variants_by_product: dict[str, list[dict[str, Any]]] = defaultdict(list)
    gallery_by_product: dict[str, list[dict[str, Any]]] = defaultdict(list)
    subcategories_by_product: dict[str, list[str]] = defaultdict(list)
    for row in variants:
        variants_by_product[str(row.get("product_id"))].append(row)
    for row in gallery:
        gallery_by_product[str(row.get("product_id"))].append(row)
    for row in links:
        subcategory = subcategories.get(row.get("subcategory_id"), {})
        if subcategory.get("name"):
            subcategories_by_product[str(row.get("product_id"))].append(str(subcategory["name"]))

    products: list[dict[str, Any]] = []
    for row in official:
        product_id = str(row["id"])
        name = clean_html(row.get("name"))
        summary = sentence(
            row.get("short_description") or row.get("description"),
            "Profesjonalna karta produktu Dermomedica.",
        )
        categories = subcategories_by_product[product_id]
        category_text = " ".join(categories)
        meta = product_metadata(name, summary, category_text)
        product_variants = sorted(
            variants_by_product[product_id], key=lambda item: int(item.get("display_order") or 0)
        )
        chosen_variant = next(
            (
                variant
                for variant in product_variants
                if variant.get("id") == row.get("default_variant_id")
            ),
            next((variant for variant in product_variants if variant.get("buy_link")), None),
        )
        store_product: dict[str, Any] | None = None
        if chosen_variant and chosen_variant.get("buy_link"):
            store_slug = urlparse(str(chosen_variant["buy_link"])).path.rstrip("/").split("/")[-1]
            store_product = store_by_slug.get(store_slug)
        offer_price = price_from_minor(store_product.get("prices") if store_product else None)
        offers = []
        if store_product and offer_price is not None:
            offers.append(
                direct_offer(
                    "Dermocity",
                    offer_price,
                    str(store_product["permalink"]),
                    available=bool(store_product.get("is_in_stock")),
                )
            )
        source_images = [
            str(variant.get("image_url"))
            for variant in product_variants
            if variant.get("image_url")
        ]
        source_images.extend(
            str(image.get("image_url"))
            for image in sorted(
                gallery_by_product[product_id],
                key=lambda item: int(item.get("display_order") or 0),
            )
            if image.get("image_url")
        )
        presentation = (
            clean_html(chosen_variant.get("capacity"))
            if chosen_variant
            else presentation_from(name)
        )
        professional = "pro" in slugify(category_text) or "profesjonal" in slugify(
            " ".join((summary, str(row.get("description") or "")))
        )
        products.append(
            {
                "slug": str(row["slug"]),
                "name": name,
                "brand": "Dermomedica",
                "summary": summary,
                "presentation": presentation or "1 szt.",
                **meta,
                "manufacturerUses": text_values(row.get("indications")) or meta["manufacturerUses"],
                "treatmentCategories": list(
                    dict.fromkeys([*categories, *meta["treatmentCategories"]])
                )[:10],
                "keyIngredients": text_values(row.get("active_ingredients")),
                "aliases": [str(row.get("sku") or "")],
                "offers": offers,
                "sourceUrl": f"https://pl.dermomedica.us/produkt/{row['slug']}",
                "professionalOnly": professional,
                "assetDirectory": "dermomedica",
                "_sourceImages": list(dict.fromkeys(source_images)),
                "skinTypes": categories,
            }
        )
    if len(products) < 150:
        raise RuntimeError(f"Dermomedica: niepełny katalog ({len(products)})")
    return products


def authentic_products() -> list[dict[str, Any]]:
    page = fetch(AUTHENTIC_URL).decode("utf-8", errors="replace")
    found: dict[str, dict[str, Any]] = {}
    for attribute in re.findall(r'data-components-params-addtocartd2c="([^"]+)"', page, flags=re.S):
        try:
            payload = json.loads(html.unescape(attribute))
        except json.JSONDecodeError:
            continue
        product_id = str(payload.get("productId") or "")
        name = clean_html(payload.get("productName"))
        image_url = str(payload.get("imageUrl") or "")
        if not product_id or not name:
            continue
        if "detoksykujacy-rytual" in slugify(name):
            image_url = (
                "https://dm.henkel-dam.com/is/image/henkel/ABC_Sensorial_Cream_Scrub_250ml_076"
            )
        if not image_url.startswith("http"):
            continue
        product_url = str(payload.get("productUrl") or "")
        product_url = product_url.replace("/content/heliux/beauty/abc-shop/pl/pl", "")
        product_url = urljoin("https://www.authenticbeautyconcept.pl", product_url)
        category = clean_html(payload.get("productCategory"))
        summary = (
            f"Produkt {category.lower()} marki Authentic Beauty Concept."
            if category
            else ("Profesjonalny kosmetyk do pielęgnacji włosów Authentic Beauty Concept.")
        )
        meta = product_metadata(name, summary, category)
        price = float(str(payload.get("price") or "0"))
        sale = (
            payload.get("saleAttributes") if isinstance(payload.get("saleAttributes"), dict) else {}
        )
        presentation = (
            f"{sale.get('unitAmount')} {sale.get('unitName')}"
            if sale.get("unitAmount") and sale.get("unitName")
            else presentation_from(name)
        )
        entry = {
            "slug": slugify(name),
            "name": name,
            "brand": "Authentic Beauty Concept",
            "summary": summary,
            "presentation": presentation,
            **meta,
            "keyIngredients": [],
            "aliases": [str(payload.get("sku") or "")],
            "offers": [direct_offer("Authentic Beauty Concept", price, product_url)]
            if price
            else [],
            "sourceUrl": product_url,
            "professionalOnly": False,
            "assetDirectory": "authentic-beauty-concept",
            "_sourceImages": [f"{image_url}?fmt=webp&qlt=90&wid=900"],
        }
        if "detoksykujacy-rytual" in slugify(name):
            fallback_path = (
                "/beautydocs/catalog/authentic-beauty-concept/"
                "zmyslowy-kremowy-peeling-do-skory-glowy-ciala-i-twarzy-250ml-1.webp"
            )
            entry["imagePath"] = fallback_path
            entry["imageAlt"] = f"{name} — oficjalne zdjęcie produktu w zestawie"
            entry["productImages"] = [
                {
                    "path": fallback_path,
                    "alt": entry["imageAlt"],
                    "label": "Produkt",
                    "scale": 1.0,
                    "fit": "cover",
                }
            ]
        found[product_id] = entry
    products = list(found.values())
    if len(products) < 80:
        raise RuntimeError(f"Authentic Beauty Concept: niepełny katalog ({len(products)})")
    return products


def belnea_products() -> list[dict[str, Any]]:
    payload = fetch_json("https://belnea.pl/products.json?limit=250")
    rows = payload.get("products", []) if isinstance(payload, dict) else []
    products: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = clean_html(row.get("title"))
        summary = sentence(row.get("body_html"), "Profesjonalny kosmetyk Belnea.")
        meta = product_metadata(name, summary)
        variant = next(
            (variant for variant in row.get("variants", []) if variant.get("available")),
            next(iter(row.get("variants", [])), None),
        )
        price = float(variant["price"]) if variant and variant.get("price") else None
        url = f"https://belnea.pl/products/{row['handle']}"
        products.append(
            {
                "slug": str(row["handle"]),
                "name": name,
                "brand": "Belnea",
                "summary": summary,
                "presentation": presentation_from(" ".join((name, summary))),
                **meta,
                "keyIngredients": [],
                "aliases": [],
                "offers": [
                    direct_offer("Belnea", price, url, available=bool(variant.get("available")))
                ]
                if price and variant
                else [],
                "sourceUrl": url,
                "professionalOnly": "profesjonal" in slugify(summary),
                "assetDirectory": "belnea",
                "_sourceImages": [
                    str(image["src"])
                    for image in row.get("images", [])
                    if isinstance(image, dict) and image.get("src")
                ],
            }
        )
    if len(products) < 20:
        raise RuntimeError(f"Belnea: niepełny katalog ({len(products)})")
    return products


def laguel_products() -> list[dict[str, Any]]:
    rows = woo_products("https://www.laguel.pl/wp-json/wc/store/v1/products")
    products: list[dict[str, Any]] = []
    excluded = {"voucher", "uslugi"}
    for row in rows:
        category_slugs = {
            str(category.get("slug"))
            for category in row.get("categories", [])
            if isinstance(category, dict)
        }
        if excluded & category_slugs or str(row.get("slug", "")).startswith("przedplata"):
            continue
        name = clean_html(row.get("name"))
        normalized = slugify(name)
        if "forlle" in normalized:
            brand = "Forlle'd"
        elif "neauvia" in normalized:
            brand = "Neauvia"
        else:
            brand = "La Guèl"
        summary = sentence(
            row.get("short_description") or row.get("description"),
            f"Kosmetyk marki {brand} dostępny w sklepie La Guèl.",
        )
        category = " ".join(
            clean_html(item.get("name"))
            for item in row.get("categories", [])
            if isinstance(item, dict)
        )
        meta = product_metadata(name, summary, category)
        price = price_from_minor(row.get("prices"))
        products.append(
            {
                "slug": str(row["slug"]),
                "name": name,
                "brand": brand,
                "summary": summary,
                "presentation": presentation_from(name),
                **meta,
                "keyIngredients": [],
                "aliases": [clean_html(row.get("sku"))],
                "offers": [
                    direct_offer(
                        "La Guèl",
                        price,
                        str(row["permalink"]),
                        available=bool(row.get("is_in_stock")),
                    )
                ]
                if price is not None
                else [],
                "sourceUrl": str(row["permalink"]),
                "professionalOnly": False,
                "assetDirectory": "laguel",
                "_sourceImages": [
                    str(image.get("thumbnail") or image.get("src"))
                    for image in row.get("images", [])
                    if isinstance(image, dict) and (image.get("thumbnail") or image.get("src"))
                ],
            }
        )
    if len(products) < 14:
        raise RuntimeError(f"La Guèl: niepełny katalog kosmetyków ({len(products)})")
    return products


def caudalie_product(url: str) -> dict[str, Any] | None:
    page = fetch(url).decode("utf-8", errors="replace")
    match = re.search(
        r'<script type="application/ld\+json" id="json-ld-product">(.*?)</script>',
        page,
        flags=re.S,
    )
    if not match:
        return None
    data = json.loads(match.group(1))
    name = clean_html(data.get("name"))
    summary = sentence(data.get("description"), "Oficjalny kosmetyk Caudalie.")
    category = clean_html(data.get("category"))
    meta = product_metadata(name, summary, category)
    properties = {
        clean_html(item.get("name")): clean_html(item.get("value"))
        for item in data.get("additionalProperty", [])
        if isinstance(item, dict)
    }
    key_ingredients = text_values(properties.get("Najważniejsze składniki", ""))
    skin_types = text_values(properties.get("Rodzaju skóry", ""))
    needs = text_values(properties.get("Potrzebuję", ""))
    if needs:
        meta["manufacturerUses"] = needs
    offer_data = data.get("offers", {})
    if isinstance(offer_data, list):
        offer_data = offer_data[0] if offer_data else {}
    offers: list[dict[str, Any]] = []
    if isinstance(offer_data, dict) and offer_data.get("price"):
        shipping = None
        shipping_details = offer_data.get("shippingDetails")
        if isinstance(shipping_details, dict):
            shipping_rate = shipping_details.get("shippingRate", {})
            amount = (
                shipping_rate.get("shippingRate", {}) if isinstance(shipping_rate, dict) else {}
            )
            if isinstance(amount, dict) and amount.get("value") is not None:
                shipping = float(amount["value"])
        offers.append(
            direct_offer(
                "Caudalie",
                float(offer_data["price"]),
                str(offer_data.get("url") or url),
                available="OutOfStock" not in str(offer_data.get("availability")),
                shipping=shipping,
            )
        )
    images = [
        str(image.get("url"))
        for image in data.get("image", [])
        if isinstance(image, dict) and image.get("url")
    ]
    if not images:
        # Bundle cards occasionally omit the image array from JSON-LD. Their
        # official gallery URL is still present in the rendered page payload.
        images = list(
            dict.fromkeys(
                candidate.replace("\\/", "/").replace("\\u0026", "&")
                for candidate in re.findall(
                    r"https://caudalie-europe\.imgix\.net/media/catalog/product/"
                    r"[^\"'\\\s<]+",
                    html.unescape(page),
                )
            )
        )
    normalized_images = [re.sub(r"([?&])w=1200\b", r"\1w=900", image) for image in images]
    if name == "Globalna Rutyna Przeciwstarzeniowa" and not normalized_images:
        # The current JSON-LD omits the hero image although the official page
        # still publishes it in the gallery markup.
        normalized_images = [
            "https://caudalie-europe.imgix.net/media/catalog/product/b/u/"
            "bundle-pc-2025.jpg?auto=format%2Ccompress&cs=srgb&fm=auto&w=900"
        ]
    slug_path = urlparse(str(offer_data.get("url") or url)).path.rstrip("/")
    base_slug = slugify(slug_path.split("/")[-1].removesuffix(".html"))
    variant_key = clean_html(data.get("gtin13")) or clean_html(data.get("productGroupID"))
    slug = f"{base_slug}-{slugify(variant_key)}" if variant_key else base_slug
    presentation = clean_html(data.get("size")) or presentation_from(name)
    return {
        "slug": slug,
        "name": name,
        "brand": "Caudalie",
        "summary": summary,
        "presentation": presentation,
        **meta,
        "manufacturerUses": meta["manufacturerUses"],
        "treatmentCategories": list(dict.fromkeys([category, *meta["treatmentCategories"]]))
        if category
        else meta["treatmentCategories"],
        "keyIngredients": key_ingredients,
        "aliases": [clean_html(data.get("gtin13")), clean_html(data.get("productGroupID"))],
        "offers": offers,
        "sourceUrl": str(offer_data.get("url") or url),
        "professionalOnly": False,
        "assetDirectory": "caudalie",
        "_sourceImages": normalized_images,
        "skinTypes": skin_types,
        "series": properties.get("Kolekcja") or category,
    }


def caudalie_products() -> list[dict[str, Any]]:
    sitemap_from_cache = False
    try:
        sitemap = fetch(CAUDALIE_SITEMAP_URL).decode("utf-8", errors="replace")
    except RuntimeError:
        cached_sitemap = Path("/tmp/caudalie_sitemap")
        sitemap = cached_sitemap.read_text(encoding="utf-8") if cached_sitemap.exists() else ""
        sitemap_from_cache = True
    urls = list(
        dict.fromkeys(
            html.unescape(url)
            for url in re.findall(r"<loc>(https://pl\.caudalie\.com/p/[^<]+)</loc>", sitemap)
        )
    )
    if not urls or sitemap_from_cache:
        return cached_caudalie_products(sitemap)
    products: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=14) as executor:
        futures = {executor.submit(caudalie_product, url): url for url in urls}
        for future in as_completed(futures):
            try:
                product = future.result()
            except Exception as error:
                print(f"Pominięto kartę Caudalie {futures[future]}: {error}")
                continue
            if product:
                products.append(product)
    unique = {product["slug"]: product for product in products}
    products = sorted(unique.values(), key=lambda item: item["name"])
    # The sitemap lists query-string configurations of the same SKU.  The
    # public JSON-LD currently resolves those 347 URLs to 103 unique GTIN cards.
    if len(products) < 100:
        return cached_caudalie_products(sitemap)
    return products


def cached_caudalie_products(sitemap: str) -> list[dict[str, Any]]:
    """Recover the already downloaded official cards after a temporary CDN limit."""

    source_urls = [
        html.unescape(url)
        for url in re.findall(r"<loc>(https://pl\.caudalie\.com/p/[^<]+)</loc>", sitemap)
    ]
    groups: dict[str, list[Path]] = defaultdict(list)
    for path in (CATALOG_DIR / "caudalie").glob("*"):
        match = re.match(r"(.+)-(\d+)\.(?:webp|png|jpe?g)$", path.name, flags=re.I)
        if match:
            groups[match.group(1)].append(path)

    products: list[dict[str, Any]] = []
    for base, paths in sorted(groups.items()):
        without_gtin = re.sub(r"-\d{13}$", "", base)
        source_url = next(
            (
                url
                for url in source_urls
                if slugify(urlparse(url).path.split("/")[-1].removesuffix(".html")) == without_gtin
            ),
            CAUDALIE_URL,
        )
        code = ""
        if source_url != CAUDALIE_URL:
            parts = urlparse(source_url).path.split("/")
            code = slugify(parts[2]) if len(parts) > 3 else ""
        name_slug = without_gtin
        if code and name_slug.endswith(f"-{code}"):
            name_slug = name_slug[: -(len(code) + 1)]
        name = " ".join(part.capitalize() for part in name_slug.split("-"))
        summary = "Oficjalny produkt Caudalie do pielęgnacji skóry lub włosów."
        meta = product_metadata(name, summary)
        ordered_paths = sorted(paths, key=lambda path: int(path.stem.rsplit("-", 1)[-1]))
        images = [
            {
                "path": "/" + str(path.relative_to(PROJECT_ROOT / "public")),
                "alt": f"{name} — oficjalne zdjęcie {index}",
                "label": "Produkt" if index == 1 else f"Zdjęcie {index}",
                "scale": 1.0,
                "fit": "cover",
            }
            for index, path in enumerate(ordered_paths, start=1)
        ]
        products.append(
            {
                "slug": base,
                "name": name,
                "brand": "Caudalie",
                "summary": summary,
                "presentation": presentation_from(name),
                **meta,
                "keyIngredients": [],
                "aliases": [],
                "offers": [],
                "sourceUrl": source_url,
                "professionalOnly": False,
                "imagePath": images[0]["path"],
                "imageAlt": images[0]["alt"],
                "productImages": images,
            }
        )
    if len(products) < 100:
        raise RuntimeError(f"Caudalie: niepełny lokalny katalog ({len(products)})")
    return products


def download_logos() -> dict[str, str]:
    sources = {
        "Pur Eden": (
            "https://media-manager.sellaio.com/v1/content/6977343b10fc162384a16556/"
            "logo/78092498744c79c7cc492bff9cb4ca5765b9d13fea841c295dd62c79c94e6e3f/"
            "max/pure-eden-w-polsce-kosmetyki-z-francji-kremy-i-sera.webp",
            "pur-eden",
        ),
        "Dermomedica": ("https://dermomedica.pl/logo.png", "dermomedica"),
        "Authentic Beauty Concept": (
            "https://dm.henkel-dam.com/is/image/henkel/abc-logo?fmt=png-alpha&qlt=90&wid=800",
            "authentic-beauty-concept",
        ),
        "Belnea": (
            "https://belnea.pl/cdn/shop/files/Belnea_Logo_1.png?v=1674647733&width=800",
            "belnea",
        ),
        "La Guèl": (
            "https://www.laguel.pl/wp-content/uploads/2022/08/logo_bez-tla.png",
            "la-guel",
        ),
        "Caudalie": ("https://pl.caudalie.com/logo.svg", "caudalie"),
    }
    result: dict[str, str] = {}
    for brand, (url, filename) in sources.items():
        result[brand] = download_asset(url, BRAND_DIR / filename)
    return result


def main() -> None:
    groups: list[tuple[str, list[dict[str, Any]]]] = []
    builders = (
        ("Glow360 / Pur Eden", glow_products),
        ("Dermomedica", dermomedica_products),
        ("Authentic Beauty Concept", authentic_products),
        ("Belnea", belnea_products),
        ("La Guèl", laguel_products),
        ("Caudalie", caudalie_products),
    )
    for label, builder in builders:
        products = builder()
        print(f"{label}: {len(products)} produktów")
        groups.append((label, products))

    all_products = [product for _, products in groups for product in products]
    add_downloads(all_products)
    logos = download_logos()
    payload = {
        "reviewedAt": REVIEWED_AT,
        "count": len(all_products),
        "sources": [
            GLOW_CATALOG_URL,
            DERMOMEDICA_URL,
            "https://dermocity.com/",
            AUTHENTIC_URL,
            BELNEA_URL,
            LAGUEL_URL,
            CAUDALIE_URL,
        ],
        "brandLogos": logos,
        "groups": [{"name": label, "count": len(products)} for label, products in groups],
        "products": all_products,
    }
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Zapisano {len(all_products)} produktów: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
