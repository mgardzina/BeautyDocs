#!/usr/bin/env python3
"""Build the reviewed MAKEUP.pl face-care snapshot used by BeautyDocs.

The source category contains tens of thousands of listings.  This importer keeps a
small, explicit starter set whose product name, active variant, price and gallery
were checked in the public shop on 2026-08-23.  Re-running it refreshes the local
image assets without silently expanding the editorial scope.
"""

from __future__ import annotations

import json
import mimetypes
import re
import unicodedata
from pathlib import Path
from urllib.request import Request, urlopen

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "apps/api/app/services/makeup_catalog.json"
IMAGE_DIR = PROJECT_ROOT / "public/beautydocs/catalog/makeup"
SOURCE_URL = "https://makeup.pl/categorys/20273/"
REVIEWED_AT = "2026-08-23"


PRODUCTS = [
    (
        "584938",
        "NIVEA Cellular Luminous630®",
        "NIVEA",
        "Zaawansowane serum – kuracja na przebarwienia",
        "30 ml",
        48.39,
        "Nawilżanie, Odbudowa, Wyrównywanie kolorytu",
        "Alkohol, Gliceryna, Kwas hialuronowy, Witamina C, Witamina E",
        "Każdy rodzaj",
    ),
    (
        "936689",
        "NIVEA Cellular Luminous630 – zestaw",
        "NIVEA",
        "Zestaw do pielęgnacji twarzy",
        "fluid 40 ml + serum 30 ml",
        92.39,
        "Odbudowa, Rozjaśnianie, Wyrównywanie kolorytu",
        "Gliceryna, Kwas hialuronowy, Witamina C, Witamina E",
        "Każdy rodzaj",
    ),
    (
        "341003",
        "Mixa Hyalurogel Moisturizing Face Cream",
        "Mixa",
        "Nawilżający krem do twarzy",
        "50 ml",
        30.52,
        "Nawilżanie, Ukojenie",
        "Gliceryna, Kwas hialuronowy, Masło Shea",
        "Sucha, Wrażliwa",
    ),
    (
        "684600",
        "Lancôme Rénergie H.C.F. Triple Serum",
        "Lancôme",
        "Przeciwstarzeniowe serum do twarzy o potrójnym działaniu",
        "20 ml / 50 ml",
        243.00,
        "Nawilżanie, Odbudowa, Przeciw starzeniu, Wyrównywanie kolorytu",
        "Kwas ferulowy, Kwas salicylowy, Niacynamid, Witamina C, Witamina E",
        "Każdy rodzaj",
    ),
    (
        "93649",
        "La Roche-Posay Effaclar Duo+M",
        "La Roche-Posay",
        "Krem przeciw niedoskonałościom, przebarwieniom potrądzikowym i nawrotom",
        "40 ml",
        44.27,
        "Przeciw trądzikowi, Przeciw wągrom, Przeciw zapaleniom",
        "Ceramidy, Cynk PCA, Kwas salicylowy, Niacynamid",
        "Problematyczna, Tłusta, Wrażliwa",
    ),
    (
        "225407",
        "L'Oréal Paris Revitalift Filler Night Cream",
        "L'Oréal Paris",
        "Przeciwstarzeniowy krem na noc z kwasem hialuronowym",
        "50 ml",
        42.76,
        "Odżywianie, Przeciw starzeniu",
        "Gliceryna, Kofeina, Kwas hialuronowy, Witamina E",
        "Każdy rodzaj",
    ),
    (
        "543151",
        "L'Oréal Paris Revitalift Filler HA Serum",
        "L'Oréal Paris",
        "Przeciwzmarszczkowe serum z kwasem hialuronowym",
        "30 ml",
        38.23,
        "Nawilżanie, Przeciw starzeniu, Przeciw zmarszczkom",
        "Kwas hialuronowy, Kwas salicylowy, Peptydy, Witamina C",
        "Każdy rodzaj",
    ),
    (
        "689058",
        "Mixa Hydrating Hyalurogel Intensive Hydration",
        "Mixa",
        "Nawilżający krem-żel do skóry normalnej i wrażliwej",
        "50 ml",
        25.34,
        "Nawilżanie, Ukojenie",
        "Cynk, Gliceryna, Kwas hialuronowy, Skwalan",
        "Normalna, Sucha, Wrażliwa",
    ),
    (
        "856193",
        "Garnier Hyaluronic Cryo Jelly Sheet Mask",
        "Garnier",
        "Hialuronowa maska w płachcie",
        "27 g",
        8.23,
        "Nawilżanie, Ochłodzenie, Odbudowa, Ukojenie",
        "Gliceryna, Kwas hialuronowy, Mentol, Ogórek",
        "Sucha, Wrażliwa",
    ),
    (
        "78919",
        "L'Oréal Paris Revitalift Laser X3 Night Cream-Mask",
        "L'Oréal Paris",
        "Regenerujący krem-maska anti-age na noc",
        "50 ml",
        42.37,
        "Odbudowa, Przeciw starzeniu, Wyrównywanie kolorytu",
        "Centella Asiatica, Kwas hialuronowy, Peptydy, Witamina A, Witamina C",
        "Każdy rodzaj",
    ),
    (
        "742401",
        "NIVEA Q10 Power Mask",
        "NIVEA",
        "Maseczka w płachcie z serum przeciwzmarszczkowym",
        "1 szt. / 28 g",
        8.11,
        "Lifting, Odżywianie, Przeciw zmarszczkom, Wygładzanie",
        "Gliceryna, Ubichinon",
        "Każdy rodzaj",
    ),
    (
        "862473",
        "Lancôme Rénergie H.P.N. 300-Peptide Cream",
        "Lancôme",
        "Krem z peptydami, kwasem hialuronowym i niacynamidem",
        "30 ml / 50 ml",
        222.00,
        "Lifting, Przeciw starzeniu, Wyrównywanie kolorytu",
        "Kwas hialuronowy, Niacynamid, Proteiny, Witamina E",
        "Każdy rodzaj",
    ),
    (
        "631145",
        "Mixa Hyalurogel Serum",
        "Mixa",
        "Nawilżające serum do skóry wrażliwej, normalnej i suchej",
        "30 ml",
        55.41,
        "Nawilżanie, Odżywianie, Zmiękczanie",
        "Gliceryna, Kwas hialuronowy, Niacynamid, Pantenol",
        "Normalna, Sucha, Wrażliwa",
    ),
    (
        "741365",
        "Garnier Skin Naturals Super Serum",
        "Garnier",
        "Serum na przebarwienia z witaminą C",
        "30 ml",
        31.99,
        "Rozjaśnianie, Wyrównywanie kolorytu, Zmiękczanie",
        "Kwas hialuronowy, Kwas salicylowy, Niacynamid, Witamina C",
        "Każdy rodzaj",
    ),
    (
        "526751",
        "Lancôme Hydra Zen Glow Liquid Moisturizer",
        "Lancôme",
        "Lekki krem nawilżający i kojący, dodający skórze blasku",
        "50 ml",
        208.00,
        "Nawilżanie, Odżywianie, Rozświetlanie, Ukojenie",
        "Aloes, Arginina, Jojoba, Masło Shea, Skwalan, Witamina E",
        "Każdy rodzaj",
    ),
    (
        "944239",
        "Mixa Panthenol Comfort Anti-Scratching Cream",
        "Mixa",
        "Krem do twarzy, ciała i rąk",
        "150 ml / 400 ml",
        31.89,
        "Nawilżanie, Ukojenie",
        "Omega, Pantenol",
        "Sucha, Wrażliwa",
    ),
    (
        "621672",
        "Biotherm Aquasource Cica Nutri Cream",
        "Biotherm",
        "Nawilżający krem do cery suchej",
        "50 ml",
        134.00,
        "Nawilżanie, Ukojenie",
        "Ceramidy, Cynk, Gliceryna, Masło Shea, Witamina E",
        "Sucha",
    ),
    (
        "1143385",
        "L'Oréal Paris Revitalift Glass Skin Hydrogel Glow Mask",
        "L'Oréal Paris",
        "Hydrożelowa maska rozświetlająca do twarzy",
        "25 g",
        23.58,
        "Nawilżanie, Rozświetlanie, Wygładzanie",
        "Alantoina, Centella Asiatica, Kwas hialuronowy, Pantenol, Trehaloza",
        "Każdy rodzaj",
    ),
    (
        "420302",
        "Vichy Liftactiv Collagen Specialist 16",
        "Vichy",
        "Krem na dzień na drobne linie i zmarszczki",
        "50 ml",
        141.00,
        "Lifting, Odbudowa, Przeciw starzeniu, Przeciw zmarszczkom",
        "Kwas fitynowy, Kwasy AHA, Niacynamid, Peptydy, Witamina C",
        "Każdy rodzaj",
    ),
    (
        "890702",
        "NIVEA Cellular Luminous630 Anti-Age Serum 2w1",
        "NIVEA",
        "Serum 2w1 na przebarwienia i zmarszczki",
        "30 ml",
        48.10,
        "Przeciw zmarszczkom, Wygładzanie, Wyrównywanie kolorytu",
        "Luminous630",
        "Każdy rodzaj",
    ),
]


GALLERIES = {
    "584938": [
        "https://is3.makeup.pl/p/p9/p9cb84jxilqd.png",
        "https://is3.makeup.pl/d/do/dogbovssbfsg.png",
        "https://is3.makeup.pl/o/og/ogswjpkfx1vz.png",
    ],
    "936689": [
        "https://is3.makeup.pl/u/u2/u2iu7pq3bvja.png",
        "https://is3.makeup.pl/l/li/li5z1gbnc460.png",
        "https://is3.makeup.pl/l/ls/lswtejivikzj.png",
    ],
    "341003": [
        "https://is3.makeup.pl/3/3i/3ib5ihkltvvn.png",
        "https://is3.makeup.pl/a/aj/ajb8odecr5xi.png",
        "https://is3.makeup.pl/a/ax/axeaprjjgmvf.png",
    ],
    "684600": [
        "https://is3.makeup.pl/4/4z/4zvmamnjodry.jpg",
        "https://is3.makeup.pl/j/ja/janmpthqweia.jpg",
        "https://is3.makeup.pl/n/nl/nlpx1xxkrl3r.png",
    ],
    "93649": [
        "https://is3.makeup.pl/s/sd/sduwanwq78du.jpg",
        "https://is3.makeup.pl/w/wl/wlglubjhiums.jpg",
        "https://is3.makeup.pl/m/m5/m5s5ypijzhnj.jpg",
    ],
    "225407": [
        "https://is3.makeup.pl/a/ax/ax9sytcx3t7o.png",
        "https://is3.makeup.pl/t/tm/tmhodzwva4bt.png",
        "https://is3.makeup.pl/t/te/tepikxqlpzyu.jpg",
    ],
    "543151": [
        "https://is3.makeup.pl/t/t3/t3wtafnu8hdm.jpg",
        "https://is3.makeup.pl/z/zu/zuxiekbak5ri.jpg",
        "https://is3.makeup.pl/m/mm/mmclcunjkhov.jpg",
    ],
    "689058": [
        "https://is3.makeup.pl/r/rr/rrzgoxsezw8p.jpg",
        "https://is3.makeup.pl/g/g0/g0gnihkqki0l.jpg",
        "https://is3.makeup.pl/s/sx/sxcdplhjlqet.jpg",
    ],
    "856193": [
        "https://is3.makeup.pl/1/1x/1xbfhhgulnv4.jpg",
        "https://is3.makeup.pl/7/7s/7sbricmskucj.jpg",
    ],
    "78919": [
        "https://is3.makeup.pl/m/me/merbxlbepcbn.jpg",
        "https://is3.makeup.pl/z/z9/z9hrrxvibih6.png",
        "https://is3.makeup.pl/z/z3/z3dt25tpxwqz.png",
    ],
    "742401": [
        "https://is3.makeup.pl/k/kn/kns1y9jctonk.jpg",
        "https://is3.makeup.pl/r/rx/rxwuic8fgw9p.jpg",
        "https://is3.makeup.pl/l/lk/lkhmhc3u3dpc.png",
    ],
    "862473": [
        "https://is3.makeup.pl/g/gb/gb8tyiole296.png",
        "https://is3.makeup.pl/h/hf/hf01x91fqt32.jpg",
        "https://is3.makeup.pl/s/ss/ssiar5xdkcv1.png",
    ],
    "631145": [
        "https://is3.makeup.pl/j/jq/jq7zt4jow25v.webp",
        "https://is3.makeup.pl/t/t2/t297vpnxhkkg.webp",
        "https://is3.makeup.pl/g/gl/gldclk0ifpbm.webp",
    ],
    "741365": [
        "https://is3.makeup.pl/t/t9/t9ctzqpzrixk.jpg",
        "https://is3.makeup.pl/5/5e/5eg77rkczzuw.jpg",
        "https://is3.makeup.pl/3/3z/3zem08k10kej.jpg",
    ],
    "526751": [
        "https://is3.makeup.pl/s/sn/snlueolfhegh.jpg",
        "https://is3.makeup.pl/x/xi/xirswmnzwf9s.png",
        "https://is3.makeup.pl/f/fi/fiq0sazza3s2.jpg",
    ],
    "944239": [
        "https://is3.makeup.pl/p/p0/p0xbt5azbg7c.png",
        "https://is3.makeup.pl/m/mj/mjklmkwrmnke.webp",
        "https://is3.makeup.pl/a/as/asj54zj7m9ne.webp",
    ],
    "621672": [
        "https://is3.makeup.pl/t/ti/ti3gheqynydj.jpg",
        "https://is3.makeup.pl/2/21/21noj7swwr20.jpg",
        "https://is3.makeup.pl/f/fj/fjxk4jk8acdy.jpg",
    ],
    "1143385": [
        "https://is3.makeup.pl/s/su/suutofg1snsf.jpg",
        "https://is3.makeup.pl/8/8r/8rxyjhhi6ibp.jpg",
        "https://is3.makeup.pl/u/uq/uqyqmaomvaxu.jpg",
    ],
    "420302": [
        "https://is3.makeup.pl/l/lx/lxd1ufdq645q.png",
        "https://is3.makeup.pl/y/yj/yjc9it2zqddx.png",
        "https://is3.makeup.pl/q/qs/qsf4ooirxvyr.png",
    ],
    "890702": [
        "https://is3.makeup.pl/d/df/dfvwn8g8hkd1.png",
        "https://is3.makeup.pl/x/xg/xgwboam7noaw.png",
        "https://is3.makeup.pl/1/1x/1xhrrg3t7dox.jpg",
    ],
}


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold()).replace("ł", "l")
    ascii_value = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")


def family_for(name: str, descriptor: str) -> str:
    value = f"{name} {descriptor}".casefold()
    if "zestaw" in value:
        return "Zestaw do pielęgnacji twarzy"
    if "maska" in value or "maseczka" in value:
        return "Maska do twarzy"
    if "serum" in value:
        return "Serum do twarzy"
    return "Krem do twarzy"


def treatment_categories(action: str, descriptor: str) -> list[str]:
    value = f"{action} {descriptor}".casefold()
    categories = ["Pielęgnacja twarzy", "Pielęgnacja domowa"]
    checks = (
        (("nawilż",), "Nawilżanie"),
        (("przebarw", "koloryt", "rozjaś"), "Przebarwienia i koloryt"),
        (("przeciw starz", "zmarszcz", "lifting", "peptyd"), "Pielęgnacja pro-aging"),
        (("trądz", "niedoskona", "wągr"), "Skóra trądzikowa i niedoskonałości"),
        (("maska", "maseczka"), "Maski i terapie gabinetowe"),
        (("ukojen", "wrażliw"), "Skóra wrażliwa i reaktywna"),
    )
    for needles, label in checks:
        if any(needle in value for needle in needles):
            categories.append(label)
    return list(dict.fromkeys(categories))


def download_image(url: str, target: Path) -> None:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 BeautyDocsCatalog/1.0"})
    with urlopen(request, timeout=30) as response:  # noqa: S310 - reviewed HTTPS source
        data = response.read()
    if len(data) < 500:
        raise RuntimeError(f"Nieprawidłowy plik obrazu: {url}")
    target.write_bytes(data)


def main() -> None:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    snapshot_products = []
    for product in PRODUCTS:
        (
            product_id,
            name,
            brand,
            descriptor,
            volume,
            price,
            action,
            ingredients,
            skin,
        ) = product
        images = []
        for index, image_url in enumerate(GALLERIES[product_id], start=1):
            suffix = Path(image_url.split("?", 1)[0]).suffix.lower()
            if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
                suffix = mimetypes.guess_extension("image/jpeg") or ".jpg"
            target = IMAGE_DIR / f"{product_id}-{index}{suffix}"
            download_image(image_url, target)
            public_path = f"/beautydocs/catalog/makeup/{target.name}"
            images.append(
                {
                    "path": public_path,
                    "alt": f"{name} — zdjęcie {index} z oferty MAKEUP",
                    "label": "Produkt" if index == 1 else f"Zdjęcie {index}",
                    "fit": "cover",
                }
            )

        application_areas = [{"code": "FACE", "label": "Skóra twarzy"}]
        if product_id == "944239":
            application_areas.extend(
                [
                    {"code": "BODY", "label": "Skóra ciała"},
                    {"code": "HANDS", "label": "Dłonie"},
                ]
            )
        product_url = f"https://makeup.pl/product/{product_id}/"
        snapshot_products.append(
            {
                "id": product_id,
                "slug": f"{product_id}-{slugify(name)}",
                "name": name,
                "brand": brand,
                "summary": descriptor,
                "presentation": volume,
                "productCategory": "Kosmetyk pielęgnacyjny",
                "productFamily": family_for(name, descriptor),
                "manufacturerUses": [
                    value.strip() for value in action.split(",") if value.strip()
                ],
                "treatmentCategories": treatment_categories(action, descriptor),
                "applicationAreas": application_areas,
                "keyIngredients": [
                    value.strip() for value in ingredients.split(",") if value.strip()
                ],
                "skinTypes": [
                    value.strip() for value in skin.split(",") if value.strip()
                ],
                "aliases": [brand, descriptor, name.replace("®", "")],
                "sourceUrl": product_url,
                "imagePath": images[0]["path"],
                "imageAlt": images[0]["alt"],
                "additionalImages": images[1:],
                "offer": {
                    "seller": f"MAKEUP — {volume}",
                    "pricePln": price,
                    "shippingPricePln": None,
                    "availability": "IN_STOCK",
                    "url": product_url,
                    "sourceType": "MARKETPLACE",
                    "updatedAt": REVIEWED_AT,
                },
            }
        )

    payload = {
        "source": SOURCE_URL,
        "reviewedAt": REVIEWED_AT,
        "count": len(snapshot_products),
        "scope": "Wybrana seria popularnych kosmetyków do pielęgnacji twarzy",
        "products": snapshot_products,
    }
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Gotowe: {len(snapshot_products)} produktów → {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
