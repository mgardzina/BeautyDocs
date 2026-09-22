#!/usr/bin/env python3
"""Build a local snapshot of every visible GIGI Poland product card.

The public WooCommerce store exposes product names, categories, attributes and
official images, but hides prices until a verified professional signs in.  The
snapshot therefore never invents a retail price and keeps the direct product
URL as the quote/sign-in destination.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "apps/api/app/services/gigi_poland_catalog.json"
IMAGE_DIR = PROJECT_ROOT / "public/beautydocs/catalog/gigi-poland"
LOGO_PATH = PROJECT_ROOT / "public/beautydocs/brands/gigi-poland.svg"
SOURCE_URL = "https://gigipoland.pl/sklep/"
PAGE_URLS = (SOURCE_URL, "https://gigipoland.pl/sklep/page/2/")
LOGO_URL = "https://gigipoland.pl/wp-content/uploads/2026/01/logo-gigi.svg"
REVIEWED_AT = "2026-08-24"


@dataclass(slots=True)
class ProductCard:
    product_id: str
    class_tokens: tuple[str, ...]
    name: str = ""
    url: str = ""
    image_url: str = ""
    _capture_name: bool = False
    _name_text: list[str] = field(default_factory=list)


class ProductCardParser(HTMLParser):
    """Parse the stable WooCommerce product-list markup without dependencies."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.cards: list[ProductCard] = []
        self.card: ProductCard | None = None
        self.li_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key: value or "" for key, value in attrs}
        classes = tuple(attributes.get("class", "").split())

        if self.card is None:
            if tag != "li" or "wc-block-product" not in classes:
                return
            product_class = next((value for value in classes if value.startswith("post-")), "")
            if not product_class.removeprefix("post-").isdigit():
                return
            self.card = ProductCard(
                product_id=product_class.removeprefix("post-"),
                class_tokens=classes,
            )
            self.li_depth = 1
            return

        if tag == "li":
            self.li_depth += 1
        if tag == "h3" and "wc-block-components-product-name" in classes:
            self.card._capture_name = True
            self.card._name_text = []
        elif tag == "a" and "/product/" in attributes.get("href", ""):
            self.card.url = urljoin(SOURCE_URL, attributes["href"])
        elif tag == "img" and attributes.get("data-testid") == "product-image":
            self.card.image_url = urljoin(SOURCE_URL, attributes.get("src", ""))
            if not self.card.name:
                self.card.name = attributes.get("alt", "").strip()

    def handle_data(self, data: str) -> None:
        if self.card is not None and self.card._capture_name:
            self.card._name_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self.card is None:
            return
        if tag == "h3" and self.card._capture_name:
            name = " ".join(" ".join(self.card._name_text).split())
            if name:
                self.card.name = name
            self.card._capture_name = False
            self.card._name_text = []
        if tag == "li":
            self.li_depth -= 1
            if self.li_depth == 0:
                if self.card.name and self.card.url and self.card.image_url:
                    self.cards.append(self.card)
                self.card = None


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 BeautyDocsCatalog/1.0"})
    with urlopen(request, timeout=45) as response:  # noqa: S310 - reviewed HTTPS source
        return response.read()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold()).replace("ł", "l")
    ascii_value = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")


def attribute_values(card: ProductCard, prefix: str) -> list[str]:
    return [token.removeprefix(prefix) for token in card.class_tokens if token.startswith(prefix)]


LABELS = {
    "nawilzenie": "Nawilżanie",
    "oczyszczanie": "Oczyszczanie",
    "zluszczanie": "Złuszczanie",
    "rozjasnienie": "Rozjaśnianie",
    "regeneracja": "Regeneracja",
    "pielegnacja": "Pielęgnacja",
    "odmlodzenie": "Odmładzanie",
    "ochrona": "Ochrona skóry",
    "lifting": "Lifting",
    "oczy": "Okolica oczu",
    "nierownomierny-koloryt-pigmentacja": "Nierównomierny koloryt i pigmentacja",
    "zmarszczki": "Zmarszczki",
    "stany-zapalne-zaskorniki": "Stany zapalne i zaskórniki",
    "rozszerzone-pory": "Rozszerzone pory",
    "tradzik": "Skóra trądzikowa",
    "blizny": "Blizny",
    "odwodnienie": "Odwodnienie",
    "skora-wrazliwa-naczyniowa": "Skóra wrażliwa i naczyniowa",
    "skora-sucha": "Skóra sucha",
    "skora-tlusta-mieszana": "Skóra tłusta i mieszana",
    "skora-dojrzala": "Skóra dojrzała",
    "kazdy-rodzaj-skory": "Każdy rodzaj skóry",
    "kwas-hialuronowy": "Kwas hialuronowy",
    "kwas-mlekowy": "Kwas mlekowy",
    "witamina-c": "Witamina C",
    "witamina-e": "Witamina E",
}


def humanize(value: str) -> str:
    if value in LABELS:
        return LABELS[value]
    return " ".join(part.upper() if len(part) <= 3 else part.capitalize() for part in value.split("-"))


def presentation(name: str) -> str:
    values = re.findall(r"\b\d+(?:[,.]\d+)?\s*(?:ml|g|szt\.?|ampułki?)\b", name, flags=re.I)
    return " • ".join(dict.fromkeys(value.replace(".", "").strip() for value in values)) or "1 szt."


def metadata(card: ProductCard) -> dict[str, object]:
    actions = [humanize(value) for value in attribute_values(card, "pa_dzialanie-")]
    problems = [humanize(value) for value in attribute_values(card, "pa_problem-")]
    ingredients = [humanize(value) for value in attribute_values(card, "pa_glowny-skladnik-")]
    lines = [humanize(value) for value in attribute_values(card, "pa_linia-")]
    families = [humanize(value) for value in attribute_values(card, "pa_rodzaj-produktu-")]
    skin_types = [humanize(value) for value in attribute_values(card, "pa_skora-")]
    categories = attribute_values(card, "product_cat-")
    protocol = "protokoly-zabiegowe" in categories
    professional = "produkty-profesjonalne" in categories or protocol

    treatment_categories = ["Pielęgnacja twarzy", *actions]
    if "Okolica oczu" in problems:
        treatment_categories.append("Pielęgnacja okolicy oczu")
    if "Nierównomierny koloryt i pigmentacja" in problems:
        treatment_categories.append("Przebarwienia")
    if any(value in problems for value in ("Stany zapalne i zaskórniki", "Skóra trądzikowa")):
        treatment_categories.append("Pielęgnacja skóry problematycznej")
    if "Zmarszczki" in problems:
        treatment_categories.append("Pielęgnacja anti-aging")

    area = {"code": "EYES", "label": "Okolica oczu"} if "Okolica oczu" in problems else {
        "code": "FACE",
        "label": "Skóra twarzy",
    }
    product_family = families[0] if families else ("Protokół zabiegowy" if protocol else "Kosmetyk")
    product_category = (
        "Protokół zabiegowy GIGI"
        if protocol
        else "Kosmetyk profesjonalny" if professional else "Kosmetyk do pielęgnacji domowej"
    )
    uses = [*actions, *problems]
    if not uses:
        uses = ["Pielęgnacja skóry twarzy zgodnie z protokołem marki"]

    return {
        "series": lines[0] if lines else "GIGI Laboratories",
        "presentation": presentation(card.name),
        "productCategory": product_category,
        "productFamily": product_family,
        "manufacturerUses": list(dict.fromkeys(uses)),
        "treatmentCategories": list(dict.fromkeys(treatment_categories)),
        "applicationAreas": [area],
        "keyIngredients": ingredients,
        "skinTypes": skin_types or ["Dobierz do potrzeb skóry"],
        "professionalOnly": professional or protocol,
    }


def main() -> None:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    LOGO_PATH.parent.mkdir(parents=True, exist_ok=True)

    cards: dict[str, ProductCard] = {}
    for page_url in PAGE_URLS:
        parser = ProductCardParser()
        parser.feed(fetch(page_url).decode("utf-8", errors="replace"))
        for card in parser.cards:
            cards[card.product_id] = card
    if len(cards) != 145:
        raise RuntimeError(f"Oczekiwano 145 kart GIGI, znaleziono {len(cards)}")

    LOGO_PATH.write_bytes(fetch(LOGO_URL))
    products = []
    for card in cards.values():
        local_image = IMAGE_DIR / f"{card.product_id}.webp"
        image_data = fetch(card.image_url)
        if len(image_data) < 1_000:
            raise RuntimeError(f"Nieprawidłowe zdjęcie produktu {card.product_id}")
        local_image.write_bytes(image_data)

        info = metadata(card)
        slug = f"{card.product_id}-{slugify(card.name)}"
        products.append(
            {
                "id": card.product_id,
                "slug": slug,
                "name": card.name,
                "brand": "GIGI Laboratories",
                "summary": (
                    f"{card.name} z linii {info['series']} marki GIGI Laboratories. "
                    "Oficjalna karta GIGI Poland; cena jest dostępna po zalogowaniu profesjonalisty."
                ),
                **info,
                "aliases": list(dict.fromkeys([card.name, str(info["series"]), "GIGI", "GIGI Laboratories"])),
                "sourceUrl": card.url,
                "imagePath": f"/beautydocs/catalog/gigi-poland/{local_image.name}",
                "imageAlt": f"{card.name} — oficjalne zdjęcie produktu GIGI Laboratories",
            }
        )

    payload = {
        "source": SOURCE_URL,
        "reviewedAt": REVIEWED_AT,
        "count": len(products),
        "priceAccess": "Ceny widoczne wyłącznie po zalogowaniu zweryfikowanego profesjonalisty",
        "products": products,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Gotowe: {len(products)} produktów GIGI → {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
