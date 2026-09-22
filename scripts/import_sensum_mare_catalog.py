#!/usr/bin/env python3
"""Build a local snapshot of the complete public Sensum Mare catalogue.

The importer reads all three pages of the official IdoSell category, keeps each
visible variant as a separate comparison entry, and stores the official card
image locally so the public catalogue does not depend on third-party hotlinks.
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
OUTPUT_PATH = PROJECT_ROOT / "apps/api/app/services/sensum_mare_catalog.json"
IMAGE_DIR = PROJECT_ROOT / "public/beautydocs/catalog/sensum-mare"
LOGO_PATH = PROJECT_ROOT / "public/beautydocs/brands/sensum-mare.svg"
SOURCE_URL = "https://sensummare.pl/kosmetyki/"
PAGE_URLS = (
    SOURCE_URL,
    "https://sensummare.pl/search.php?counter=1&node=265&lang=pol",
    "https://sensummare.pl/search.php?counter=2&node=265&lang=pol",
)
LOGO_URL = "https://sensummare.pl/data/gfx/mask/pol/logo_1_big.svg"
REVIEWED_AT = "2026-08-24"


@dataclass(slots=True)
class ProductCard:
    product_id: str
    name: str = ""
    url: str = ""
    series: str = ""
    image_url: str = ""
    price_text: str = ""
    availability: str = "UNKNOWN"
    _capture: str | None = None
    _capture_tag: str | None = None
    _text: list[str] = field(default_factory=list)


class ProductCardParser(HTMLParser):
    """Small purpose-built parser for the stable IdoSell product-card markup."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.cards: list[ProductCard] = []
        self.card: ProductCard | None = None
        self.product_depth = 0

    @staticmethod
    def _classes(attributes: dict[str, str]) -> set[str]:
        return set(attributes.get("class", "").split())

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key: value or "" for key, value in attrs}
        classes = self._classes(attributes)

        if self.card is None:
            if (
                tag == "div"
                and "product" in classes
                and attributes.get("data-product_id")
            ):
                self.card = ProductCard(product_id=attributes["data-product_id"])
                self.product_depth = 1
            return

        if tag == "div":
            self.product_depth += 1

        if tag == "a" and "product__name" in classes:
            self.card.name = attributes.get("title", "").strip()
            self.card.url = urljoin(SOURCE_URL, attributes.get("href", ""))
            self.card._capture = "name"
            self.card._capture_tag = tag
            self.card._text = []
        elif tag == "a" and "product__series" in classes:
            self.card._capture = "series"
            self.card._capture_tag = tag
            self.card._text = []
        elif tag == "span" and "price__sub" in classes and not self.card.price_text:
            self.card._capture = "price"
            self.card._capture_tag = tag
            self.card._text = []
        elif tag == "source" and attributes.get("type") == "image/webp":
            candidate = attributes.get("srcset", "").split()[0]
            if candidate and (not self.card.image_url or attributes.get("media")):
                self.card.image_url = urljoin(SOURCE_URL, candidate)
        elif tag == "input" and attributes.get("name") == "product":
            self.card.availability = (
                "IN_STOCK"
                if attributes.get("data-availability") == "enable"
                else "OUT_OF_STOCK"
            )

    def handle_data(self, data: str) -> None:
        if self.card is not None and self.card._capture:
            self.card._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self.card is None:
            return
        if self.card._capture_tag == tag:
            text = " ".join(" ".join(self.card._text).split())
            if self.card._capture == "name" and not self.card.name:
                self.card.name = text
            elif self.card._capture == "series":
                self.card.series = text
            elif self.card._capture == "price":
                self.card.price_text = text
            self.card._capture = None
            self.card._capture_tag = None
            self.card._text = []

        if tag == "div":
            self.product_depth -= 1
            if self.product_depth == 0:
                if self.card.name and self.card.url and self.card.image_url:
                    self.cards.append(self.card)
                self.card = None


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 BeautyDocsCatalog/1.0"})
    with urlopen(request, timeout=45) as response:  # noqa: S310 - reviewed HTTPS source
        return response.read()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold()).replace("ł", "l")
    ascii_value = "".join(
        char for char in normalized if not unicodedata.combining(char)
    )
    return re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")


def parse_price(value: str) -> float:
    match = re.search(r"(\d[\d\s]*(?:[,.]\d{1,2})?)", value)
    if not match:
        raise RuntimeError(f"Brak ceny w karcie: {value!r}")
    return float(match.group(1).replace(" ", "").replace(",", "."))


def presentation(name: str) -> str:
    matches = re.findall(
        r"\b\d+(?:[,.]\d+)?\s*(?:ml|g|szt\.?|sztuk)\b", name, flags=re.I
    )
    return (
        " • ".join(dict.fromkeys(match.replace(".", "").strip() for match in matches))
        or "1 szt."
    )


def classify(name: str, series: str) -> dict[str, object]:
    normalized = slugify(f"{series} {name}")
    is_set = "zestaw" in normalized or "set-" in normalized
    is_accessory = any(
        token in normalized
        for token in (
            "akcesoria",
            "aplikator",
            "puszek",
            "gabecz",
            "recznik",
            "torba",
            "probki",
            "tester",
        )
    )
    is_hair = any(token in normalized for token in ("wlos", "szampon", "skory-glowy"))
    is_body = any(
        token in normalized
        for token in ("do-ciala", "balsam-do-ciala", "biust", "cellulit", "drenuj")
    )
    is_eye = any(
        token in normalized for token in ("pod-oczy", "wokol-oczu", "okolice-oczu")
    )
    is_lip = any(token in normalized for token in ("do-ust", "usta", "warg"))
    is_spf = "spf" in normalized or "przeciwslonecz" in normalized

    family_rules = (
        ("szampon", "Szampon"),
        ("odzyw", "Odżywka"),
        ("serum", "Serum"),
        ("tonik", "Tonik"),
        ("krem", "Krem"),
        ("maska", "Maska"),
        ("balsam", "Balsam"),
        ("peeling", "Peeling"),
        ("pianka", "Pianka"),
        ("zel", "Żel"),
        ("olejek", "Olejek"),
        ("emulsj", "Emulsja"),
        ("mgielk", "Mgiełka"),
        ("puder", "Puder"),
    )
    family = next(
        (label for token, label in family_rules if token in normalized), "Kosmetyk"
    )
    if is_set:
        family = "Zestaw pielęgnacyjny"
    elif is_accessory:
        family = "Akcesorium kosmetyczne"

    if is_accessory:
        category = "Akcesorium kosmetyczne"
    elif is_set:
        category = "Zestaw kosmetyków"
    else:
        category = "Kosmetyk pielęgnacyjny"

    if is_hair:
        categories = ["Pielęgnacja włosów i skóry głowy"]
        areas: list[dict[str, str]] = []
        uses = ["Pielęgnacja włosów i skóry głowy"]
    elif is_body:
        categories = ["Pielęgnacja ciała"]
        areas = [{"code": "BODY", "label": "Skóra ciała"}]
        uses = ["Codzienna pielęgnacja skóry ciała"]
    elif is_eye:
        categories = ["Pielęgnacja okolicy oczu", "Pielęgnacja twarzy"]
        areas = [{"code": "EYES", "label": "Okolica oczu"}]
        uses = ["Pielęgnacja delikatnej okolicy oczu"]
    elif is_lip:
        categories = ["Pielęgnacja ust", "Pielęgnacja twarzy"]
        areas = [{"code": "LIPS", "label": "Usta"}]
        uses = ["Pielęgnacja ust"]
    elif is_accessory:
        categories = ["Akcesoria kosmetyczne"]
        areas = []
        uses = ["Uzupełnienie codziennej pielęgnacji lub makijażu"]
    else:
        categories = ["Pielęgnacja twarzy", "Pielęgnacja domowa"]
        areas = [{"code": "FACE", "label": "Skóra twarzy"}]
        uses = ["Codzienna pielęgnacja skóry twarzy"]
    if is_set:
        categories.append("Zestawy pielęgnacyjne")
    if is_spf:
        categories.append("Ochrona przeciwsłoneczna")
        uses.append("Ochrona skóry przed promieniowaniem UV")

    ingredient_rules = (
        ("pdrn", "PDRN"),
        ("egzosom", "Egzosomy"),
        ("retinal", "Retinal"),
        ("witamin-c", "Witamina C"),
        ("ceramid", "Ceramidy"),
        ("peptyd", "Peptydy"),
        ("kwas-hialuron", "Kwas hialuronowy"),
        ("niacynamid", "Niacynamid"),
        ("bakuchiol", "Bakuchiol"),
        ("kolagen", "Kolagen"),
    )
    ingredients = [label for token, label in ingredient_rules if token in normalized]

    skin_types = ["Każdy rodzaj"]
    if any(token in normalized for token in ("wrazliw", "lagodz", "kojac", "naczyn")):
        skin_types.append("Wrażliwa")
    if any(token in normalized for token in ("tradzik", "niedoskonal", "sebum")):
        skin_types.append("Problematyczna")
    if any(token in normalized for token in ("such", "nawilz")):
        skin_types.append("Sucha")

    return {
        "productCategory": category,
        "productFamily": family,
        "manufacturerUses": uses,
        "treatmentCategories": list(dict.fromkeys(categories)),
        "applicationAreas": areas,
        "keyIngredients": ingredients,
        "skinTypes": list(dict.fromkeys(skin_types)),
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

    if len(cards) != 96:
        raise RuntimeError(f"Oczekiwano 96 kart, znaleziono {len(cards)}")

    LOGO_PATH.write_bytes(fetch(LOGO_URL))
    products = []
    for card in cards.values():
        local_image = IMAGE_DIR / f"{card.product_id}.webp"
        image_data = fetch(card.image_url)
        if len(image_data) < 1_000:
            raise RuntimeError(f"Nieprawidłowe zdjęcie produktu {card.product_id}")
        local_image.write_bytes(image_data)

        metadata = classify(card.name, card.series)
        slug = f"{card.product_id}-{slugify(card.name)}"
        products.append(
            {
                "id": card.product_id,
                "slug": slug,
                "name": card.name,
                "brand": "Sensum Mare",
                "series": card.series or "Sensum Mare",
                "summary": (
                    f"{card.name} z linii {card.series} marki Sensum Mare. "
                    "Pozycja z pełnej, oficjalnej oferty sklepu marki."
                ),
                "presentation": presentation(card.name),
                **metadata,
                "aliases": list(
                    dict.fromkeys(
                        [
                            card.series,
                            card.name,
                            card.name.rsplit(" ", 1)[0],
                            "Sensum Mare",
                        ]
                    )
                ),
                "sourceUrl": card.url,
                "imagePath": f"/beautydocs/catalog/sensum-mare/{local_image.name}",
                "imageAlt": f"{card.name} — oficjalne zdjęcie produktu Sensum Mare",
                "offer": {
                    "seller": "Sensum Mare",
                    "pricePln": parse_price(card.price_text),
                    "shippingPricePln": None,
                    "availability": card.availability,
                    "url": card.url,
                    "sourceType": "STORE",
                    "updatedAt": REVIEWED_AT,
                },
            }
        )

    payload = {
        "source": SOURCE_URL,
        "reviewedAt": REVIEWED_AT,
        "count": len(products),
        "scope": "Pełna publiczna kategoria kosmetyków Sensum Mare: trzy strony i warianty",
        "products": products,
    }
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Gotowe: {len(products)} produktów → {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
