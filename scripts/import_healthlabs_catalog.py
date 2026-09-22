#!/usr/bin/env python3
"""Create a static BeautyDocs snapshot of the Health Labs Care cosmetics list.

The importer only reads public product pages.  It stores a compact JSON
snapshot next to the catalogue service and one official product image per
item in ``public/beautydocs/catalog/healthlabs``.
"""

from __future__ import annotations

import html
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen


BASE_URL = "https://www.healthlabs.care"
LISTING_URL = f"{BASE_URL}/pl/produkty/kosmetyki"
REVIEWED_AT = "2026-08-23"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_JSON = PROJECT_ROOT / "apps/api/app/services/healthlabs_catalog.json"
OUTPUT_IMAGES = PROJECT_ROOT / "public/beautydocs/catalog/healthlabs"
USER_AGENT = "BeautyDocs-catalog-editor/1.0 (+https://www.healthlabs.care/)"


class ProductLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        values = dict(attrs)
        href = values.get("href") or ""
        if (
            href.startswith("/pl/produkt/")
            and values.get("itemtype") == "https://schema.org/Product"
            and href not in self.links
        ):
            self.links.append(href)


class ProductMetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._in_json_ld = False
        self._json_parts: list[str] = []
        self.json_documents: list[dict[str, Any]] = []
        self.og_image: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "script" and values.get("type") == "application/ld+json":
            self._in_json_ld = True
            self._json_parts = []
        if tag == "meta" and values.get("property") == "og:image":
            self.og_image = values.get("content")

    def handle_data(self, data: str) -> None:
        if self._in_json_ld:
            self._json_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "script" or not self._in_json_ld:
            return
        self._in_json_ld = False
        payload = "".join(self._json_parts).strip()
        if payload:
            try:
                parsed = json.loads(payload)
            except json.JSONDecodeError:
                return
            if isinstance(parsed, dict):
                self.json_documents.append(parsed)


@dataclass(frozen=True)
class ProductSnapshot:
    slug: str
    name: str
    summary: str
    price: float | None
    availability: str
    image_url: str
    source_url: str
    presentation: str
    source_category: str


def fetch(url: str) -> bytes:
    request = Request(
        url,
        headers={
            "Accept": "text/html,application/xhtml+xml,image/avif,image/webp,*/*",
            "User-Agent": USER_AGENT,
        },
    )
    with urlopen(request, timeout=45) as response:
        return response.read()


def fetch_text(url: str) -> str:
    return fetch(url).decode("utf-8", errors="replace")


def product_from_json_ld(documents: list[dict[str, Any]]) -> tuple[dict[str, Any], str]:
    for document in documents:
        graph = document.get("@graph", [])
        if not isinstance(graph, list):
            continue
        product = next(
            (
                entry
                for entry in graph
                if isinstance(entry, dict) and entry.get("@type") == "Product"
            ),
            None,
        )
        breadcrumb = next(
            (
                entry
                for entry in graph
                if isinstance(entry, dict) and entry.get("@type") == "BreadcrumbList"
            ),
            None,
        )
        if product is None:
            continue
        category = "Kosmetyki"
        if isinstance(breadcrumb, dict):
            elements = breadcrumb.get("itemListElement", [])
            if isinstance(elements, list) and elements and isinstance(elements[0], dict):
                category = str(elements[0].get("name") or category)
        return product, category
    raise ValueError("Brak danych Product JSON-LD")


def strip_markup(value: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value)).split())


def extract_presentation(page_html: str, source_category: str) -> str:
    match = re.search(r'<div class="_2vl".*?<span>(.*?)</span>', page_html, re.S)
    if match:
        value = strip_markup(match.group(1))
        if value:
            return value
    if "zestaw" in normalize(source_category):
        return "Zestaw produktów"
    return "Sprawdź wariant na stronie marki"


def parse_offer(product: dict[str, Any]) -> tuple[float | None, str, str]:
    offers = product.get("offers")
    if isinstance(offers, list):
        offer = next((entry for entry in offers if isinstance(entry, dict)), {})
    elif isinstance(offers, dict):
        offer = offers
    else:
        offer = {}
    price_value = offer.get("price")
    try:
        price = float(price_value) if price_value is not None else None
    except (TypeError, ValueError):
        price = None
    raw_availability = str(offer.get("availability") or "")
    availability = {
        "InStock": "IN_STOCK",
        "OutOfStock": "OUT_OF_STOCK",
        "PreOrder": "PREORDER",
    }.get(raw_availability.rsplit("/", 1)[-1], "UNKNOWN")
    source_url = str(offer.get("url") or "")
    return price, availability, source_url


def parse_product(relative_url: str) -> ProductSnapshot:
    source_url = urljoin(BASE_URL, relative_url)
    page_html = fetch_text(source_url)
    parser = ProductMetaParser()
    parser.feed(page_html)
    product, source_category = product_from_json_ld(parser.json_documents)
    price, availability, offer_url = parse_offer(product)
    image_value = product.get("image") or parser.og_image
    if isinstance(image_value, list):
        image_value = next((value for value in image_value if isinstance(value, str)), None)
    if not isinstance(image_value, str) or not image_value.startswith("https://"):
        raise ValueError("Brak oficjalnego zdjęcia produktu")
    slug = relative_url.rstrip("/").rsplit("/", 1)[-1]
    return ProductSnapshot(
        slug=slug,
        name=strip_markup(str(product.get("name") or slug.replace("-", " "))),
        summary=strip_markup(str(product.get("description") or "")),
        price=price,
        availability=availability,
        image_url=image_value,
        source_url=offer_url if offer_url.startswith("https://") else source_url,
        presentation=extract_presentation(page_html, source_category),
        source_category=strip_markup(source_category),
    )


def normalize(value: str) -> str:
    replacements = str.maketrans("ąćęłńóśźż", "acelnoszz")
    return value.casefold().translate(replacements).replace("\u00a0", " ")


def classify(product: ProductSnapshot) -> dict[str, Any]:
    text = normalize(f"{product.name} {product.summary} {product.slug}")
    source_category = normalize(product.source_category)
    is_set = "zestaw" in source_category or any(
        term in product.slug
        for term in (
            "rytual-",
            "duet-",
            "kompleksow",
            "pelna-pielegnacja",
            "podwojne-wsparcie",
            "podstawy-meskiej",
            "dla-skory-i-wlosow",
            "dla-codziennego",
            "letni-blask",
            "mocne-i-lsniace",
            "czystosc-i-lekkosc",
            "dwuetapowe-oczyszczanie",
            "wygladzenie-i-efekt",
            "regeneracja-wlosow",
            "zdrowy-wzrost",
            "swiezosc-wlosow",
            "pielegnacyjny-duet",
            "promienna-skora",
            "odnowa-dojrzalej",
            "regeneracja-skory",
            "jedrna-i-miekka",
            "intensywne-nawilzenie",
        )
    )
    is_accessory = "kosmetyczka" in text
    hair_terms = ("wlos", "skory glowy", "trycho", "szampon", "odzywka", "wcierka")
    body_terms = ("do ciala", "body", "balsam uj", "serum z kompleksem kwasow")
    eye_terms = ("pod oczy", "okolicy oczu", "cienie pod oczami")
    is_hair = any(term in text for term in hair_terms)
    is_body = any(term in text for term in body_terms)
    is_eye = any(term in text for term in eye_terms)
    explicit_face_terms = (
        "twarzy",
        "cery",
        "skory twarzy",
        "demakijaz",
        "spf",
        "pod oczy",
        "okolicy oczu",
    )
    is_face = any(term in text for term in explicit_face_terms) or (
        not is_accessory and not is_hair and not is_body
    )

    categories: list[str] = []
    if is_set:
        categories.append("Zestawy kosmetyczne")
    if is_face:
        categories.append("Pielęgnacja twarzy")
    if is_hair:
        categories.append("Pielęgnacja włosów i skóry głowy")
    if is_body:
        categories.append("Pielęgnacja ciała")
    category_rules = (
        (("oczyszcz", "myjac", "demakijaz"), "Oczyszczanie"),
        (("nawilz", "hialuron"), "Nawilżanie"),
        (("spf", "ochrona uv", "filtrem uv"), "Ochrona przeciwsłoneczna"),
        (("tradz", "acne", "niedoskonal", "sebum"), "Skóra trądzikowa i niedoskonałości"),
        (("przebarw", "koloryt", "rozswietl", "blask"), "Przebarwienia i koloryt"),
        (("koj", "lagod", "wrazliw", "komfort"), "Skóra wrażliwa i reaktywna"),
        (("retin", "pro-aging", "lifting", "ujedrn", "dojrzal"), "Pielęgnacja pro-aging"),
        (("pod oczy", "okolicy oczu"), "Pielęgnacja okolicy oczu"),
    )
    for terms, label in category_rules:
        if any(term in text for term in terms):
            categories.append(label)
    if not categories:
        categories.append("Pielęgnacja kosmetyczna")

    areas: list[dict[str, str]] = []
    if is_face:
        areas.append({"code": "FACE", "label": "Skóra twarzy"})
    if is_eye:
        areas.append({"code": "EYES", "label": "Okolica oczu"})
    if is_body:
        areas.append({"code": "BODY", "label": "Skóra ciała"})

    ingredient_rules = (
        (("ceramid",), "Ceramidy"),
        (("tetravit", "witamina c", "witamine c"), "Witamina C"),
        (("kwas hialuron",), "Kwas hialuronowy"),
        (("peptyd",), "Peptydy"),
        (("retinol", "retinal", "retinoid"), "Retinoidy"),
        (("niacynamid",), "Niacynamid"),
        (("laktoferyn",), "Laktoferyna"),
        (("kwas azelain",), "Kwas azelainowy"),
        (("kwas salicyl", "bha"), "BHA / kwas salicylowy"),
        (("aha",), "Kwasy AHA"),
        (("pha",), "Kwasy PHA"),
        (("prebiot",), "Prebiotyki"),
        (("kofein",), "Kofeina"),
        (("karnityn",), "L-karnityna"),
        (("melanin",), "Melanina"),
    )
    ingredients = [
        label
        for terms, label in ingredient_rules
        if any(term in text for term in terms)
    ]

    if is_accessory:
        product_category = "Akcesorium kosmetyczne"
        family = "Kosmetyczka i akcesoria"
    elif is_set:
        product_category = "Zestaw kosmetyków"
        family = "Zestaw pielęgnacyjny"
    elif is_hair and not is_face:
        product_category = "Kosmetyk do włosów"
        family = product_family(product.name, "Kosmetyk do włosów i skóry głowy")
    elif is_body and not is_face:
        product_category = "Kosmetyk do ciała"
        family = product_family(product.name, "Kosmetyk do ciała")
    else:
        product_category = "Kosmetyk do twarzy"
        family = product_family(product.name, "Kosmetyk do pielęgnacji twarzy")

    return {
        "productCategory": product_category,
        "productFamily": family,
        "treatmentCategories": list(dict.fromkeys(categories)),
        "applicationAreas": areas,
        "keyIngredients": ingredients,
    }


def product_family(name: str, fallback: str) -> str:
    text = normalize(name)
    families = (
        ("serum", "Serum pielęgnacyjne"),
        ("krem", "Krem pielęgnacyjny"),
        ("zel", "Żel pielęgnacyjny"),
        ("szampon", "Szampon do włosów"),
        ("maska", "Maska pielęgnacyjna"),
        ("odzywka", "Odżywka do włosów"),
        ("balsam", "Balsam pielęgnacyjny"),
        ("esencja", "Esencja pielęgnacyjna"),
        ("mgielka", "Mgiełka pielęgnacyjna"),
        ("peeling", "Peeling kosmetyczny"),
        ("booster", "Booster pielęgnacyjny"),
        ("wcierka", "Wcierka do skóry głowy"),
    )
    return next((label for term, label in families if term in text), fallback)


def optimized_image_url(url: str) -> str:
    parts = urlsplit(url)
    query = urlencode({"auto": "compress", "fm": "webp", "w": "1000"})
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, ""))


def download_image(product: ProductSnapshot) -> str:
    relative_path = f"/beautydocs/catalog/healthlabs/{product.slug}.webp"
    output_path = PROJECT_ROOT / "public" / relative_path.lstrip("/")
    output_path.write_bytes(fetch(optimized_image_url(product.image_url)))
    return relative_path


def main() -> int:
    parser = ProductLinkParser()
    parser.feed(fetch_text(LISTING_URL))
    if len(parser.links) != 69:
        raise RuntimeError(f"Oczekiwano 69 produktów, znaleziono {len(parser.links)}")

    print(f"Pobieram {len(parser.links)} kart produktów…", flush=True)
    products: list[ProductSnapshot] = []
    failures: list[str] = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(parse_product, link): link for link in parser.links}
        for index, future in enumerate(as_completed(futures), start=1):
            link = futures[future]
            try:
                products.append(future.result())
            except Exception as exc:  # noqa: BLE001 - importer reports all failed URLs
                failures.append(f"{link}: {exc}")
            print(f"  karty {index}/{len(parser.links)}", flush=True)
    if failures:
        raise RuntimeError("Nie udało się pobrać kart:\n" + "\n".join(failures))

    OUTPUT_IMAGES.mkdir(parents=True, exist_ok=True)
    print("Pobieram oficjalne zdjęcia…", flush=True)
    image_paths: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(download_image, product): product for product in products}
        for index, future in enumerate(as_completed(futures), start=1):
            product = futures[future]
            try:
                image_paths[product.slug] = future.result()
            except Exception as exc:  # noqa: BLE001 - importer reports all failed URLs
                failures.append(f"{product.source_url} [zdjęcie]: {exc}")
            print(f"  zdjęcia {index}/{len(products)}", flush=True)
    if failures:
        raise RuntimeError("Nie udało się pobrać zdjęć:\n" + "\n".join(failures))

    order = {link.rsplit("/", 1)[-1]: index for index, link in enumerate(parser.links)}
    snapshot: list[dict[str, Any]] = []
    for product in sorted(products, key=lambda item: order[item.slug]):
        classification = classify(product)
        presentation = product.presentation
        if (
            classification["productCategory"] == "Zestaw kosmetyków"
            and presentation == "Sprawdź wariant na stronie marki"
        ):
            presentation = "Zestaw produktów"
        offer = None
        if product.price is not None:
            offer = {
                "seller": "Health Labs Care",
                "pricePln": product.price,
                "shippingPricePln": None,
                "availability": product.availability,
                "url": product.source_url,
                "sourceType": "STORE",
                "updatedAt": REVIEWED_AT,
            }
        snapshot.append(
            {
                "slug": product.slug,
                "name": product.name,
                "summary": product.summary,
                "presentation": presentation,
                "sourceCategory": product.source_category,
                "sourceUrl": product.source_url,
                "imagePath": image_paths[product.slug],
                "imageAlt": f"{product.name} — oficjalne zdjęcie produktu Health Labs Care",
                "manufacturerUses": [product.summary],
                "aliases": [product.slug.replace("-", " ")],
                "offer": offer,
                **classification,
            }
        )

    OUTPUT_JSON.write_text(
        json.dumps(
            {
                "source": LISTING_URL,
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
