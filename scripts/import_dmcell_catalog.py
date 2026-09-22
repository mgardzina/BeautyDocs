#!/usr/bin/env python3
"""Create a reviewed BeautyDocs snapshot of the public DM.Cell catalogue.

The Polish distributor currently exposes a brand/contact page without product
cards or a public PLN price list.  Product identity, presentation and images
therefore come from the manufacturer's public English catalogue.  USD prices
are retained only as reference metadata; the BeautyDocs comparison UI keeps
the Polish offer in the explicit ``REQUEST_QUOTE`` state.
"""

from __future__ import annotations

import http.cookiejar
import json
import re
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPCookieProcessor, Request, build_opener


BASE_URL = "https://us.dmcell.com"
LISTING_URL = f"{BASE_URL}/80"
POLISH_DISTRIBUTOR_URL = "https://dmcell.pl/"
POLISH_QUOTE_URL = "https://dmcell.pl/#kontakt"
REVIEWED_AT = "2026-08-23"
EXPECTED_PRODUCT_COUNT = 63
PAGE_COUNT = 7
PAGE_SIZE = 9
WIDGET_CODE = "w20220303a6221fb94f281"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_JSON = PROJECT_ROOT / "apps/api/app/services/dmcell_catalog.json"
OUTPUT_IMAGES = PROJECT_ROOT / "public/beautydocs/catalog/dmcell"
USER_AGENT = "BeautyDocs-catalog-editor/1.0 (+https://beautydocs.pl/)"


class JsonLdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._in_json_ld = False
        self._parts: list[str] = []
        self.documents: list[dict[str, Any]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "script" and values.get("type") == "application/ld+json":
            self._in_json_ld = True
            self._parts = []

    def handle_data(self, data: str) -> None:
        if self._in_json_ld:
            self._parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "script" or not self._in_json_ld:
            return
        self._in_json_ld = False
        try:
            document = json.loads("".join(self._parts))
        except json.JSONDecodeError:
            return
        if isinstance(document, dict):
            self.documents.append(document)


@dataclass(frozen=True)
class ProductSnapshot:
    index: int
    slug: str
    name: str
    presentation: str
    source_line: str
    source_url: str
    images: tuple[str, ...]
    official_price: float | None
    official_currency: str | None
    availability: str


cookie_jar = http.cookiejar.CookieJar()
opener = build_opener(HTTPCookieProcessor(cookie_jar))


def fetch(url: str, *, accept: str = "text/html,*/*") -> bytes:
    request = Request(
        url,
        headers={
            "Accept": accept,
            "Referer": LISTING_URL,
            "User-Agent": USER_AGENT,
        },
    )
    with opener.open(request, timeout=60) as response:
        return response.read()


def fetch_text(url: str) -> str:
    return fetch(url).decode("utf-8", errors="replace")


def listing_indexes() -> list[int]:
    page_fragments = [fetch_text(LISTING_URL)]
    for page in range(2, PAGE_COUNT + 1):
        query = urlencode(
            {
                "page": page,
                "pagesize": PAGE_SIZE,
                "category": "",
                "sort": "recent",
                "menu_url": "/80/",
                "widget_code": WIDGET_CODE,
            }
        )
        payload = json.loads(
            fetch_text(f"{BASE_URL}/ajax/get_shop_list_view.cm?{query}")
        )
        if payload.get("msg") != "SUCCESS" or not isinstance(payload.get("html"), str):
            raise RuntimeError(f"Nie udało się pobrać strony {page} katalogu DM.Cell")
        page_fragments.append(payload["html"])

    indexes: list[int] = []
    for fragment in page_fragments:
        for value in re.findall(
            r'href=["\'](?:/80/|/shop_view/)?\?idx=(\d+)', fragment
        ):
            index = int(value)
            if index not in indexes:
                indexes.append(index)
    if len(indexes) != EXPECTED_PRODUCT_COUNT:
        raise RuntimeError(
            f"Oczekiwano {EXPECTED_PRODUCT_COUNT} produktów DM.Cell, znaleziono {len(indexes)}"
        )
    return indexes


def normalize_name(value: str) -> str:
    name = " ".join(value.replace("\u2028", " ").replace("\u00a0", " ").split())
    replacements = {
        " ample": " Ampoule",
        "Maxymizing": "Maximizing",
        "Martixl": "Matrixl",
        "Therapituic": "Therapeutic",
        "ExFola": "Exfoliating",
        "Carbioxy": "Carboxy",
    }
    for source, target in replacements.items():
        name = name.replace(source, target)
    return name


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    ascii_value = "".join(
        char for char in normalized if not unicodedata.combining(char)
    )
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    return slug[:150].rstrip("-")


def product_documents(page_html: str) -> tuple[dict[str, Any], dict[str, Any] | None]:
    parser = JsonLdParser()
    parser.feed(page_html)
    product = next(
        (doc for doc in parser.documents if doc.get("@type") == "Product"), None
    )
    breadcrumb = next(
        (doc for doc in parser.documents if doc.get("@type") == "BreadcrumbList"), None
    )
    if not isinstance(product, dict):
        raise ValueError("Brak Product JSON-LD")
    return product, breadcrumb if isinstance(breadcrumb, dict) else None


def source_line_from_breadcrumb(breadcrumb: dict[str, Any] | None) -> str:
    if breadcrumb is None:
        return "DM.Cell"
    elements = breadcrumb.get("itemListElement", [])
    if not isinstance(elements, list):
        return "DM.Cell"
    names = [
        str(entry.get("name") or "")
        for entry in elements
        if isinstance(entry, dict) and entry.get("name")
    ]
    return names[0] if names else "DM.Cell"


def parse_product(index: int) -> ProductSnapshot:
    source_url = f"{BASE_URL}/80/?idx={index}"
    product, breadcrumb = product_documents(fetch_text(source_url))
    name = normalize_name(str(product.get("name") or f"DM.Cell {index}"))
    description = " ".join(str(product.get("description") or "").split())
    presentation = description if re.search(r"\d", description) else "Sprawdź wariant"
    image_value = product.get("image")
    if isinstance(image_value, str):
        image_urls = [image_value]
    elif isinstance(image_value, list):
        image_urls = [url for url in image_value if isinstance(url, str)]
    else:
        image_urls = []
    image_urls = list(
        dict.fromkeys(url for url in image_urls if url.startswith("https://"))
    )
    if not image_urls:
        raise ValueError("Brak oficjalnego zdjęcia produktu")

    offer = product.get("offers") if isinstance(product.get("offers"), dict) else {}
    price_value = offer.get("price")
    try:
        official_price = float(price_value) if price_value not in (None, "") else None
    except (TypeError, ValueError):
        official_price = None
    currency = str(offer.get("priceCurrency") or "") or None
    availability = str(offer.get("availability") or "").rsplit("/", 1)[-1]
    if official_price is not None and official_price <= 0:
        official_price = None
    return ProductSnapshot(
        index=index,
        slug=slugify(name),
        name=name,
        presentation=presentation,
        source_line=source_line_from_breadcrumb(breadcrumb),
        source_url=source_url,
        images=tuple(image_urls[:3]),
        official_price=official_price,
        official_currency=currency,
        availability=availability or "Unknown",
    )


def classify(product: ProductSnapshot) -> dict[str, Any]:
    text = product.name.casefold()
    is_nuacell = "nuacell" in product.source_line.casefold()
    is_kit = any(term in text for term in ("kit", "complex", "treatment"))
    is_mask = "mask" in text
    is_cleanser = any(term in text for term in ("cleanser", "cleansing", "exfoliating"))
    is_massage = any(term in text for term in ("massage", "jojoba oil", "aroma"))
    is_eye = "eye" in text
    is_sun = any(term in text for term in ("protection", "ab30", "sun"))

    if is_cleanser:
        family = "Oczyszczanie profesjonalne"
        summary = "Kosmetyk DM.Cell przeznaczony do etapu oczyszczania skóry."
    elif is_mask:
        family = "Maska profesjonalna"
        summary = (
            "Maska DM.Cell do profesjonalnego lub domowego etapu pielęgnacji skóry."
        )
    elif (
        "ampoule" in text or "serum" in text or "essence" in text or "solution" in text
    ):
        family = "Ampułka, serum lub esencja"
        summary = "Skoncentrowany kosmetyk DM.Cell do ukierunkowanej pielęgnacji skóry."
    elif any(term in text for term in ("cream", "balm", "lotion")):
        family = "Krem, balsam lub lotion"
        summary = "Kosmetyk DM.Cell do pielęgnacji i wsparcia komfortu skóry."
    elif is_kit:
        family = "Zestaw zabiegowy"
        summary = (
            "Zestaw DM.Cell przeznaczony do kompletnego etapu pielęgnacji lub zabiegu."
        )
    elif "oil" in text:
        family = "Olejek pielęgnacyjny"
        summary = "Olejek DM.Cell do pielęgnacji lub masażu skóry."
    else:
        family = "Kosmetyk profesjonalny"
        summary = "Kosmetyk z oficjalnego katalogu DM.Cell."

    categories = ["Pielęgnacja twarzy"]
    if not is_nuacell:
        categories.append("Kosmetyka profesjonalna")
    if is_cleanser:
        categories.append("Oczyszczanie")
    if is_mask:
        categories.append("Maski i terapie gabinetowe")
    if is_eye:
        categories.append("Pielęgnacja okolicy oczu")
    if is_sun:
        categories.append("Ochrona przeciwsłoneczna")
    if any(term in text for term in ("bright", "vitamin c", "blemish", "perfection")):
        categories.append("Przebarwienia i koloryt")
    if any(term in text for term in ("wrinkle", "btx", "retinal", "egf", "9gf", "5gf")):
        categories.append("Pielęgnacja pro-aging")
    if any(
        term in text for term in ("aqua", "hydro", "hyaluronic", "aloe", "panthenol")
    ):
        categories.append("Nawilżanie")
    if any(term in text for term in ("ac ", "anti-bac", "glycolic", "aha", "exfol")):
        categories.append("Skóra trądzikowa i niedoskonałości")

    areas = [{"code": "FACE", "label": "Skóra twarzy"}]
    if is_eye:
        areas.append({"code": "EYES", "label": "Okolica oczu"})
    if is_massage:
        areas.append({"code": "BODY", "label": "Skóra ciała"})

    ingredient_rules = (
        (("retinal",), "Retinal"),
        (("egf", "gf ", "5gf", "9gf"), "Peptydy / czynniki wzrostu"),
        (("hyaluronic",), "Kwas hialuronowy"),
        (("panthenol",), "Pantenol"),
        (("vitamin c",), "Witamina C"),
        (("propolis",), "Propolis"),
        (("azulene",), "Azulen"),
        (("centella", "cica"), "Wąkrota azjatycka"),
        (("aha", "glycolic"), "Kwasy AHA"),
        (("lpha",), "Kwasy LHA / PHA"),
        (("jojoba",), "Olej jojoba"),
    )
    ingredients = [
        label
        for terms, label in ingredient_rules
        if any(term in text for term in terms)
    ]
    return {
        "summary": summary,
        "productCategory": (
            "Kosmetyk domowej pielęgnacji" if is_nuacell else "Kosmetyk profesjonalny"
        ),
        "productFamily": family,
        "treatmentCategories": list(dict.fromkeys(categories)),
        "applicationAreas": areas,
        "keyIngredients": ingredients,
        "professionalOnly": not is_nuacell,
    }


def image_suffix(url: str) -> str:
    suffix = Path(urlsplit(url).path).suffix.casefold()
    return suffix if suffix in {".avif", ".jpeg", ".jpg", ".png", ".webp"} else ".jpg"


def download_images(product: ProductSnapshot) -> list[str]:
    paths: list[str] = []
    for position, url in enumerate(product.images, start=1):
        suffix = image_suffix(url)
        filename = f"{product.slug}-{position}{suffix}"
        relative_path = f"/beautydocs/catalog/dmcell/{filename}"
        (OUTPUT_IMAGES / filename).write_bytes(fetch(url, accept="image/*"))
        paths.append(relative_path)
    return paths


def main() -> int:
    indexes = listing_indexes()
    products: list[ProductSnapshot] = []
    failures: list[str] = []
    print(f"Pobieram {len(indexes)} oficjalne karty DM.Cell…", flush=True)
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(parse_product, index): index for index in indexes}
        for position, future in enumerate(as_completed(futures), start=1):
            index = futures[future]
            try:
                products.append(future.result())
            except Exception as exc:  # noqa: BLE001 - report every failed public card
                failures.append(f"idx={index}: {exc}")
            print(f"  karty {position}/{len(indexes)}", flush=True)
    if failures:
        raise RuntimeError("Nie udało się pobrać kart:\n" + "\n".join(failures))

    OUTPUT_IMAGES.mkdir(parents=True, exist_ok=True)
    image_paths: dict[int, list[str]] = {}
    print("Pobieram oficjalne zdjęcia produktów…", flush=True)
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(download_images, product): product for product in products
        }
        for position, future in enumerate(as_completed(futures), start=1):
            product = futures[future]
            try:
                image_paths[product.index] = future.result()
            except Exception as exc:  # noqa: BLE001 - report every failed public image
                failures.append(f"{product.source_url} [zdjęcie]: {exc}")
            print(f"  zdjęcia {position}/{len(products)}", flush=True)
    if failures:
        raise RuntimeError("Nie udało się pobrać zdjęć:\n" + "\n".join(failures))

    order = {index: position for position, index in enumerate(indexes)}
    snapshot: list[dict[str, Any]] = []
    for product in sorted(products, key=lambda item: order[item.index]):
        classification = classify(product)
        paths = image_paths[product.index]
        snapshot.append(
            {
                "slug": product.slug,
                "name": product.name,
                "summary": classification.pop("summary"),
                "presentation": product.presentation,
                "sourceLine": product.source_line,
                "sourceUrl": product.source_url,
                "quoteUrl": POLISH_QUOTE_URL,
                "imagePath": paths[0],
                "imageAlt": f"{product.name} — oficjalne zdjęcie produktu DM.Cell",
                "additionalImages": [
                    {
                        "path": path,
                        "alt": f"{product.name} — oficjalne zdjęcie {position}",
                        "label": f"Zdjęcie {position}",
                        "fit": "cover",
                    }
                    for position, path in enumerate(paths[1:], start=2)
                ],
                "manufacturerUses": [
                    "Zastosowanie zgodne z aktualną etykietą i protokołem producenta DM.Cell."
                ],
                "aliases": [product.name.casefold(), product.slug.replace("-", " ")],
                "officialReferencePrice": (
                    {
                        "amount": product.official_price,
                        "currency": product.official_currency,
                        "availability": product.availability,
                        "sourceUrl": product.source_url,
                        "updatedAt": REVIEWED_AT,
                    }
                    if product.official_price is not None and product.official_currency
                    else None
                ),
                **classification,
            }
        )

    OUTPUT_JSON.write_text(
        json.dumps(
            {
                "source": LISTING_URL,
                "polishDistributor": POLISH_DISTRIBUTOR_URL,
                "reviewedAt": REVIEWED_AT,
                "count": len(snapshot),
                "products": snapshot,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Gotowe: {len(snapshot)} produktów → {OUTPUT_JSON}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
