#!/usr/bin/env python3
"""Build the reviewed LUVEE catalogue snapshot used by BeautyDocs.

The public LUVEE shop currently exposes one product.  The importer keeps its
price, availability, gallery and brand mark as local, reproducible assets.
"""

from __future__ import annotations

import json
from pathlib import Path
from urllib.request import Request, urlopen

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "apps/api/app/services/luvee_catalog.json"
IMAGE_DIR = PROJECT_ROOT / "public/beautydocs/catalog/luvee"
LOGO_PATH = PROJECT_ROOT / "public/beautydocs/brands/luvee.png"
SOURCE_URL = "https://luvee.pl/collections/all"
PRODUCT_URL = "https://luvee.pl/products/luvee"
REVIEWED_AT = "2026-08-23"

GALLERY_URLS = [
    "https://luvee.pl/cdn/shop/files/IMG_8525_1080.jpg?v=1776854649&width=1200",
    "https://luvee.pl/cdn/shop/files/IMG_8527_1080.jpg?v=1776854705&width=1200",
    "https://luvee.pl/cdn/shop/files/Luvee-1007_2.jpg?v=1782157561&width=1200",
    (
        "https://luvee.pl/cdn/shop/files/"
        "4ece2995-d81d-4bc1-90cf-c5d11b5ac7bc.jpg?v=1781447571&width=1200"
    ),
]
LOGO_URL = "https://luvee.pl/cdn/shop/files/Logo_sam_napis.png?v=1780249182&width=600"


def download(url: str, target: Path) -> None:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 BeautyDocsCatalog/1.0"})
    with urlopen(request, timeout=30) as response:  # noqa: S310 - reviewed HTTPS source
        data = response.read()
    if len(data) < 500:
        raise RuntimeError(f"Nieprawidłowy plik: {url}")
    target.write_bytes(data)


def main() -> None:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    LOGO_PATH.parent.mkdir(parents=True, exist_ok=True)

    images = []
    for index, image_url in enumerate(GALLERY_URLS, start=1):
        target = IMAGE_DIR / f"pure-mist-{index}.jpg"
        download(image_url, target)
        images.append(
            {
                "path": f"/beautydocs/catalog/luvee/{target.name}",
                "alt": f"Luvée Pure Mist — oficjalne zdjęcie produktu {index}",
                "label": "Produkt" if index == 1 else f"Zdjęcie {index}",
                "fit": "cover",
            }
        )

    download(LOGO_URL, LOGO_PATH)

    product = {
        "id": "9777244340560",
        "slug": "pure-mist",
        "name": "Luvée Pure Mist",
        "brand": "Luvée",
        "summary": (
            "Delikatna mgiełka do twarzy z kwasem podchlorawym (HOCl), "
            "przeznaczona do codziennego odświeżania i pielęgnacji skóry."
        ),
        "presentation": "100 ml • butelka z atomizerem",
        "productCategory": "Kosmetyk pielęgnacyjny",
        "productFamily": "Mgiełka do twarzy z HOCl",
        "manufacturerUses": [
            "Ograniczanie powstawania niedoskonałości",
            "Łagodzenie uczucia podrażnień i zaczerwienień",
            "Oczyszczanie i odświeżanie skóry",
            "Pielęgnacja po goleniu lub depilacji",
            "Wsparcie regeneracji skóry",
        ],
        "treatmentCategories": [
            "Pielęgnacja twarzy",
            "Pielęgnacja domowa",
            "Skóra wrażliwa i reaktywna",
            "Skóra trądzikowa i niedoskonałości",
            "Pielęgnacja pozabiegowa",
            "Pielęgnacja ciała",
        ],
        "applicationAreas": [
            {"code": "FACE", "label": "Skóra twarzy"},
            {"code": "BODY", "label": "Skóra ciała po goleniu lub depilacji"},
        ],
        "keyIngredients": ["Woda", "Kwas podchlorawy (HOCl)"],
        "skinTypes": [
            "Każdy rodzaj",
            "Wrażliwa",
            "Problematyczna",
            "Skłonna do niedoskonałości",
        ],
        "aliases": [
            "Luvee",
            "Pure Mist",
            "mgiełka HOCl",
            "kwas podchlorawy",
        ],
        "sourceUrl": PRODUCT_URL,
        "imagePath": images[0]["path"],
        "imageAlt": images[0]["alt"],
        "additionalImages": images[1:],
        "offer": {
            "seller": "LUVEE",
            "pricePln": 99.0,
            "shippingPricePln": None,
            "availability": "IN_STOCK",
            "url": PRODUCT_URL,
            "sourceType": "STORE",
            "updatedAt": REVIEWED_AT,
        },
    }
    payload = {
        "source": SOURCE_URL,
        "reviewedAt": REVIEWED_AT,
        "count": 1,
        "scope": "Pełna publiczna oferta sklepu LUVEE w dniu weryfikacji",
        "products": [product],
    }
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Gotowe: 1 produkt → {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
