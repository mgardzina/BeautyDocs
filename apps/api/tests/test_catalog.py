# ruff: noqa: RUF001 -- Assertions verify user-facing typographic copy.

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.api.routes.catalog import (
    CatalogProductListResponse,
    SalonCatalogCreateRequest,
    _catalog_response,
)
from app.models.domain import CatalogItemKind, CatalogItemSource
from app.services.catalog import (
    _rpl_item,
    get_public_catalog_product,
    list_public_catalog_products,
    normalize_catalog_search,
    public_catalog_product_slug,
    resolve_catalog_snapshot,
    search_curated_catalog,
)

API_ROOT = Path(__file__).resolve().parents[1]
MIGRATION = API_ROOT / "alembic" / "versions" / "20260816_0029_salon_catalog.py"
MIRROR_MIGRATION = API_ROOT / "alembic" / "versions" / "20260816_0030_medicine_catalog_mirror.py"


def test_catalog_search_normalizes_polish_text_and_finds_device_alias() -> None:
    assert normalize_catalog_search("  ŁÓDŹ  ") == "lodz"
    matches = search_curated_catalog("laser diodowy 805 1060")
    assert [item.external_id for item in matches] == ["professional-device:lightsheer-quattro"]


def test_catalog_contains_branded_professional_products_with_traceable_details() -> None:
    matches = search_curated_catalog("Revolax Deep")

    assert [item.external_id for item in matches] == ["professional-product:revolax-deep-1-1ml"]
    product = matches[0]
    assert product.brand == "REVOLAX / Across"
    assert product.details["catalogProfile"] == "PROFESSIONAL_PRODUCT"
    assert product.details["presentation"] == "1 × 1,1 ml"
    assert product.details["containsLidocaine"] is True
    assert product.details["manufacturerUses"]
    assert product.details["imagePath"] == "/beautydocs/catalog/revolax-deep.png"
    assert product.details["productImages"][0]["path"] == product.details["imagePath"]
    assert product.details["productImages"][0]["scale"] == 1.5
    assert product.details["applicationAreas"] == [
        {"code": "NASOLABIAL_FOLDS", "label": "Bruzdy nosowo-wargowe"},
        {"code": "LIPS", "label": "Usta i ich kontur"},
    ]
    assert len(product.details["sourceDocuments"]) >= 2


def test_catalog_searches_professional_products_by_brand_and_variant() -> None:
    neuramis = search_curated_catalog("Medytox")
    teosyal = search_curated_catalog("RHA Kiss")

    assert any(item.name == "Neuramis Deep 1,0 ml" for item in neuramis)
    assert [item.name for item in teosyal] == ["TEOSYAL RHA Kiss 0,7 ml"]


def test_catalog_replaces_generic_placeholders_with_named_products() -> None:
    external_ids = {item.external_id for item in search_curated_catalog("")}

    assert {
        "substance:hyaluronic-acid",
        "substance:niacinamide",
        "substance:panthenol",
        "substance:calcium-hydroxylapatite",
        "device:diode-laser",
        "device:alexandrite-laser",
        "device:nd-yag-laser",
        "device:ipl",
        "cosmetic:gentle-cleanser",
        "cosmetic:barrier-cream",
        "cosmetic:sunscreen-spf50",
    }.isdisjoint(external_ids)


def test_branded_devices_and_cosmetics_have_official_images_and_sources() -> None:
    device = search_curated_catalog("Soprano Titanium")[0]
    cosmetic = search_curated_catalog("Cicaplast Baume B5+")[0]

    assert device.kind == CatalogItemKind.DEVICE.value
    assert device.details["imagePath"].startswith("/beautydocs/catalog/")
    assert device.details["technologies"]
    assert device.details["sourceDocuments"]
    assert cosmetic.kind == CatalogItemKind.COSMETIC.value
    assert cosmetic.details["imagePath"].startswith("/beautydocs/catalog/")
    assert cosmetic.details["availableSizes"]
    assert cosmetic.details["keyIngredients"]
    assert cosmetic.details["applicationAreas"] == [
        {"code": "FACE", "label": "Skóra twarzy"},
        {"code": "BODY", "label": "Skóra ciała"},
    ]


def test_makeup_offers_are_matched_to_exact_product_variants() -> None:
    expected = {
        "professional-cosmetic:cicaplast-baume-b5-plus": ("40 ml", 39.30),
        "professional-cosmetic:cicaplast-baume-b5-spf50": ("40 ml", 62.34),
        "professional-cosmetic:avene-cicalfate-plus": ("40 ml", 44.99),
        "professional-cosmetic:bioderma-cicabio-creme-plus": ("40 ml", 36.16),
        "professional-cosmetic:uriage-bariederm-cica": ("15 ml", 26.03),
    }

    products = {item.external_id: item for item in list_public_catalog_products()}
    for external_id, (size, price) in expected.items():
        makeup_offers = [
            offer
            for offer in products[external_id].details["offers"]
            if offer["seller"].startswith("MAKEUP")
        ]
        assert makeup_offers == [
            {
                "seller": f"MAKEUP — {size}",
                "pricePln": price,
                "shippingPricePln": None,
                "availability": "IN_STOCK",
                "url": makeup_offers[0]["url"],
                "sourceType": "MARKETPLACE",
                "updatedAt": "2026-08-23",
            }
        ]
        assert makeup_offers[0]["url"].startswith("https://makeup.pl/product/")


def test_hair_removal_devices_use_body_selector_zones_and_quote_workflow() -> None:
    project_root = API_ROOT.parents[1]
    devices = [
        item
        for item in list_public_catalog_products()
        if item.external_id.startswith("professional-device:")
        and "Epilacja laserowa" in item.details["treatmentCategories"]
    ]

    assert len(devices) == 5
    for device in devices:
        assert device.details["offers"] == []
        assert device.details["priceComparison"]["status"] == "REQUEST_QUOTE"
        assert device.details["priceComparison"]["quoteUrl"].startswith("https://")
        assert {area["code"] for area in device.details["applicationAreas"]} == {
            "FACE",
            "UNDERARMS",
            "ARMS",
            "CHEST",
            "BACK",
            "BIKINI",
            "LEGS",
        }
        assert (project_root / "public" / device.details["imagePath"].lstrip("/")).is_file()


def test_public_catalog_brand_logos_exist_and_missing_prices_are_intentional() -> None:
    project_root = API_ROOT.parents[1]
    products = list_public_catalog_products()
    logos = {
        item.details["brandLogoPath"] for item in products if item.details.get("brandLogoPath")
    }
    products_without_offers = [item for item in products if not item.details.get("offers")]

    assert len(logos) >= 19
    assert all((project_root / "public" / path.lstrip("/")).is_file() for path in logos)
    assert {item.details["priceComparison"]["status"] for item in products_without_offers} == {
        "ACTIVE",
        "REQUEST_QUOTE",
        "INFORMATION_ONLY",
    }
    assert all(
        item.details.get("officialReferencePrice")
        for item in products_without_offers
        if item.details["priceComparison"]["status"] == "ACTIVE"
    )
    assert len(products_without_offers) == 654


def test_uriage_product_uses_uploaded_multi_image_gallery() -> None:
    product = search_curated_catalog("Uriage Bariederm")[0]
    images = product.details["productImages"]
    project_root = API_ROOT.parents[1]

    assert product.details["imagePath"] == (
        "/beautydocs/catalog/uriage-bariederm-cica-product.webp"
    )
    assert len(images) == 7
    assert images[0]["path"] == product.details["imagePath"]
    assert images[-1]["label"] == "Konsystencja"
    assert len({image["path"] for image in images}) == len(images)
    assert all((project_root / "public" / image["path"].lstrip("/")).is_file() for image in images)


def test_public_catalog_products_have_unique_stable_slugs_and_filter_facets() -> None:
    products = list_public_catalog_products()
    slugs = [public_catalog_product_slug(item) for item in products]
    response = CatalogProductListResponse(items=[_catalog_response(item) for item in products])

    assert len(products) == 1716
    assert len(response.items) == 1716
    assert None not in slugs
    assert len(set(slugs)) == len(slugs)
    assert all(item.brand for item in products)
    assert all(item.details["treatmentCategories"] for item in products)
    assert all(item.details["productImages"] for item in products)
    assert get_public_catalog_product("revolax-deep-1-1ml") is not None
    assert get_public_catalog_product("../sekret") is None


def test_healthlabs_snapshot_adds_complete_official_catalog() -> None:
    products = [item for item in list_public_catalog_products() if item.brand == "Health Labs Care"]
    project_root = API_ROOT.parents[1]

    assert len(products) == 69
    assert sum(item.details["productCategory"] == "Zestaw kosmetyków" for item in products) == 26
    assert all(len(item.details["offers"]) == 1 for item in products)
    assert all(item.details["offers"][0]["seller"] == "Health Labs Care" for item in products)
    assert all(item.details["offers"][0]["shippingPricePln"] == 16.0 for item in products)
    assert all(item.details["offers"][0]["updatedAt"] == "2026-08-25" for item in products)
    assert all(
        item.details["imagePath"].startswith("/beautydocs/catalog/healthlabs/") for item in products
    )
    assert all(
        (project_root / "public" / item.details["imagePath"].lstrip("/")).is_file()
        for item in products
    )
    assert all(
        item.details["sourceDocuments"][0]["url"].startswith(
            "https://www.healthlabs.care/pl/produkt/"
        )
        for item in products
    )
    assert all(
        item.details["brandLogoPath"] == "/beautydocs/brands/health-labs-care.svg"
        for item in products
    )

    sensi = get_public_catalog_product("healthlabs-krem-kojacy-sensi-on")
    body_serum = get_public_catalog_product("healthlabs-serum-zluszczajace-do-ciala-glow-on")
    hair_shampoo = get_public_catalog_product("healthlabs-szampon-dla-mezczyzn-gentle-on")
    assert sensi is not None
    assert sensi.details["presentation"] == "50 ml"
    assert sensi.details["offers"][0]["pricePln"] == 139.0
    assert sensi.details["applicationAreas"] == [{"code": "FACE", "label": "Skóra twarzy"}]
    assert body_serum is not None
    assert body_serum.details["applicationAreas"] == [{"code": "BODY", "label": "Skóra ciała"}]
    assert hair_shampoo is not None
    assert hair_shampoo.details["applicationAreas"] == []


def test_dmcell_snapshot_adds_official_catalog_with_quote_workflow() -> None:
    products = [item for item in list_public_catalog_products() if item.brand == "DM.Cell"]
    project_root = API_ROOT.parents[1]

    assert len(products) == 63
    assert sum(item.details["professionalOnly"] for item in products) == 57
    assert all(item.details["offers"] == [] for item in products)
    assert all(item.details["priceComparison"]["status"] == "REQUEST_QUOTE" for item in products)
    assert all(
        item.details["priceComparison"]["quoteUrl"] == "https://dmcell.pl/#kontakt"
        for item in products
    )
    assert all(
        item.details["brandLogoPath"] == "/beautydocs/brands/dmcell.png" for item in products
    )
    assert all(
        (project_root / "public" / image["path"].lstrip("/")).is_file()
        for item in products
        for image in item.details["productImages"]
    )

    retinal = get_public_catalog_product("dmcell-midnight-retinal-glow-serum")
    assert retinal is not None
    assert retinal.details["presentation"] == "30ml"
    assert retinal.details["officialReferencePrice"] == {
        "amount": 52.0,
        "currency": "USD",
        "availability": "InStock",
        "sourceUrl": "https://us.dmcell.com/80/?idx=334",
        "updatedAt": "2026-08-23",
    }
    assert len(retinal.details["productImages"]) == 3


def test_makeup_snapshot_adds_visible_product_cards_with_prices_and_galleries() -> None:
    products = [
        item
        for item in list_public_catalog_products()
        if item.external_id.startswith("professional-cosmetic:makeup-")
    ]
    project_root = API_ROOT.parents[1]

    assert len(products) == 20
    assert all(len(item.details["offers"]) == 1 for item in products)
    assert all(item.details["offers"][0]["seller"].startswith("MAKEUP —") for item in products)
    assert all(item.details["offers"][0]["pricePln"] > 0 for item in products)
    assert all(2 <= len(item.details["productImages"]) <= 3 for item in products)
    assert all(
        (project_root / "public" / image["path"].lstrip("/")).is_file()
        for item in products
        for image in item.details["productImages"]
    )
    assert all(item.details.get("brandLogoPath") for item in products)

    effaclar = get_public_catalog_product("makeup-93649-la-roche-posay-effaclar-duo-m")
    assert effaclar is not None
    assert effaclar.details["presentation"] == "40 ml"
    assert effaclar.details["offers"][0]["pricePln"] == 44.27
    assert len(effaclar.details["productImages"]) == 3


def test_luvee_snapshot_adds_pure_mist_with_price_gallery_logo_and_body_map() -> None:
    product = get_public_catalog_product("luvee-pure-mist")
    project_root = API_ROOT.parents[1]

    assert product is not None
    assert product.brand == "Luvée"
    assert product.details["presentation"] == "100 ml • butelka z atomizerem"
    assert product.details["offers"] == [
        {
            "seller": "LUVEE",
            "pricePln": 99.0,
            "shippingPricePln": None,
            "availability": "IN_STOCK",
            "url": "https://luvee.pl/products/luvee",
            "sourceType": "STORE",
            "updatedAt": "2026-08-23",
        }
    ]
    assert product.details["brandLogoPath"] == "/beautydocs/brands/luvee.png"
    assert product.details["applicationAreas"] == [
        {"code": "FACE", "label": "Skóra twarzy"},
        {"code": "BODY", "label": "Skóra ciała po goleniu lub depilacji"},
    ]
    assert len(product.details["productImages"]) == 4
    assert all(
        (project_root / "public" / image["path"].lstrip("/")).is_file()
        for image in product.details["productImages"]
    )


def test_sensum_mare_snapshot_adds_complete_catalog_prices_images_and_logo() -> None:
    products = [item for item in list_public_catalog_products() if item.brand == "Sensum Mare"]
    project_root = API_ROOT.parents[1]

    assert len(products) == 96
    assert sum(item.details["productCategory"] == "Zestaw kosmetyków" for item in products) == 25
    assert all(len(item.details["offers"]) == 1 for item in products)
    assert all(item.details["offers"][0]["seller"] == "Sensum Mare" for item in products)
    assert all(item.details["offers"][0]["pricePln"] > 0 for item in products)
    assert all(
        item.details["brandLogoPath"] == "/beautydocs/brands/sensum-mare.svg" for item in products
    )
    assert all(
        item.details["imagePath"].startswith("/beautydocs/catalog/sensum-mare/")
        for item in products
    )
    assert all(
        (project_root / "public" / item.details["imagePath"].lstrip("/")).is_file()
        for item in products
    )

    mist = get_public_catalog_product(
        "sensum-mare-166-rozswietlajaca-mgielka-zapachowa-z-drobinkami"
    )
    tonic = get_public_catalog_product("sensum-mare-165-mikrobiotyczny-tonik-lagodzacy-200ml")
    assert mist is not None
    assert mist.details["sourceLine"] == "ALGOGLOW"
    assert mist.details["offers"][0]["pricePln"] == 139.0
    assert tonic is not None
    assert tonic.details["presentation"] == "200ml"
    assert tonic.details["offers"][0]["pricePln"] == 79.0


def test_gigi_snapshot_adds_full_range_without_exposing_hidden_prices() -> None:
    products = [
        item for item in list_public_catalog_products() if item.brand == "GIGI Laboratories"
    ]
    project_root = API_ROOT.parents[1]

    assert len(products) == 145
    assert sum(item.details["professionalOnly"] for item in products) == 71
    assert (
        sum(item.details["productCategory"] == "Protokół zabiegowy GIGI" for item in products) == 1
    )
    assert all(item.details["offers"] == [] for item in products)
    assert all(item.details["priceComparison"]["status"] == "REQUEST_QUOTE" for item in products)
    assert all(
        item.details["priceComparison"]["quoteUrl"].startswith("https://gigipoland.pl/product/")
        for item in products
    )
    assert all(
        item.details["brandLogoPath"] == "/beautydocs/brands/gigi-poland.svg" for item in products
    )
    assert all(
        (project_root / "public" / item.details["imagePath"].lstrip("/")).is_file()
        for item in products
    )


def test_instytutum_snapshot_adds_full_range_images_logo_and_direct_prices() -> None:
    products = [item for item in list_public_catalog_products() if item.brand == "INSTYTUTUM"]
    project_root = API_ROOT.parents[1]

    assert len(products) == 52
    assert sum(bool(item.details["offers"]) for item in products) == 24
    assert all(
        item.details["brandLogoPath"] == "/beautydocs/brands/instytutum.svg" for item in products
    )
    assert all(item.details["officialReferencePrice"]["currency"] == "EUR" for item in products)
    assert all(item.details["officialReferencePrice"]["amount"] > 0 for item in products)
    assert all(
        offer["sourceType"] == "STORE"
        and "ceneo" not in offer["seller"].casefold()
        and "ceneo" not in offer["url"].casefold()
        for item in products
        for offer in item.details["offers"]
    )
    assert all(len(item.details["productImages"]) >= 1 for item in products)
    assert all(
        (project_root / "public" / item.details["imagePath"].lstrip("/")).is_file()
        for item in products
    )
    assert (project_root / "public/beautydocs/brands/instytutum.svg").is_file()


def test_partner_brand_snapshot_adds_complete_direct_catalogs() -> None:
    expected_counts = {
        "Pur Eden": 16,
        "Dermomedica": 162,
        "Authentic Beauty Concept": 88,
        "Belnea": 23,
        "La Guèl": 3,
        "Neauvia": 11,
        "Forlle'd": 2,
        "Caudalie": 103,
    }
    project_root = API_ROOT.parents[1]
    snapshot = json.loads(
        (API_ROOT / "app/services/partner_brand_catalogs.json").read_text(encoding="utf-8")
    )
    partner_products = snapshot["products"]

    assert len(partner_products) == 408
    assert {
        brand: sum(product["brand"] == brand for product in partner_products)
        for brand in expected_counts
    } == expected_counts
    assert sum(bool(product["offers"]) for product in partner_products) == 356
    assert len(snapshot["brandLogos"]) == 6
    assert all(
        (project_root / "public" / path.lstrip("/")).is_file()
        for path in snapshot["brandLogos"].values()
    )
    assert all(
        (project_root / "public" / product["imagePath"].lstrip("/")).is_file()
        for product in partner_products
    )
    assert all(
        "ceneo" not in offer["seller"].casefold() and "ceneo" not in offer["url"].casefold()
        for product in partner_products
        for offer in product["offers"]
    )


def test_extended_brand_snapshot_adds_catalogs_prices_images_and_application_maps() -> None:
    snapshot_path = API_ROOT / "app/services/extended_brand_catalogs.json"
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    project_root = API_ROOT.parents[1]

    assert snapshot["count"] == 820
    assert {group["name"]: group["count"] for group in snapshot["groups"]} == {
        "Skinfinity Care": 9,
        "Bioderma": 116,
        "Clayly": 12,
        "FEDUA": 143,
        "Oppoline": 8,
        "MedEstelle": 85,
        "TEOXANE": 15,
        "INFINI": 61,
        "ASK Beauty — popularne produkty do twarzy": 60,
        "SK Beauty — pielęgnacja twarzy": 313,
    }
    assert all(
        "ceneo" not in offer["seller"].casefold() and "ceneo" not in offer["url"].casefold()
        for product in snapshot["products"]
        for offer in product["offers"]
    )
    assert all(
        (project_root / "public" / product["imagePath"].lstrip("/")).is_file()
        for product in snapshot["products"]
    )
    assert all(
        (project_root / "public" / path.lstrip("/")).is_file()
        for path in snapshot["brandLogos"].values()
    )

    products = list_public_catalog_products()
    revolax = get_public_catalog_product("revolax-deep-1-1ml")
    fedua = [item for item in products if item.brand == "FEDUA"]
    teoxane = [item for item in products if item.brand == "TEOXANE"]
    medestelle = [item for item in products if item.brand == "MedEstelle"]
    infini_body = get_public_catalog_product("infini-b-body")

    assert revolax is not None
    assert any(offer["seller"] == "Skinfinity Care" for offer in revolax.details["offers"])
    assert len(fedua) == 143
    assert all(item.details["offers"] == [] for item in fedua)
    assert all(item.details["officialReferencePrice"]["currency"] == "EUR" for item in fedua)
    assert len(teoxane) == 15
    assert all(item.details["offers"][0]["seller"] == "TEOXANE" for item in teoxane)
    assert len(medestelle) == 83
    assert sum(bool(item.details["offers"]) for item in medestelle) == 42
    assert sum(
        item.details["priceComparison"]["status"] == "INFORMATION_ONLY"
        for item in medestelle
    ) == 41
    assert min(
        offer["pricePln"] for item in medestelle for offer in item.details["offers"]
    ) > 1
    assert infini_body is not None
    assert {area["code"] for area in infini_body.details["applicationAreas"]} == {"BODY"}


def test_public_catalog_uses_only_direct_store_or_marketplace_offers() -> None:
    offers = [
        offer for item in list_public_catalog_products() for offer in item.details.get("offers", [])
    ]

    assert offers
    assert all(offer["sourceType"] in {"STORE", "MARKETPLACE"} for offer in offers)
    assert all("ceneo" not in offer["seller"].casefold() for offer in offers)
    assert all("ceneo" not in offer["url"].casefold() for offer in offers)


def test_public_catalog_filter_categories_cover_key_treatment_areas() -> None:
    products = list_public_catalog_products()
    categories = {category for item in products for category in item.details["treatmentCategories"]}

    assert {
        "Epilacja laserowa",
        "Modelowanie ust",
        "Pielęgnacja pozabiegowa",
        "Regeneracja bariery skórnej",
        "Wypełniacze i modelowanie",
    }.issubset(categories)


def test_professional_fillers_use_local_official_packshots() -> None:
    project_root = API_ROOT.parents[1]
    fillers = [
        item
        for item in search_curated_catalog("")
        if item.kind == CatalogItemKind.TREATMENT_SUBSTANCE.value
        and item.details.get("productFamily") == "Wypełniacz skórny na bazie kwasu hialuronowego"
    ]
    image_paths = [item.details["imagePath"] for item in fillers if "imagePath" in item.details]

    assert len(fillers) == 17
    assert len(image_paths) == len(fillers)
    assert all((project_root / "public" / path.lstrip("/")).is_file() for path in image_paths)
    restylane = next(item for item in fillers if item.name == "Restylane Defyne 1,0 ml")
    assert "zdjęcie poglądowe rodziny" in restylane.details["imageNote"]


def test_requested_comparison_products_and_prices_are_available() -> None:
    requested_ids = {
        "professional-product:avalon-vital-plus",
        "professional-medicine:dexamethasone-sodium-phosphate-8mg-2ml-3",
        "professional-product:leedfrost-10-56-gel",
        "professional-product:neuramis-deep-1ml",
        "professional-product:progelcaine-gel-9-6",
        "professional-cosmetic:sadoer-aloe-vera-eye-mask",
        "professional-device:lumira-silicone-led-mask-7-colors",
        "professional-cosmetic:skin1004-centella-cream-75ml",
        "professional-cosmetic:skin1004-centella-toner-210ml",
        "professional-cosmetic:skin1004-hyalu-cica-sun-serum-spf50-50ml",
        "professional-cosmetic:skin1004-centella-light-cleansing-oil-200ml",
        "professional-cosmetic:skin1004-centella-ampoule-100ml",
        "professional-cosmetic:skin1004-centella-cleansing-foam",
        "professional-cosmetic:skin1004-centella-full-size-set",
        "professional-product:liquid-anesthetic-15ml-pmu-brows",
    }
    products = {item.external_id: item for item in list_public_catalog_products()}

    assert requested_ids.issubset(products)
    assert (
        products["professional-cosmetic:sadoer-aloe-vera-eye-mask"].details["offers"][0]["pricePln"]
        == 22.50
    )
    skin_cream_offers = products["professional-cosmetic:skin1004-centella-cream-75ml"].details[
        "offers"
    ]
    assert len(skin_cream_offers) == 1
    assert min(offer["pricePln"] for offer in skin_cream_offers) == 109.0
    assert all(offer["updatedAt"] == "2026-08-23" for offer in skin_cream_offers)


def test_requested_comparison_products_use_uploaded_local_galleries() -> None:
    project_root = API_ROOT.parents[1]
    requested = [
        item
        for item in list_public_catalog_products()
        if item.details.get("lastReviewedAt") == "2026-08-23"
        and item.brand not in {"DM.Cell", "Health Labs Care"}
        and not item.external_id.startswith("professional-cosmetic:makeup-")
    ]

    assert len(requested) == 19
    assert all(item.details["imageDisplay"] == "COVER" for item in requested)
    assert all(
        (project_root / "public" / image["path"].lstrip("/")).is_file()
        for item in requested
        for image in item.details["productImages"]
    )
    assert (
        len(
            get_public_catalog_product("skin1004-hyalu-cica-sun-serum-spf50-50ml").details[
                "productImages"
            ]
        )
        == 3
    )
    assert (
        len(get_public_catalog_product("liquid-anesthetic-15ml-pmu-brows").details["productImages"])
        == 3
    )


def test_skinoe_products_have_official_prices_and_uploaded_galleries() -> None:
    project_root = API_ROOT.parents[1]
    expected_prices = {
        "skinoe-calmist-tonic": 129.0,
        "skinoe-rosbiome-cream": 209.0,
        "skinoe-phlora-serum": 209.0,
        "skinoe-lac-gel": 109.0,
    }

    for slug, expected_price in expected_prices.items():
        product = get_public_catalog_product(slug)

        assert product is not None
        assert product.brand == "SKINOE"
        assert len(product.details["offers"]) == 1
        assert product.details["offers"][0]["pricePln"] == expected_price
        assert product.source_url.startswith("https://skinoe.pl/produkt/")
        assert product.details["brandLogoPath"] == ("/beautydocs/catalog/skinoe-logo-filter.png")
        assert (project_root / "public" / product.details["brandLogoPath"].lstrip("/")).is_file()
        assert len(product.details["productImages"]) == 3
        assert all(
            (project_root / "public" / image["path"].lstrip("/")).is_file()
            for image in product.details["productImages"]
        )


def test_prescription_medicine_is_information_only_without_purchase_offer() -> None:
    product = get_public_catalog_product("dexamethasone-sodium-phosphate-8mg-2ml-3")

    assert product is not None
    assert product.brand == "Dexamethasone"
    assert product.kind == CatalogItemKind.MEDICINE.value
    assert product.details["offers"] == []
    assert product.details["priceComparison"]["status"] == "INFORMATION_ONLY"
    assert "recept" in product.details["priceComparison"]["notice"]


def test_painrelief_uses_its_trade_name_and_brand() -> None:
    product = get_public_catalog_product("liquid-anesthetic-15ml-pmu-brows")

    assert product is not None
    assert product.brand == "Painrelief"
    assert product.name.startswith("Painrelief 15 ml")
    assert product.details["brandLogoPath"] == "/beautydocs/brands/painrelief.svg"


@pytest.mark.asyncio
async def test_curated_snapshot_is_resolved_from_server_owned_data() -> None:
    item, available = await resolve_catalog_snapshot(
        CatalogItemSource.BEAUTYDOCS,
        "professional-cosmetic:avene-cicalfate-spf50",
        "nazwa przesłana przez klienta nie jest zaufana",
    )
    assert available is True
    assert item is not None
    assert item.name == "Cicalfate+ Multi-Protective Repair Cream SPF 50+"


def test_rpl_mapper_keeps_registry_facts_and_rejects_non_human_products() -> None:
    raw = {
        "id": 123,
        "specimenType": "Ludzki",
        "medicinalProductName": "Lek testowy",
        "commonName": "Substantia",
        "activeSubstanceName": "Substancja czynna",
        "pharmaceuticalFormName": "tabletka",
        "medicinalProductPower": "10 mg",
        "subjectMedicinalProductName": "Podmiot testowy",
        "registryNumber": "R/123",
        "atcCode": "A00",
    }
    item = _rpl_item(raw)
    assert item is not None
    assert item.external_id == "rpl:123"
    assert item.details["activeSubstance"] == "Substancja czynna"
    assert item.details["verification"] == "OFFICIAL_REGISTRY"
    assert item.details["safetyAssessment"]["status"] == "VERIFY"
    assert _rpl_item({**raw, "specimenType": "Weterynaryjny"}) is None


def test_rpl_mapper_flags_only_topical_ketoprofen_as_photosensitizing() -> None:
    raw = {
        "id": 321,
        "specimenType": "Ludzki",
        "medicinalProductName": "Ketoprofen testowy",
        "activeSubstanceName": "Ketoprofen",
        "pharmaceuticalFormName": "żel",
    }
    topical = _rpl_item(raw)
    injection = _rpl_item(
        {
            **raw,
            "id": 322,
            "pharmaceuticalFormName": "roztwór do wstrzykiwań",
        }
    )

    assert topical is not None
    assert topical.details["safetyAssessment"]["status"] == "PHOTOSENSITIZING"
    assert topical.details["safetyAssessment"]["flags"] == ["PHOTOSENSITIVITY"]
    assert injection is not None
    assert injection.details["safetyAssessment"]["status"] == "VERIFY"


def test_rpl_mapper_does_not_confuse_dexketoprofen_with_ketoprofen() -> None:
    item = _rpl_item(
        {
            "id": 323,
            "specimenType": "Ludzki",
            "medicinalProductName": "Dexketoprofen testowy",
            "activeSubstanceName": "Dexketoprofenum",
            "pharmaceuticalFormName": "żel",
        }
    )

    assert item is not None
    assert item.details["safetyAssessment"]["status"] == "VERIFY"


def test_catalog_payload_cannot_disguise_custom_data_as_official() -> None:
    with pytest.raises(ValidationError):
        SalonCatalogCreateRequest(
            source=CatalogItemSource.SALON,
            external_id="rpl:123",
            kind=CatalogItemKind.DEVICE,
            name="Fałszywy wpis",
            source_url=None,
        )
    with pytest.raises(ValidationError):
        SalonCatalogCreateRequest(
            source=CatalogItemSource.RPL,
            external_id="rpl:123",
            kind=CatalogItemKind.DEVICE,
            name="Fałszywe urządzenie",
            source_url=None,
        )


def test_catalog_migration_forces_tenant_rls_and_sponsor_disclosure() -> None:
    source = MIGRATION.read_text(encoding="utf-8")
    assert "ALTER TABLE salon_catalog_items ENABLE ROW LEVEL SECURITY" in source
    assert "ALTER TABLE salon_catalog_items FORCE ROW LEVEL SECURITY" in source
    assert "salon_catalog_items_tenant_isolation" in source
    assert "is_sponsored = false OR sponsor_name IS NOT NULL" in source


def test_medicine_mirror_migration_has_products_rules_and_sync_audit() -> None:
    source = MIRROR_MIGRATION.read_text(encoding="utf-8")
    assert '"medicine_products"' in source
    assert '"medicine_safety_rules"' in source
    assert '"medicine_catalog_sync_runs"' in source
    assert "topical-ketoprofen-photosensitivity" in source
    assert "ema.europa.eu" in source
