#!/usr/bin/env python3
"""Build the BeautyDocs INSTYTUTUM catalogue from first-party product data.

Names, short descriptions, current EUR reference prices and imagery come from
the official INSTYTUTUM storefront API.  Direct PLN offers are matched only to
public product cards from individual Polish stores; comparison engines are not
used as price sources.
"""

from __future__ import annotations

import json
import re
import unicodedata
from difflib import SequenceMatcher
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import quote, urljoin, urlparse, urlsplit, urlunsplit
from urllib.request import Request, urlopen

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "apps/api/app/services/instytutum_catalog.json"
IMAGE_DIR = PROJECT_ROOT / "public/beautydocs/catalog/instytutum"
LOGO_PATH = PROJECT_ROOT / "public/beautydocs/brands/instytutum.svg"

OFFICIAL_API_URL = "https://instytutum.com/api/"
OFFICIAL_CATALOG_URL = "https://instytutum.com/en/category/"
OFFICIAL_ASSET_BASE_URL = "https://instytutum.com/"
OFFICIAL_LOGO_URL = "https://instytutum.com/images/logo-header.svg"
AIYA_PRODUCTS_URL = (
    "https://www.aiyabeauty.pl/collections/instytutum/products.json?limit=250"
)
LUXDERMA_PRODUCTS_URL = (
    "https://luxdermastore.pl/collections/all/products.json?limit=250"
)
REVIEWED_AT = "2026-08-24"
EXPECTED_PRODUCT_COUNT = 52

PRODUCTS_QUERY = """
query Products($options: ProductListOptions) {
  products(options: $options) {
    totalItems
    items {
      id
      slug
      name
      translations { languageCode name slug description }
      variants {
        id sku name price priceWithTax originalPrice currencyCode
        featuredAsset { source customFields { alt title } }
        assets { source customFields { alt title } }
      }
      collections { id translations { languageCode name } }
      customFields {
        productType { index value slug }
        availabilityType
        packageImg { source }
      }
    }
  }
}
"""


def fetch(
    url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None
) -> bytes:
    request = Request(
        url,
        data=data,
        headers={
            "User-Agent": "Mozilla/5.0 BeautyDocsCatalog/1.0",
            **(headers or {}),
        },
        method="POST" if data is not None else "GET",
    )
    with urlopen(request, timeout=60) as response:  # noqa: S310 - reviewed HTTPS sources
        return response.read()


def fetch_official_products() -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    total = None
    for skip in (0, 30):
        payload = json.dumps(
            {
                "query": PRODUCTS_QUERY,
                "variables": {
                    "options": {
                        "take": 30,
                        "skip": skip,
                        "filter": {"storefronts": {"eq": True}},
                    }
                },
            }
        ).encode("utf-8")
        response = json.loads(
            fetch(
                OFFICIAL_API_URL,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "vendure-token": "instytutum.com",
                    "x-languagecode": "en",
                },
            )
        )
        if response.get("errors"):
            raise RuntimeError(f"Błąd oficjalnego API INSTYTUTUM: {response['errors']}")
        page = response["data"]["products"]
        total = int(page["totalItems"])
        products.extend(page["items"])
    if total != EXPECTED_PRODUCT_COUNT or len(products) != EXPECTED_PRODUCT_COUNT:
        raise RuntimeError(
            f"Oczekiwano {EXPECTED_PRODUCT_COUNT} produktów INSTYTUTUM, "
            f"API zwróciło {total=}, pobrano {len(products)}"
        )
    return products


def fetch_shopify_products(url: str) -> list[dict[str, Any]]:
    payload = json.loads(fetch(url))
    products = payload.get("products", [])
    if not isinstance(products, list):
        raise RuntimeError(f"Nieprawidłowy publiczny katalog Shopify: {url}")
    return [product for product in products if isinstance(product, dict)]


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold()).replace("ł", "l")
    ascii_value = "".join(
        character for character in normalized if not unicodedata.combining(character)
    )
    return re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")


def normalized_product_name(value: str) -> str:
    value = re.sub(r"^instytutum\s+", "", value, flags=re.I)
    normalized = slugify(value)
    edition_tokens = {
        "next",
        "gen",
        "classic",
        "4d",
        "ha",
        "water",
        "burst",
        "plant",
        "based",
    }
    return "-".join(
        token for token in normalized.split("-") if token not in edition_tokens
    )


def is_compatible_offer(official_name: str, shop_name: str) -> bool:
    official = normalized_product_name(official_name)
    shop = normalized_product_name(shop_name)
    if "deluxe-size" in slugify(official_name):
        return False
    official_tokens = set(official.split("-"))
    shop_tokens = set(shop.split("-"))
    if bool(official_tokens & {"pod", "refill"}) != bool(
        shop_tokens & {"pod", "refill"}
    ):
        return False
    if ("set" in official_tokens) != ("set" in shop_tokens):
        return False
    return SequenceMatcher(None, official, shop).ratio() >= 0.78


def matching_shop_product(
    official_name: str, shop_products: list[dict[str, Any]]
) -> dict[str, Any] | None:
    compatible = [
        product
        for product in shop_products
        if is_compatible_offer(official_name, str(product.get("title", "")))
    ]
    if not compatible:
        return None
    official = normalized_product_name(official_name)
    return max(
        compatible,
        key=lambda product: SequenceMatcher(
            None, official, normalized_product_name(str(product.get("title", "")))
        ).ratio(),
    )


def clean_html(value: str) -> list[str]:
    text = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return [
        " ".join(part.split())
        for part in unescape(text).splitlines()
        if " ".join(part.split())
    ]


def translation(product: dict[str, Any], language: str = "pl") -> dict[str, Any]:
    translations = product.get("translations", [])
    return next(
        (
            value
            for value in translations
            if isinstance(value, dict) and value.get("languageCode") == language
        ),
        next((value for value in translations if isinstance(value, dict)), {}),
    )


def presentation(product: dict[str, Any], description_parts: list[str]) -> str:
    for part in reversed(description_parts):
        if re.fullmatch(
            r"\d+(?:[,.]\d+)?\s*(?:ml|g|szt\.?|capsules?)", part, flags=re.I
        ):
            return part.upper().replace(".", "")
    name = str(product.get("name", ""))
    if "set" in slugify(name) or "protocol" in slugify(name):
        return "Zestaw"
    if "fridge" in slugify(name):
        return "1 urządzenie"
    if "diagnostic-test" in slugify(name):
        return "1 usługa"
    return "1 szt."


def metadata(product: dict[str, Any], summary: str) -> dict[str, Any]:
    name = str(product.get("name", ""))
    normalized = slugify(name)
    product_type = ((product.get("customFields") or {}).get("productType") or {}).get(
        "slug"
    ) or ""

    family_by_type = {
        "cleansing": "Produkt do oczyszczania",
        "toning": "Tonik lub mgiełka",
        "serum-or-oil": "Serum lub olejek",
        "cream": "Krem do twarzy",
        "eye-care": "Pielęgnacja okolicy oczu",
        "spf": "Ochrona przeciwsłoneczna",
        "lip-care": "Pielęgnacja ust",
        "masks": "Maska do twarzy",
        "peeling": "Peeling lub płatki złuszczające",
        "refills": "Wkład uzupełniający",
        "deluxe-size": "Miniatura kosmetyku",
    }
    family = family_by_type.get(product_type, "Zestaw pielęgnacyjny")
    category = "Kosmetyk do pielęgnacji twarzy"
    categories = ["Pielęgnacja twarzy"]
    areas = [{"code": "FACE", "label": "Skóra twarzy"}]

    if product_type == "eye-care":
        categories.insert(0, "Pielęgnacja okolicy oczu")
        areas = [{"code": "EYES", "label": "Okolica oczu"}]
    elif product_type == "lip-care":
        categories.insert(0, "Pielęgnacja ust")
        areas = [{"code": "LIPS", "label": "Usta"}]
    elif product_type == "spf":
        categories.insert(0, "Ochrona przeciwsłoneczna")
    elif product_type == "cleansing":
        categories.insert(0, "Oczyszczanie skóry")
    elif product_type == "peeling":
        categories.insert(0, "Złuszczanie")
    elif product_type == "masks":
        categories.insert(0, "Maski")
    elif "fridge" in normalized:
        category = "Akcesorium kosmetyczne"
        family = "Lodówka kosmetyczna"
        categories = ["Akcesoria kosmetyczne"]
        areas = []
    elif "diagnostic-test" in normalized:
        category = "Usługa kosmetologiczna"
        family = "Diagnostyka skóry"
        categories = ["Diagnostyka skóry"]
        areas = [{"code": "FACE", "label": "Skóra twarzy"}]
    elif "set" in normalized or "protocol" in normalized:
        category = "Zestaw kosmetyków"
        categories.insert(0, "Zestawy pielęgnacyjne")

    ingredients: list[str] = []
    ingredient_rules = (
        (("retinol", "retinoil"), "Retinoidy"),
        (("vitamin-c", "c-illuminating"), "Witamina C"),
        (("hyalur", "hydrafusion"), "Kwas hialuronowy"),
        (("ceramide", "superbiotic"), "Ceramidy"),
        (("multi-acid", "resurfacing", "peel"), "Kwasy złuszczające"),
        (("spf", "sunscription"), "Filtry UV"),
    )
    searchable = slugify(f"{name} {summary}")
    for tokens, label in ingredient_rules:
        if any(token in searchable for token in tokens):
            ingredients.append(label)

    uses = [summary] if summary else ["Pielęgnacja zgodna z protokołem marki"]
    return {
        "productCategory": category,
        "productFamily": family,
        "manufacturerUses": uses,
        "treatmentCategories": list(dict.fromkeys(categories)),
        "applicationAreas": areas,
        "keyIngredients": ingredients,
        "skinTypes": ["Dobierz do potrzeb skóry"],
    }


def variant_price(product: dict[str, Any]) -> dict[str, Any]:
    variants = product.get("variants", [])
    if not variants:
        raise RuntimeError(f"Produkt bez wariantu: {product.get('name')}")
    variant = variants[0]
    price_minor = variant.get("priceWithTax") or variant.get("price")
    if not isinstance(price_minor, int | float):
        raise RuntimeError(f"Brak oficjalnej ceny: {product.get('name')}")
    original_minor = variant.get("originalPrice")
    return {
        "amount": round(float(price_minor) / 100, 2),
        "originalAmount": (
            round(float(original_minor) / 100, 2)
            if isinstance(original_minor, int | float) and original_minor > price_minor
            else None
        ),
        "currency": str(variant.get("currencyCode") or "EUR"),
        "seller": "INSTYTUTUM",
        "availability": str(
            (product.get("customFields") or {}).get("availabilityType") or "UNKNOWN"
        ),
        "url": f"https://instytutum.com/en/product/{product['slug']}/",
        "updatedAt": REVIEWED_AT,
    }


def shop_offer(
    shop_product: dict[str, Any] | None,
    *,
    seller: str,
    base_url: str,
) -> dict[str, Any] | None:
    if shop_product is None:
        return None
    variants = shop_product.get("variants", [])
    if not variants or not isinstance(variants[0], dict):
        return None
    variant = variants[0]
    try:
        price = float(variant["price"])
    except (KeyError, TypeError, ValueError):
        return None
    handle = str(shop_product.get("handle", "")).strip()
    if not handle:
        return None
    return {
        "seller": seller,
        "pricePln": price,
        "shippingPricePln": None,
        "availability": "IN_STOCK" if variant.get("available") else "OUT_OF_STOCK",
        "url": f"{base_url.rstrip('/')}/products/{handle}",
        "sourceType": "STORE",
        "updatedAt": REVIEWED_AT,
    }


def asset_sources(product: dict[str, Any]) -> list[tuple[str, str]]:
    variant = product["variants"][0]
    values: list[tuple[str, str]] = []
    for asset in [variant.get("featuredAsset"), *(variant.get("assets") or [])]:
        if not isinstance(asset, dict) or not asset.get("source"):
            continue
        raw_url = urljoin(OFFICIAL_ASSET_BASE_URL, str(asset["source"]))
        parsed_url = urlsplit(raw_url)
        url = urlunsplit(
            (
                parsed_url.scheme,
                parsed_url.netloc,
                quote(parsed_url.path, safe="/%"),
                parsed_url.query,
                parsed_url.fragment,
            )
        )
        fields = asset.get("customFields") or {}
        alt = str(fields.get("alt") or fields.get("title") or product["name"])
        if all(existing_url != url for existing_url, _ in values):
            values.append((url, alt))
        if len(values) == 3:
            break
    if not values:
        package = (product.get("customFields") or {}).get("packageImg") or {}
        if package.get("source"):
            values.append(
                (
                    urljoin(OFFICIAL_ASSET_BASE_URL, str(package["source"])),
                    product["name"],
                )
            )
    return values


def local_asset_path(product_id: str, index: int, source_url: str) -> Path:
    suffix = Path(urlparse(source_url).path).suffix.lower()
    if suffix not in {".webp", ".png", ".jpg", ".jpeg", ".avif"}:
        suffix = ".webp"
    return IMAGE_DIR / f"{product_id}-{index}{suffix}"


def main() -> None:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    LOGO_PATH.parent.mkdir(parents=True, exist_ok=True)

    official_products = fetch_official_products()
    aiya_products = fetch_shopify_products(AIYA_PRODUCTS_URL)
    luxderma_products = [
        product
        for product in fetch_shopify_products(LUXDERMA_PRODUCTS_URL)
        if str(product.get("vendor", "")).casefold() == "instytutum"
    ]
    if len(aiya_products) < 20 or len(luxderma_products) < 15:
        raise RuntimeError("Niepełny publiczny katalog polskich ofert INSTYTUTUM")

    LOGO_PATH.write_bytes(fetch(OFFICIAL_LOGO_URL))
    output_products: list[dict[str, Any]] = []
    for official in official_products:
        product_id = str(official["id"])
        pl = translation(official, "pl")
        description_parts = clean_html(str(pl.get("description") or ""))
        summary_parts = [
            part
            for part in description_parts
            if not re.fullmatch(r"\d+(?:[,.]\d+)?\s*(?:ml|g|szt\.?)", part, flags=re.I)
        ]
        summary = (
            summary_parts[0]
            if summary_parts
            else str(pl.get("name") or official["name"])
        )
        product_meta = metadata(official, summary)

        images: list[dict[str, Any]] = []
        for index, (source_url, alt) in enumerate(asset_sources(official), start=1):
            destination = local_asset_path(product_id, index, source_url)
            if not destination.is_file() or destination.stat().st_size == 0:
                destination.write_bytes(fetch(source_url))
            images.append(
                {
                    "path": f"/beautydocs/catalog/instytutum/{destination.name}",
                    "alt": alt,
                    "label": "Oficjalne zdjęcie produktu"
                    if index == 1
                    else f"Zdjęcie {index}",
                    "scale": 1.0,
                    "fit": "cover",
                }
            )
        if not images:
            raise RuntimeError(f"Brak oficjalnego zdjęcia produktu {official['name']}")

        offers = [
            offer
            for offer in (
                shop_offer(
                    matching_shop_product(str(official["name"]), aiya_products),
                    seller="Aiya Beauty Care",
                    base_url="https://www.aiyabeauty.pl",
                ),
                shop_offer(
                    matching_shop_product(str(official["name"]), luxderma_products),
                    seller="LuxDermaStore",
                    base_url="https://luxdermastore.pl",
                ),
            )
            if offer is not None
        ]

        collections = []
        for collection in official.get("collections", []):
            names = [
                item.get("name")
                for item in collection.get("translations", [])
                if isinstance(item, dict) and item.get("languageCode") == "pl"
            ]
            if names and names[0]:
                collections.append(str(names[0]))

        product_url = f"https://instytutum.com/en/product/{official['slug']}/"
        output_products.append(
            {
                "id": product_id,
                "slug": str(official["slug"]),
                "name": str(pl.get("name") or official["name"]),
                "summary": summary,
                "presentation": presentation(official, description_parts),
                **product_meta,
                "aliases": list(
                    dict.fromkeys(
                        [
                            str(official["name"]),
                            "INSTYTUTUM",
                            str(
                                (official.get("customFields") or {}).get("productType")
                                or ""
                            ),
                            *collections,
                        ]
                    )
                ),
                "sourceUrl": product_url,
                "imagePath": images[0]["path"],
                "imageAlt": images[0]["alt"],
                "productImages": images,
                "offers": offers,
                "officialReferencePrice": variant_price(official),
            }
        )

    snapshot = {
        "source": OFFICIAL_CATALOG_URL,
        "officialApi": OFFICIAL_API_URL,
        "reviewedAt": REVIEWED_AT,
        "count": len(output_products),
        "priceSources": [AIYA_PRODUCTS_URL, LUXDERMA_PRODUCTS_URL],
        "products": output_products,
    }
    OUTPUT_PATH.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Zapisano {len(output_products)} produktów INSTYTUTUM, "
        f"{sum(bool(product['offers']) for product in output_products)} z ofertą PLN."
    )


if __name__ == "__main__":
    main()
