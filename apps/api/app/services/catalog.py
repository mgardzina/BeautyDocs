"""Shared informational catalogue and the official Polish RPL adapter.

The service deliberately returns registry facts and editorial descriptions. It
does not calculate treatment eligibility or recommend stopping medication.
"""

# ruff: noqa: RUF001 -- Polish UI copy intentionally uses typographic punctuation.

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from time import monotonic
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import (
    CatalogItemKind,
    CatalogItemSource,
    MedicineProduct,
    MedicineSafetyRule,
)

RPL_API_BASE = "https://rejestry.ezdrowie.gov.pl/api/rpl"
RPL_PUBLIC_URL = "https://rejestry.ezdrowie.gov.pl/rpl/search/public"
COSING_PUBLIC_URL = (
    "https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en"
)
FDA_FILLER_SAFETY_URL = (
    "https://www.fda.gov/medical-devices/aesthetic-cosmetic-devices/"
    "dermal-fillers-soft-tissue-fillers"
)
REVOLAX_COLLECTION_URL = "https://www.revolaxofficial.com/pages/shop"
REVOLAX_FINE_URL = "https://www.revolaxofficial.com/products/revolax"
REVOLAX_DEEP_URL = "https://www.revolaxofficial.com/products/revolax-deep-lidocaine-1-0-ml"
REVOLAX_SUB_Q_URL = "https://www.revolaxofficial.com/products/revolax-sub-q-lidocaine-1-0-ml"
REVOLAX_MANUFACTURER_URL = "https://across2013.koreasme.com/product-specification.html"
NEURAMIS_PRODUCT_URL = "https://medytox.com/page/neuramis_en?site_id=en"
NEURAMIS_ACADEMY_URL = "https://medytoxacademy.com/page/neuramis"
TEOSYAL_PRODUCT_URL = "https://www.teoxane.com/en/productinfo-ksa"
TEOSYAL_HCP_URL = (
    "https://www.teoxane.com/en/healthcarepractitioners/dermal-fillers-dermocosmetics-solutions"
)
BELOTERO_IFU_URL = "https://www.ifu.merzaesthetics.com/products/"
BELOTERO_PORTFOLIO_URL = "https://imcas.merz.com/epaper_global/belotero_2026_0123/"
RESTYLANE_DEFYNE_IFU_URL = (
    "https://www.galderma.com/sites/default/files/2025-03/90-36811-01_IFU_Restylane_Defyne-2023.pdf"
)
RESTYLANE_KYSSE_IFU_URL = (
    "https://www.galderma.com/sites/default/files/2025-03/90-85207-01_IFU_Restylane_Kysse-2023.pdf"
)
SOPRANO_TITANIUM_URL = "https://almalasers.com/product/soprano-titanium-special-edition/"
GENTLEMAX_PRO_PLUS_URL = (
    "https://marketing.candelamedical.com/gentlemaxproplus.html?country-language=uk"
)
GENTLEMAX_PRO_PLUS_BROCHURE_URL = (
    "https://marketing.candelamedical.com/rs/620-HCU-218/images/"
    "PU07645EN-Rev-102-GentleMaxPro-Plus-GLX%20Product%20Brochure%20LR_EN.pdf?version=0"
)
LIGHTSHEER_QUATTRO_URL = "https://lumenis.com/aesthetics/products/lightsheer-quattro/"
ELITE_IQ_URL = "https://www.cynosure.com/product/elite-iq/"
STELLAR_M22_URL = "https://lumenis.com/aesthetics/products/stellar-m22/"
CICAPLAST_BAUME_B5_URL = "https://www.laroche-posay.pl/cicaplast/cicaplast-baume-b5-plus"
CICAPLAST_BAUME_B5_SPF50_URL = "https://www.laroche-posay.pl/cicaplast/cicaplast-baume-b5-spf50"
AVENE_CICALFATE_URL = (
    "https://www.eau-thermale-avene.pl/p/"
    "cicalfate-regenerujacy-krem-ochronny-3282770204681-808759b4"
)
AVENE_CICALFATE_SPF50_URL = (
    "https://www.eau-thermale-avene.pl/p/"
    "cicalfate-multiochronny-krem-regenerujacy-spf50-3282770394467-808759b4"
)
BIODERMA_CICABIO_URL = "https://www.bioderma.pl/produkty/cicabio/cicabio-creme"
URIAGE_BARIEDERM_CICA_URL = "https://uriage.com/MT/en/products/bariederm-cica-creme"
EMA_TOPICAL_KETOPROFEN_URL = (
    "https://www.ema.europa.eu/en/medicines/human/referrals/ketoprofen-topical"
)
RPL_CACHE_SECONDS = 5 * 60
RPL_CACHE_MAX_ITEMS = 200
PUBLIC_PRODUCT_SLUG_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,158}[a-z0-9])?$")
PROFESSIONAL_CATALOG_PREFIXES = (
    "professional-product:",
    "professional-device:",
    "professional-cosmetic:",
    "professional-medicine:",
)

SHOPIA_STORE_URL = "https://shopia.com.pl/sklep/"
SKINOE_CALMIST_URL = "https://skinoe.pl/produkt/calmist-tonic/"
SKINOE_ROSBIOME_URL = "https://skinoe.pl/produkt/rosbiome-cream/"
SKINOE_PHLORA_URL = "https://skinoe.pl/produkt/phlora-serum/"
SKINOE_LAC_GEL_URL = "https://skinoe.pl/produkt/lacgel/"
HEALTHLABS_COSMETICS_URL = "https://www.healthlabs.care/pl/produkty/kosmetyki"
HEALTHLABS_SNAPSHOT_PATH = Path(__file__).with_name("healthlabs_catalog.json")
DMCELL_CATALOG_URL = "https://us.dmcell.com/80"
DMCELL_POLISH_URL = "https://dmcell.pl/"
DMCELL_SNAPSHOT_PATH = Path(__file__).with_name("dmcell_catalog.json")
MAKEUP_FACE_CARE_URL = "https://makeup.pl/categorys/20273/"
MAKEUP_SNAPSHOT_PATH = Path(__file__).with_name("makeup_catalog.json")
LUVEE_CATALOG_URL = "https://luvee.pl/collections/all"
LUVEE_SNAPSHOT_PATH = Path(__file__).with_name("luvee_catalog.json")
SENSUM_MARE_CATALOG_URL = "https://sensummare.pl/kosmetyki/"
SENSUM_MARE_SNAPSHOT_PATH = Path(__file__).with_name("sensum_mare_catalog.json")
GIGI_POLAND_CATALOG_URL = "https://gigipoland.pl/sklep/"
GIGI_POLAND_SNAPSHOT_PATH = Path(__file__).with_name("gigi_poland_catalog.json")
INSTYTUTUM_CATALOG_URL = "https://instytutum.com/en/category/"
INSTYTUTUM_SNAPSHOT_PATH = Path(__file__).with_name("instytutum_catalog.json")
PARTNER_BRAND_SNAPSHOT_PATH = Path(__file__).with_name("partner_brand_catalogs.json")
# Regenerated from reviewed manufacturer and direct-shop pages by the importer.
EXTENDED_BRAND_SNAPSHOT_PATH = Path(__file__).with_name("extended_brand_catalogs.json")

BRAND_LOGO_PATHS: dict[str, str] = {
    "Alma Lasers": "/beautydocs/brands/alma-lasers.svg",
    "Avalon": "/beautydocs/brands/avalon.svg",
    "Avène": "/beautydocs/brands/avene.svg",
    "Authentic Beauty Concept": "/beautydocs/brands/authentic-beauty-concept.png",
    "Belnea": "/beautydocs/brands/belnea.png",
    "Belotero / Merz Aesthetics": "/beautydocs/brands/belotero.svg",
    "Bioderma": "/beautydocs/brands/bioderma.svg",
    "Biotherm": "/beautydocs/brands/biotherm.svg",
    "Candela": "/beautydocs/brands/candela.svg",
    "Caudalie": "/beautydocs/brands/caudalie.svg",
    "Cynosure Lutronic": "/beautydocs/brands/cynosure-lutronic.svg",
    "DM.Cell": "/beautydocs/brands/dmcell.png",
    "Health Labs Care": "/beautydocs/brands/health-labs-care.svg",
    "Dermomedica": "/beautydocs/brands/dermomedica.png",
    "La Roche-Posay": "/beautydocs/brands/la-roche-posay.svg",
    "Lancôme": "/beautydocs/brands/lancome.svg",
    "L'Oréal Paris": "/beautydocs/brands/loreal-paris.svg",
    "La Guèl": "/beautydocs/brands/la-guel.webp",
    "Lumenis": "/beautydocs/brands/lumenis.svg",
    "Luvée": "/beautydocs/brands/luvee.png",
    "Mixa": "/beautydocs/brands/mixa.svg",
    "Neauvia": "/beautydocs/brands/neauvia.svg",
    "Neuramis / Medytox": "/beautydocs/brands/neuramis.svg",
    "NIVEA": "/beautydocs/brands/nivea.svg",
    "Painrelief": "/beautydocs/brands/painrelief.svg",
    "Pur Eden": "/beautydocs/brands/pur-eden.webp",
    "REVOLAX / Across": "/beautydocs/brands/revolax.svg",
    "Restylane / Galderma": "/beautydocs/brands/restylane.svg",
    "SADÖER": "/beautydocs/brands/sadoer.svg",
    "Sensum Mare": "/beautydocs/brands/sensum-mare.svg",
    "Forlle'd": "/beautydocs/brands/forlled.svg",
    "Garnier": "/beautydocs/brands/garnier.svg",
    "GIGI Laboratories": "/beautydocs/brands/gigi-poland.svg",
    "INSTYTUTUM": "/beautydocs/brands/instytutum.svg",
    "SKIN1004": "/beautydocs/brands/skin1004.svg",
    "SKINOE": "/beautydocs/catalog/skinoe-logo-filter.png",
    "TEOSYAL / TEOXANE": "/beautydocs/brands/teosyal.svg",
    "TEOXANE": "/beautydocs/brands/teosyal.svg",
    "Uriage": "/beautydocs/brands/uriage.svg",
    "Vichy": "/beautydocs/brands/vichy.svg",
}


@dataclass(frozen=True, slots=True)
class CatalogSearchItem:
    external_id: str
    kind: str
    source: str
    name: str
    brand: str | None
    summary: str
    details: dict[str, Any]
    source_label: str
    source_url: str


@dataclass(frozen=True, slots=True)
class CatalogSearchResult:
    items: list[CatalogSearchItem]
    rpl_available: bool


@dataclass(frozen=True, slots=True)
class MedicineCatalogPage:
    items: list[CatalogSearchItem]
    total: int
    page: int
    page_size: int
    rpl_available: bool


@dataclass(frozen=True, slots=True)
class SafetyRuleSnapshot:
    substance_names: tuple[str, ...]
    pharmaceutical_form_terms: tuple[str, ...]
    status: str
    label: str
    summary: str
    flags: tuple[str, ...]
    treatment_families: tuple[str, ...]
    evidence_label: str
    evidence_url: str


BUILTIN_SAFETY_RULES: tuple[SafetyRuleSnapshot, ...] = (
    SafetyRuleSnapshot(
        substance_names=("ketoprofen", "ketoprofenum"),
        pharmaceutical_form_terms=("żel", "krem", "maść", "plaster", "na skórę"),
        status="PHOTOSENSITIZING",
        label="Światłouczulający",
        summary=(
            "Oficjalna ocena EMA wskazuje ryzyko reakcji nadwrażliwości na "
            "światło, w tym fotoalergii, dla ketoprofenu stosowanego miejscowo."
        ),
        flags=("PHOTOSENSITIVITY",),
        treatment_families=("LASER", "IPL", "UV"),
        evidence_label="EMA — ketoprofen stosowany miejscowo",
        evidence_url=EMA_TOPICAL_KETOPROFEN_URL,
    ),
)


def _editorial_item(
    external_id: str,
    kind: CatalogItemKind,
    name: str,
    summary: str,
    *,
    brand: str | None = None,
    aliases: tuple[str, ...] = (),
    details: dict[str, Any] | None = None,
    source_label: str = "Opracowanie BeautyDocs",
    source_url: str = COSING_PUBLIC_URL,
) -> CatalogSearchItem:
    item_details = {**(details or {})}
    if brand and "brandLogoPath" not in item_details:
        brand_logo_path = BRAND_LOGO_PATHS.get(brand)
        if brand_logo_path:
            item_details["brandLogoPath"] = brand_logo_path
    return CatalogSearchItem(
        external_id=external_id,
        kind=kind.value,
        source=CatalogItemSource.BEAUTYDOCS.value,
        name=name,
        brand=brand,
        summary=summary,
        details={
            "aliases": list(aliases),
            "verification": "EDITORIAL",
            **item_details,
        },
        source_label=source_label,
        source_url=source_url,
    )


FILLER_COMMON_REACTIONS = (
    "Zasinienie, zaczerwienienie i obrzęk w miejscu podania",
    "Ból lub tkliwość, świąd albo wysypka",
)
FILLER_SERIOUS_RISKS = (
    "Zakażenie, guzki lub reakcja alergiczna",
    "Niezamierzone podanie donaczyniowe może prowadzić do martwicy tkanek",
    "Rzadkie powikłania naczyniowe obejmują zaburzenia widzenia, ślepotę lub udar",
)
FILLER_QUALIFICATION_ALERTS = (
    "Aktywny stan zapalny lub zakażenie skóry w planowanym miejscu podania",
    "Ciężkie alergie lub przebyta anafilaksja",
    "Zaburzenia krzepnięcia albo leki wpływające na krzepnięcie",
    "Ciąża, karmienie piersią lub wiek poniżej 18 lat — sprawdź aktualną IFU",
    "Wcześniejsze implanty lub wypełniacze w tej samej okolicy",
)


def _source_document(label: str, url: str, scope: str) -> dict[str, str]:
    return {"label": label, "url": url, "scope": scope}


def _product_image(
    path: str,
    alt: str,
    *,
    label: str = "Produkt",
    scale: float = 1.0,
    note: str | None = None,
    fit: str = "contain",
) -> dict[str, str | float]:
    return {
        "path": path,
        "alt": alt,
        "label": label,
        "scale": scale,
        "fit": "cover" if fit == "cover" else "contain",
        **({"note": note} if note else {}),
    }


def _application_area(code: str, label: str) -> dict[str, str]:
    return {"code": code, "label": label}


def _price_offer(
    seller: str,
    price_pln: float,
    url: str,
    *,
    shipping_price_pln: float | None = None,
    availability: str = "IN_STOCK",
    source_type: str = "STORE",
) -> dict[str, Any]:
    return {
        "seller": seller,
        "pricePln": price_pln,
        "shippingPricePln": shipping_price_pln,
        "availability": availability,
        "url": url,
        "sourceType": source_type,
        "updatedAt": "2026-08-23",
    }


def _comparison_product(
    external_id: str,
    kind: CatalogItemKind,
    name: str,
    brand: str,
    summary: str,
    *,
    presentation: str,
    product_category: str,
    product_family: str,
    manufacturer_uses: tuple[str, ...],
    treatment_categories: tuple[str, ...],
    application_areas: tuple[dict[str, str], ...],
    key_ingredients: tuple[str, ...] = (),
    aliases: tuple[str, ...] = (),
    offers: tuple[dict[str, Any], ...] = (),
    source_url: str = SHOPIA_STORE_URL,
    comparison_status: str = "ACTIVE",
    comparison_notice: str | None = None,
    professional_only: bool = False,
    usage_notice: str | None = None,
    image_path: str,
    image_alt: str | None = None,
    image_note: str | None = None,
    image_fit: str = "cover",
    brand_logo_path: str | None = None,
    additional_images: tuple[dict[str, str | float], ...] = (),
    source_label_override: str | None = None,
    source_document_title: str | None = None,
    source_document_description: str | None = None,
) -> CatalogSearchItem:
    default_notice = (
        "Ceny są migawką ofert z 23.08.2026 i mogą zmienić się po przejściu do "
        "sklepu. BeautyDocs nie jest sprzedawcą; przed zakupem sprawdź wariant, "
        "dostępność, koszt dostawy i warunki sprzedaży."
    )
    return _editorial_item(
        external_id,
        kind,
        name,
        summary,
        brand=brand,
        aliases=aliases,
        details={
            "catalogProfile": "PROFESSIONAL_PRODUCT",
            "productCategory": product_category,
            "productFamily": product_family,
            "presentation": presentation,
            "manufacturerUses": list(manufacturer_uses),
            "treatmentCategories": list(treatment_categories),
            "applicationAreas": list(application_areas),
            "keyIngredients": list(key_ingredients),
            "professionalOnly": professional_only,
            "imagePath": image_path,
            "imageAlt": image_alt or f"{name} — zdjęcie produktu",
            "imageDisplay": "COVER" if image_fit == "cover" else "CONTAIN",
            **({"brandLogoPath": brand_logo_path} if brand_logo_path else {}),
            "productImages": [
                _product_image(
                    image_path,
                    image_alt or f"{name} — zdjęcie produktu",
                    scale=1.0,
                    note=image_note,
                    fit=image_fit,
                ),
                *additional_images,
            ],
            "offers": list(offers),
            "priceComparison": {
                "currency": "PLN",
                "status": comparison_status,
                "updatedAt": "2026-08-23",
                "notice": comparison_notice or default_notice,
            },
            "usageNotice": usage_notice
            or (
                "Przed użyciem przeczytaj aktualną etykietę lub instrukcję produktu. "
                "Zgodność z zabiegiem i indywidualne przeciwwskazania potwierdź ze "
                "specjalistą właściwym dla danego produktu."
            ),
            "regulatoryNotice": comparison_notice or default_notice,
            "sourceDocuments": [
                _source_document(
                    source_document_title
                    or (
                        "Oficjalny rejestr produktów leczniczych"
                        if comparison_status == "INFORMATION_ONLY"
                        else (
                            "Oficjalna karta produktu i kontakt dystrybutora"
                            if comparison_status == "REQUEST_QUOTE"
                            else "Źródło oferty i ceny"
                        )
                    ),
                    source_url,
                    source_document_description
                    or (
                        "Weryfikacja nazwy, statusu i dokumentacji produktu"
                        if comparison_status == "INFORMATION_ONLY"
                        else (
                            "Nazwa, wariant i dostępność produktu; cena wymaga potwierdzenia"
                            if comparison_status == "REQUEST_QUOTE"
                            else (
                                "Nazwa, wariant i cena widoczne bezpośrednio w ofercie sprzedawcy"
                            )
                        )
                    ),
                )
            ],
            "lastReviewedAt": "2026-08-23",
        },
        source_label=(
            source_label_override
            or (
                "Oficjalny rejestr — materiał informacyjny BeautyDocs"
                if comparison_status == "INFORMATION_ONLY"
                else (
                    "Materiały producenta — cena na zapytanie u polskiego dystrybutora"
                    if comparison_status == "REQUEST_QUOTE"
                    else "Oferta rynkowa — zweryfikowana redakcyjnie przez BeautyDocs"
                )
            )
        ),
        source_url=source_url,
    )


def _normalized_filter_text(values: Sequence[str]) -> str:
    value = " ".join(values)
    normalized = unicodedata.normalize("NFKD", value.casefold()).replace("ł", "l")
    return "".join(character for character in normalized if not unicodedata.combining(character))


def _filler_application_areas(manufacturer_uses: Sequence[str]) -> list[dict[str, str]]:
    normalized_uses = _normalized_filter_text(manufacturer_uses)
    areas: list[dict[str, str]] = []

    def add(code: str, label: str) -> None:
        if not any(area["code"] == code for area in areas):
            areas.append(_application_area(code, label))

    if "nosowo-warg" in normalized_uses:
        add("NASOLABIAL_FOLDS", "Bruzdy nosowo-wargowe")
    if "ust" in normalized_uses:
        add("LIPS", "Usta i ich kontur")
    if "marionet" in normalized_uses:
        add("MARIONETTE_LINES", "Linie marionetki")
    if "policzk" in normalized_uses:
        add("CHEEKS", "Policzki")
    if "brod" in normalized_uses:
        add("CHIN", "Broda")
    if "zuchw" in normalized_uses:
        add("JAWLINE", "Linia żuchwy")
    if not areas and any(term in normalized_uses for term in ("linii", "zmarszcz")):
        add("FACIAL_LINES", "Linie i zmarszczki twarzy")
    return areas


def _professional_filler(
    external_id: str,
    name: str,
    brand: str,
    summary: str,
    *,
    presentation: str,
    volume_ml: float,
    contains_lidocaine: bool | None,
    manufacturer_uses: tuple[str, ...],
    aliases: tuple[str, ...] = (),
    storage: str | None = None,
    source_url: str,
    source_documents: tuple[dict[str, str], ...],
    image_path: str | None = None,
    image_note: str | None = None,
    image_credit_url: str | None = None,
    image_scale: float = 1.0,
    additional_images: tuple[dict[str, str | float], ...] = (),
    offers: tuple[dict[str, Any], ...] = (),
) -> CatalogSearchItem:
    active_ingredients = ["Usieciowany kwas hialuronowy"]
    qualification_alerts = list(FILLER_QUALIFICATION_ALERTS)
    if contains_lidocaine:
        active_ingredients.append("Lidokaina")
        qualification_alerts.append("Alergia na lidokainę lub amidowe środki znieczulające")

    treatment_categories = ["Wypełniacze i modelowanie"]
    normalized_uses = _normalized_filter_text(manufacturer_uses)
    if "ust" in normalized_uses:
        treatment_categories.append("Modelowanie ust")
    if any(term in normalized_uses for term in ("bruzd", "linii", "zmarszcz")):
        treatment_categories.append("Korekcja zmarszczek")
    if any(term in normalized_uses for term in ("brod", "kontur", "policzk", "wolum", "zuchw")):
        treatment_categories.append("Wolumetria twarzy")

    return _editorial_item(
        external_id,
        CatalogItemKind.TREATMENT_SUBSTANCE,
        name,
        summary,
        brand=brand,
        aliases=aliases,
        details={
            "catalogProfile": "PROFESSIONAL_PRODUCT",
            "productFamily": "Wypełniacz skórny na bazie kwasu hialuronowego",
            "presentation": presentation,
            **(
                {
                    "imagePath": image_path,
                    "imageAlt": f"{name} — zdjęcie opakowania udostępnione przez markę",
                    "imageCreditUrl": image_credit_url or source_url,
                    "productImages": [
                        _product_image(
                            image_path,
                            f"{name} — zdjęcie opakowania udostępnione przez markę",
                            scale=image_scale,
                            note=image_note,
                        ),
                        *additional_images,
                    ],
                    **({"imageNote": image_note} if image_note else {}),
                }
                if image_path
                else {}
            ),
            "volumeMl": volume_ml,
            "containsLidocaine": contains_lidocaine,
            "activeIngredients": active_ingredients,
            "manufacturerUses": list(manufacturer_uses),
            "treatmentCategories": treatment_categories,
            "applicationAreas": _filler_application_areas(manufacturer_uses),
            "professionalOnly": True,
            "storage": storage,
            "commonReactions": list(FILLER_COMMON_REACTIONS),
            "seriousRisks": list(FILLER_SERIOUS_RISKS),
            "qualificationAlerts": qualification_alerts,
            "offers": list(offers),
            "priceComparison": {
                "currency": "PLN",
                "status": "REGULATORY_CHECK",
                "updatedAt": "2026-08-23",
                "notice": (
                    "Ceny są migawką ofert i mogą się zmienić. Produkt jest przeznaczony "
                    "wyłącznie do użycia przez uprawnionego, przeszkolonego specjalistę; "
                    "sprawdź IFU, autoryzację sprzedawcy i status wyrobu przed zamówieniem."
                ),
            },
            "safetyScope": (
                "Reakcje i ryzyka opisują klasę wypełniaczy skórnych na podstawie "
                "informacji FDA. Przeciwwskazania i działania niepożądane konkretnego "
                "produktu należy zawsze sprawdzić w aktualnej IFU."
            ),
            "regulatoryNotice": (
                "Dostępność, status regulacyjny, opakowanie i wskazania mogą różnić się "
                "między rynkami. Przed użyciem sprawdź aktualną IFU, etykietę, numer "
                "partii i autoryzowany kanał dystrybucji."
            ),
            "sourceDocuments": [
                *source_documents,
                _source_document(
                    "FDA — bezpieczeństwo klasy wypełniaczy skórnych",
                    FDA_FILLER_SAFETY_URL,
                    "Ogólne reakcje, ostrzeżenia i poważne ryzyka dla klasy produktów",
                ),
            ],
            "lastReviewedAt": "2026-08-18",
        },
        source_label="Materiały producenta lub marki — zweryfikowane przez BeautyDocs",
        source_url=source_url,
    )


def _professional_device(
    external_id: str,
    name: str,
    brand: str,
    summary: str,
    *,
    presentation: str,
    manufacturer_uses: tuple[str, ...],
    technologies: tuple[str, ...],
    features: tuple[str, ...],
    aliases: tuple[str, ...],
    source_url: str,
    image_path: str,
    wavelengths: tuple[str, ...] = (),
    source_documents: tuple[dict[str, str], ...] = (),
    additional_images: tuple[dict[str, str | float], ...] = (),
) -> CatalogSearchItem:
    treatment_categories: list[str] = []
    normalized_uses = _normalized_filter_text(manufacturer_uses)
    if any(term in normalized_uses for term in ("owlos", "epilac")):
        treatment_categories.append("Epilacja laserowa")
    if any(term in normalized_uses for term in ("barwnik", "pigment", "przebarw")):
        treatment_categories.append("Zmiany pigmentacyjne")
    if "naczyni" in normalized_uses:
        treatment_categories.append("Zmiany naczyniowe")
    if any(term in normalized_uses for term in ("odmladz", "skory", "zmarszcz")):
        treatment_categories.append("Terapie i odmładzanie skóry")

    application_areas: list[dict[str, str]] = []
    if any(term in normalized_uses for term in ("owlos", "epilac")):
        application_areas.extend(
            (
                _application_area("FACE", "Twarz"),
                _application_area("UNDERARMS", "Pachy"),
                _application_area("ARMS", "Ramiona i przedramiona"),
                _application_area("CHEST", "Klatka piersiowa"),
                _application_area("BACK", "Plecy"),
                _application_area("BIKINI", "Okolica bikini"),
                _application_area("LEGS", "Uda, łydki i podudzia"),
            )
        )

    return _editorial_item(
        external_id,
        CatalogItemKind.DEVICE,
        name,
        summary,
        brand=brand,
        aliases=aliases,
        details={
            "catalogProfile": "PROFESSIONAL_PRODUCT",
            "productCategory": "Urządzenie profesjonalne",
            "productFamily": "Platforma zabiegowa",
            "presentation": presentation,
            "manufacturerUses": list(manufacturer_uses),
            "treatmentCategories": treatment_categories,
            "applicationAreas": application_areas,
            "technologies": list(technologies),
            "wavelengths": list(wavelengths),
            "features": list(features),
            "professionalOnly": True,
            "imagePath": image_path,
            "imageAlt": f"{name} — zdjęcie urządzenia udostępnione przez producenta",
            "imageCreditUrl": source_url,
            "productImages": [
                _product_image(
                    image_path,
                    f"{name} — zdjęcie urządzenia udostępnione przez producenta",
                    scale=0.92,
                ),
                *additional_images,
            ],
            "offers": [],
            "priceComparison": {
                "currency": "PLN",
                "status": "REQUEST_QUOTE",
                "updatedAt": "2026-08-23",
                "quoteUrl": source_url,
                "notice": (
                    "Producent nie publikuje porównywalnego cennika urządzenia. "
                    "Końcowa cena zależy m.in. od konfiguracji, aplikatorów, szkolenia, "
                    "warunków finansowania i pakietu serwisowego."
                ),
            },
            "regulatoryNotice": (
                "Dostępne wskazania, końcówki i konfiguracje mogą różnić się między "
                "rynkami. Przed użyciem sprawdź aktualną instrukcję producenta, "
                "dokumentację urządzenia, przeszkolenie personelu i lokalne wymagania."
            ),
            "sourceDocuments": list(source_documents)
            or [
                _source_document(
                    f"{brand} — oficjalna karta produktu",
                    source_url,
                    "Model, technologie i zastosowania opisane przez producenta",
                )
            ],
            "lastReviewedAt": "2026-08-18",
        },
        source_label="Oficjalne materiały producenta — zweryfikowane przez BeautyDocs",
        source_url=source_url,
    )


def _professional_cosmetic(
    external_id: str,
    name: str,
    brand: str,
    summary: str,
    *,
    presentation: str,
    available_sizes: tuple[str, ...],
    manufacturer_uses: tuple[str, ...],
    key_ingredients: tuple[str, ...],
    skin_types: tuple[str, ...],
    aftercare_category: str,
    aliases: tuple[str, ...],
    source_url: str,
    image_path: str,
    additional_images: tuple[dict[str, str | float], ...] = (),
    offers: tuple[dict[str, Any], ...] = (),
) -> CatalogSearchItem:
    treatment_categories = ["Pielęgnacja pozabiegowa"]
    treatment_categories.append(
        "Ochrona przeciwsłoneczna"
        if aftercare_category == "SUN_PROTECTION"
        else "Regeneracja bariery skórnej"
    )
    normalized_uses = _normalized_filter_text(manufacturer_uses)
    application_areas = [_application_area("FACE", "Skóra twarzy")]
    if "ciala" in normalized_uses:
        application_areas.append(_application_area("BODY", "Skóra ciała"))
    if aftercare_category == "SUN_PROTECTION":
        application_areas.append(
            _application_area("SUN_EXPOSED", "Obszary narażone na promieniowanie UV")
        )
    return _editorial_item(
        external_id,
        CatalogItemKind.COSMETIC,
        name,
        summary,
        brand=brand,
        aliases=aliases,
        details={
            "catalogProfile": "PROFESSIONAL_PRODUCT",
            "productCategory": "Kosmetyk / dermokosmetyk",
            "productFamily": "Pielęgnacja skóry po zabiegach",
            "presentation": presentation,
            "availableSizes": list(available_sizes),
            "manufacturerUses": list(manufacturer_uses),
            "treatmentCategories": treatment_categories,
            "applicationAreas": application_areas,
            "keyIngredients": list(key_ingredients),
            "skinTypes": list(skin_types),
            "aftercareCategory": aftercare_category,
            "usageNotice": (
                "Sposób stosowania i zgodność z konkretnym zabiegiem należy potwierdzić "
                "w aktualnej etykiecie produktu oraz indywidualnych zaleceniach salonu."
            ),
            "imagePath": image_path,
            "imageAlt": f"{name} — zdjęcie opakowania udostępnione przez producenta",
            "imageCreditUrl": source_url,
            "productImages": [
                _product_image(
                    image_path,
                    f"{name} — zdjęcie opakowania udostępnione przez producenta",
                    scale=1.08,
                ),
                *additional_images,
            ],
            "offers": list(offers),
            "priceComparison": {
                "currency": "PLN",
                "status": "ACTIVE",
                "updatedAt": "2026-08-23",
                "notice": (
                    "Ceny są migawką ofert z 23.08.2026 i mogą zmienić się po "
                    "przejściu do sklepu. Przed zakupem sprawdź pojemność, dostępność "
                    "i koszt dostawy."
                ),
            },
            "sourceDocuments": [
                _source_document(
                    f"{brand} — oficjalna karta produktu",
                    source_url,
                    "Format, składniki i przeznaczenie opisane przez markę",
                )
            ],
            "lastReviewedAt": "2026-08-18",
        },
        source_label="Oficjalna karta marki — zweryfikowana przez BeautyDocs",
        source_url=source_url,
    )


DEPRECATED_EDITORIAL_EXTERNAL_IDS = frozenset(
    {
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
    }
)


CURATED_ITEMS: tuple[CatalogSearchItem, ...] = (
    _professional_filler(
        "professional-product:revolax-fine-1-1ml",
        "Revolax Fine 1,1 ml",
        "REVOLAX / Across",
        "Wariant z rodziny Revolax przeznaczony według materiałów marki do drobnych "
        "linii i delikatnych obszarów.",
        presentation="1 × 1,1 ml",
        volume_ml=1.1,
        contains_lidocaine=True,
        manufacturer_uses=("Powierzchowne linie i delikatne obszary",),
        aliases=("revolax fine", "revolax 1.1", "revolax 1,1"),
        storage="2–25°C według specyfikacji producenta; chroń zgodnie z aktualną IFU.",
        source_url=REVOLAX_FINE_URL,
        source_documents=(
            _source_document(
                "REVOLAX — kolekcja i formaty",
                REVOLAX_FINE_URL,
                "Nazwa wariantu, format, zdjęcie opakowania i opis marki",
            ),
            _source_document(
                "Across — specyfikacja rodziny REVOLAX",
                REVOLAX_MANUFACTURER_URL,
                "Poziom podania, ogólne przeznaczenie i warunki przechowywania",
            ),
        ),
        image_path="/beautydocs/catalog/revolax-fine.png",
        image_scale=1.5,
        offers=(
            _price_offer(
                "REVOLAX Polska",
                159.0,
                "https://revolax.pl/produkt/revolax-fine-z-lidokaina-1-1-ml/",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:revolax-deep-1-1ml",
        "Revolax Deep 1,1 ml",
        "REVOLAX / Across",
        "Usieciowany wypełniacz kwasu hialuronowego o średnio-wysokiej lepkości, "
        "opisywany przez markę jako wariant do głębszych korekcji i objętości.",
        presentation="1 × 1,1 ml",
        volume_ml=1.1,
        contains_lidocaine=True,
        manufacturer_uses=(
            "Głębsze zmarszczki i bruzdy nosowo-wargowe",
            "Powiększanie ust oraz korekcje wymagające podparcia i projekcji",
        ),
        aliases=("revolax deep", "revolax deep lidocaine", "revolax 1.1"),
        storage="2–25°C według specyfikacji producenta; chroń zgodnie z aktualną IFU.",
        source_url=REVOLAX_DEEP_URL,
        source_documents=(
            _source_document(
                "REVOLAX — Deep 1,1 ml",
                REVOLAX_DEEP_URL,
                "Format, charakterystyka i zastosowania opisane przez markę",
            ),
            _source_document(
                "Across — specyfikacja rodziny REVOLAX",
                REVOLAX_MANUFACTURER_URL,
                "Poziom podania i warunki przechowywania",
            ),
        ),
        image_path="/beautydocs/catalog/revolax-deep.png",
        image_scale=1.5,
        offers=(
            _price_offer(
                "GralkaMed",
                140.0,
                "https://gralkamed.pl/revolax-deep-z-lidokaina-1x11-ml",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:revolax-sub-q-1-1ml",
        "Revolax Sub-Q 1,1 ml",
        "REVOLAX / Across",
        "Najbardziej strukturalny wariant z rodziny Revolax, opisywany przez markę "
        "jako produkt do głębokiej wolumetrii i konturowania.",
        presentation="1 × 1,1 ml",
        volume_ml=1.1,
        contains_lidocaine=True,
        manufacturer_uses=(
            "Głęboka wolumetria i konturowanie",
            "Okolice policzków, brody i linii żuchwy wymieniane w materiałach marki",
        ),
        aliases=("revolax sub q", "revolax sub-q", "revolax 1.1"),
        storage="2–25°C według specyfikacji producenta; chroń zgodnie z aktualną IFU.",
        source_url=REVOLAX_SUB_Q_URL,
        source_documents=(
            _source_document(
                "REVOLAX — kolekcja i formaty",
                REVOLAX_SUB_Q_URL,
                "Nazwa wariantu, format, zdjęcie opakowania i charakterystyka linii",
            ),
            _source_document(
                "Across — specyfikacja rodziny REVOLAX",
                REVOLAX_MANUFACTURER_URL,
                "Poziom podania, ogólne przeznaczenie i przechowywanie",
            ),
        ),
        image_path="/beautydocs/catalog/revolax-sub-q.png",
        image_scale=1.5,
        offers=(
            _price_offer(
                "REVOLAX Polska",
                159.0,
                "https://revolax.pl/produkt/revolax-sub-q-z-lidokaina-1-1-ml/",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:neuramis-light-lidocaine-1ml",
        "Neuramis Light Lidocaine 1,0 ml",
        "Neuramis / Medytox",
        "Wariant Light Lidocaine z oficjalnej linii wypełniaczy Neuramis. Dokładne "
        "wskazania należy potwierdzić w IFU właściwej dla rynku.",
        presentation="1 × 1,0 ml",
        volume_ml=1.0,
        contains_lidocaine=True,
        manufacturer_uses=(),
        aliases=("neuramis light", "neuramis light lidocaine"),
        storage="2–25°C; nie zamrażać, nie ogrzewać i chronić przed słońcem.",
        source_url=NEURAMIS_PRODUCT_URL,
        source_documents=(
            _source_document(
                "Medytox — oficjalna linia Neuramis",
                NEURAMIS_PRODUCT_URL,
                "Nazwa wariantu, format, klasyfikacja i przechowywanie",
            ),
        ),
        image_path="/beautydocs/catalog/neuramis-light-lidocaine.png",
        offers=(
            _price_offer(
                "Cosmetix",
                180.0,
                "https://cosmetix.eu/pl/producers/neuramis-1308137388.html",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:neuramis-lidocaine-1ml",
        "Neuramis Lidocaine 1,0 ml",
        "Neuramis / Medytox",
        "Wariant Neuramis z lidokainą w jednorazowej, sterylnej strzykawce 1,0 ml.",
        presentation="1 × 1,0 ml",
        volume_ml=1.0,
        contains_lidocaine=True,
        manufacturer_uses=(),
        aliases=("neuramis lidocaine", "neuramis 1ml"),
        storage="2–25°C; nie zamrażać, nie ogrzewać i chronić przed słońcem.",
        source_url=NEURAMIS_PRODUCT_URL,
        source_documents=(
            _source_document(
                "Medytox — oficjalna linia Neuramis",
                NEURAMIS_PRODUCT_URL,
                "Nazwa wariantu, format, klasyfikacja i przechowywanie",
            ),
        ),
        image_path="/beautydocs/catalog/neuramis-lidocaine.png",
        offers=(
            _price_offer(
                "Cosmetix",
                180.0,
                "https://cosmetix.eu/pl/producers/neuramis-1308137388.html",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:neuramis-deep-1ml",
        "Neuramis Deep 1,0 ml",
        "Neuramis / Medytox",
        "Wariant Deep z rodziny Neuramis, wymieniony przez producenta oddzielnie od "
        "wersji Deep Lidocaine.",
        presentation="1 × 1,0 ml",
        volume_ml=1.0,
        contains_lidocaine=False,
        manufacturer_uses=("Korekcja bruzd nosowo-wargowych opisana w badaniu produktu",),
        aliases=("neuramis deep", "neuramis deep without lidocaine"),
        storage="2–25°C; nie zamrażać, nie ogrzewać i chronić przed słońcem.",
        source_url=NEURAMIS_PRODUCT_URL,
        source_documents=(
            _source_document(
                "Medytox — oficjalna linia Neuramis",
                NEURAMIS_PRODUCT_URL,
                "Nazwa wariantu, format, klasyfikacja i przechowywanie",
            ),
            _source_document(
                "Medytox Academy — Neuramis",
                NEURAMIS_ACADEMY_URL,
                "Badanie kliniczne dotyczące korekcji bruzd nosowo-wargowych",
            ),
        ),
        image_path="/beautydocs/catalog/neuramis-deep.png",
        additional_images=(
            _product_image(
                "/beautydocs/catalog/neuramis-deep-black-box.webp",
                "Neuramis Deep — czarne opakowanie wariantu z lidokainą",
                label="Linia Neuramis",
                note=(
                    "Dodatkowe zdjęcie przedstawia opakowanie wariantu z lidokainą. "
                    "Karta dotyczy Neuramis Deep bez lidokainy."
                ),
                fit="cover",
            ),
        ),
        offers=(
            _price_offer(
                "Shopia",
                169.0,
                "https://shopia.com.pl/sklep/neuramis-deep-kwas-hialuronowy/",
            ),
            _price_offer(
                "Cosmetix",
                180.0,
                "https://cosmetix.eu/pl/producers/neuramis-1308137388.html",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:neuramis-deep-lidocaine-1ml",
        "Neuramis Deep Lidocaine 1,0 ml",
        "Neuramis / Medytox",
        "Wariant Deep z lidokainą. Materiały producenta opisują badanie kliniczne "
        "dotyczące korekcji bruzd nosowo-wargowych.",
        presentation="1 × 1,0 ml",
        volume_ml=1.0,
        contains_lidocaine=True,
        manufacturer_uses=("Korekcja bruzd nosowo-wargowych",),
        aliases=("neuramis deep lidocaine", "neuramis deep lido"),
        storage="2–25°C; nie zamrażać, nie ogrzewać i chronić przed słońcem.",
        source_url=NEURAMIS_ACADEMY_URL,
        source_documents=(
            _source_document(
                "Medytox — oficjalna linia Neuramis",
                NEURAMIS_PRODUCT_URL,
                "Nazwa wariantu, format, klasyfikacja i przechowywanie",
            ),
            _source_document(
                "Medytox Academy — Neuramis",
                NEURAMIS_ACADEMY_URL,
                "Zastosowanie i podsumowanie badania klinicznego",
            ),
        ),
        image_path="/beautydocs/catalog/neuramis-deep-lidocaine.png",
        offers=(
            _price_offer(
                "Cosmetix",
                180.0,
                "https://cosmetix.eu/pl/producers/neuramis-1308137388.html",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:neuramis-volume-lidocaine-1ml",
        "Neuramis Volume Lidocaine 1,0 ml",
        "Neuramis / Medytox",
        "Wariant Volume Lidocaine z oficjalnej linii Neuramis. Szczegółowe wskazania "
        "i technikę podania należy potwierdzić w lokalnej IFU.",
        presentation="1 × 1,0 ml",
        volume_ml=1.0,
        contains_lidocaine=True,
        manufacturer_uses=(),
        aliases=("neuramis volume", "neuramis volume lidocaine"),
        storage="2–25°C; nie zamrażać, nie ogrzewać i chronić przed słońcem.",
        source_url=NEURAMIS_PRODUCT_URL,
        source_documents=(
            _source_document(
                "Medytox — oficjalna linia Neuramis",
                NEURAMIS_PRODUCT_URL,
                "Nazwa wariantu, format, klasyfikacja i przechowywanie",
            ),
        ),
        image_path="/beautydocs/catalog/neuramis-volume-lidocaine.png",
        offers=(
            _price_offer(
                "Center Fillers",
                180.0,
                "https://centerfillers.com/wypelniacze/830-neuramis-volume-z-lidokaina-1x1ml.html",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:teosyal-rha-2-1ml",
        "TEOSYAL RHA 2 1,0 ml",
        "TEOSYAL / TEOXANE",
        "Wypełniacz z 23 mg/ml kwasu hialuronowego i 0,3% lidokainy, opisany przez "
        "producenta do łagodnych lub umiarkowanych zmarszczek liniowych.",
        presentation="2 × 1,0 ml",
        volume_ml=1.0,
        contains_lidocaine=True,
        manufacturer_uses=(
            "Zmarszczki liniowe twarzy i łagodne lub umiarkowane bruzdy nosowo-wargowe",
        ),
        aliases=("teosyal rha2", "teoxane rha 2", "rha 2"),
        source_url=TEOSYAL_PRODUCT_URL,
        source_documents=(
            _source_document(
                "TEOXANE — informacja produktowa",
                TEOSYAL_PRODUCT_URL,
                "Skład, format, wskazania, przeciwwskazania i działania niepożądane",
            ),
        ),
        image_path="/beautydocs/catalog/teosyal-rha-2.jpg",
        offers=(
            _price_offer(
                "Biodermatic",
                729.0,
                "https://biodermatic.com/teosyal-rha-2-z-lidokaina-2-x-1-ml",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:teosyal-rha-3-1ml",
        "TEOSYAL RHA 3 1,0 ml",
        "TEOSYAL / TEOXANE",
        "Wypełniacz z 23 mg/ml kwasu hialuronowego i 0,3% lidokainy, opisany do "
        "głębokich zmarszczek twarzy.",
        presentation="2 × 1,0 ml",
        volume_ml=1.0,
        contains_lidocaine=True,
        manufacturer_uses=(
            "Głębokie zmarszczki twarzy, w tym umiarkowane lub nasilone bruzdy nosowo-wargowe",
        ),
        aliases=("teosyal rha3", "teoxane rha 3", "rha 3"),
        source_url=TEOSYAL_PRODUCT_URL,
        source_documents=(
            _source_document(
                "TEOXANE — informacja produktowa",
                TEOSYAL_PRODUCT_URL,
                "Skład, format, wskazania, przeciwwskazania i działania niepożądane",
            ),
        ),
        image_path="/beautydocs/catalog/teosyal-rha-3.jpg",
        offers=(
            _price_offer(
                "Biodermatic",
                679.0,
                "https://biodermatic.com/wypelniacze-ha/teosyal-rha-3-z-lidokaina-2-x-1-ml",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:teosyal-rha-4-1-2ml",
        "TEOSYAL RHA 4 1,2 ml",
        "TEOSYAL / TEOXANE",
        "Wariant RHA 4 z 23 mg/ml kwasu hialuronowego i 0,3% lidokainy, "
        "przeznaczony według producenta do głębokich fałd w grubszej skórze.",
        presentation="2 × 1,2 ml",
        volume_ml=1.2,
        contains_lidocaine=True,
        manufacturer_uses=(
            "Głębokie zmarszczki i fałdy w obszarach grubszej skóry",
            "Umiarkowane lub nasilone bruzdy nosowo-wargowe",
        ),
        aliases=("teosyal rha4", "teoxane rha 4", "rha 4"),
        source_url=TEOSYAL_PRODUCT_URL,
        source_documents=(
            _source_document(
                "TEOXANE — informacja produktowa",
                TEOSYAL_PRODUCT_URL,
                "Skład, format, wskazania, przeciwwskazania i działania niepożądane",
            ),
        ),
        image_path="/beautydocs/catalog/teosyal-rha-4.jpg",
        offers=(
            _price_offer(
                "Biodermatic",
                720.0,
                "https://biodermatic.com/teosyal-rha-4-z-lidokaina-2-x-1-ml",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:teosyal-rha-kiss-0-7ml",
        "TEOSYAL RHA Kiss 0,7 ml",
        "TEOSYAL / TEOXANE",
        "Wariant RHA Kiss z 23 mg/ml kwasu hialuronowego i 0,3% lidokainy. "
        "Materiały HCP marki opisują subtelną objętość i kontur ust.",
        presentation="2 × 0,7 ml",
        volume_ml=0.7,
        contains_lidocaine=True,
        manufacturer_uses=("Subtelna objętość i kontur ust w materiałach HCP producenta",),
        aliases=("teosyal kiss", "teoxane rha kiss", "rha kiss"),
        source_url=TEOSYAL_HCP_URL,
        source_documents=(
            _source_document(
                "TEOXANE — informacja produktowa",
                TEOSYAL_PRODUCT_URL,
                "Skład i format 0,7 ml",
            ),
            _source_document(
                "TEOXANE — portfolio dla profesjonalistów",
                TEOSYAL_HCP_URL,
                "Pozycjonowanie wariantu w portfolio producenta",
            ),
        ),
        image_path="/beautydocs/catalog/teosyal-rha-kiss.jpg",
        offers=(
            _price_offer(
                "Biodermatic",
                526.0,
                "https://biodermatic.com/teosyal-rha-kiss-2-x-0-7-ml",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:belotero-balance-lidocaine-1ml",
        "Belotero Balance Lidocaine 1,0 ml",
        "Belotero / Merz Aesthetics",
        "Wariant Balance z lidokainą z oficjalnego portfolio Belotero, opisywany "
        "przez markę do umiarkowanych linii i zmarszczek.",
        presentation="1 × 1,0 ml",
        volume_ml=1.0,
        contains_lidocaine=True,
        manufacturer_uses=("Umiarkowane linie i zmarszczki twarzy",),
        aliases=("belotero balance", "belotero balance lidocaine"),
        source_url=BELOTERO_IFU_URL,
        source_documents=(
            _source_document(
                "Merz Aesthetics — portal aktualnych IFU",
                BELOTERO_IFU_URL,
                "Lista wariantów i aktualne instrukcje dla poszczególnych rynków",
            ),
            _source_document(
                "Merz — portfolio Belotero",
                BELOTERO_PORTFOLIO_URL,
                "Oficjalne portfolio marki i prezentacja kolekcji",
            ),
        ),
        image_path="/beautydocs/catalog/belotero-family.jpg",
        image_note=(
            "Oficjalne zdjęcie poglądowe kolekcji Belotero; "
            "karta dotyczy wariantu Balance Lidocaine."
        ),
        image_credit_url=BELOTERO_PORTFOLIO_URL,
        offers=(
            _price_offer(
                "Estetyczna Hurtownia",
                269.0,
                "https://estetycznahurtownia.pl/pl/c/Belotero/278",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:belotero-intense-lidocaine-1ml",
        "Belotero Intense Lidocaine 1,0 ml",
        "Belotero / Merz Aesthetics",
        "Wariant Intense z lidokainą z oficjalnego portfolio Belotero, opisywany "
        "do głębszych linii i augmentacji ust.",
        presentation="1 × 1,0 ml",
        volume_ml=1.0,
        contains_lidocaine=True,
        manufacturer_uses=("Głębokie linie twarzy", "Augmentacja ust"),
        aliases=("belotero intense", "belotero intense lidocaine"),
        source_url=BELOTERO_IFU_URL,
        source_documents=(
            _source_document(
                "Merz Aesthetics — portal aktualnych IFU",
                BELOTERO_IFU_URL,
                "Aktualne instrukcje, przeciwwskazania i ostrzeżenia dla rynku",
            ),
            _source_document(
                "Merz — portfolio Belotero",
                BELOTERO_PORTFOLIO_URL,
                "Oficjalne portfolio marki i prezentacja kolekcji",
            ),
        ),
        image_path="/beautydocs/catalog/belotero-family.jpg",
        image_note=(
            "Oficjalne zdjęcie poglądowe kolekcji Belotero; "
            "karta dotyczy wariantu Intense Lidocaine."
        ),
        image_credit_url=BELOTERO_PORTFOLIO_URL,
        offers=(
            _price_offer(
                "Estetyczna Hurtownia",
                319.0,
                "https://estetycznahurtownia.pl/pl/c/Belotero/278",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:belotero-volume-lidocaine-1ml",
        "Belotero Volume Lidocaine 1,0 ml",
        "Belotero / Merz Aesthetics",
        "Wariant Volume z lidokainą z oficjalnego portfolio Belotero, opisywany "
        "przez markę do odbudowy objętości twarzy.",
        presentation="1 × 1,0 ml",
        volume_ml=1.0,
        contains_lidocaine=True,
        manufacturer_uses=("Odbudowa objętości twarzy",),
        aliases=("belotero volume", "belotero volume lidocaine"),
        source_url=BELOTERO_IFU_URL,
        source_documents=(
            _source_document(
                "Merz Aesthetics — portal aktualnych IFU",
                BELOTERO_IFU_URL,
                "Lista wariantów i aktualne instrukcje dla poszczególnych rynków",
            ),
            _source_document(
                "Merz — portfolio Belotero",
                BELOTERO_PORTFOLIO_URL,
                "Oficjalne portfolio marki i prezentacja kolekcji",
            ),
        ),
        image_path="/beautydocs/catalog/belotero-family.jpg",
        image_note=(
            "Oficjalne zdjęcie poglądowe kolekcji Belotero; "
            "karta dotyczy wariantu Volume Lidocaine."
        ),
        image_credit_url=BELOTERO_PORTFOLIO_URL,
        offers=(
            _price_offer(
                "LipStore",
                359.0,
                "https://lipstore.pl/pl/p/Belotero-Volume-Lidocaine-1x1-ml/714",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:restylane-defyne-1ml",
        "Restylane Defyne 1,0 ml",
        "Restylane / Galderma",
        "Wypełniacz z 20 mg/ml usieciowanego kwasu hialuronowego i 3 mg/ml "
        "lidokainy, przeznaczony według IFU do ciężkich zmarszczek i fałd twarzy.",
        presentation="1 × 1,0 ml",
        volume_ml=1.0,
        contains_lidocaine=True,
        manufacturer_uses=(
            "Ciężkie zmarszczki i fałdy twarzy, w tym bruzdy nosowo-wargowe i linie marionetki",
        ),
        aliases=("restylane defyne", "galderma defyne"),
        storage="Do 25°C; chronić przed mrozem i światłem słonecznym.",
        source_url=RESTYLANE_DEFYNE_IFU_URL,
        source_documents=(
            _source_document(
                "Galderma — Restylane Defyne IFU",
                RESTYLANE_DEFYNE_IFU_URL,
                "Skład, format, przeznaczenie, przeciwwskazania i ostrzeżenia",
            ),
        ),
        image_path="/beautydocs/catalog/restylane-family.png",
        image_note=(
            "Oficjalne zdjęcie poglądowe rodziny Restylane; opakowanie wariantu może się różnić."
        ),
        offers=(
            _price_offer(
                "Dermatic",
                345.0,
                "https://dermatic.pl/restylane-defyne-1ml/",
            ),
        ),
    ),
    _professional_filler(
        "professional-product:restylane-kysse-1ml",
        "Restylane Kysse 1,0 ml",
        "Restylane / Galderma",
        "Wypełniacz z 20 mg/ml usieciowanego kwasu hialuronowego i 3 mg/ml "
        "lidokainy, przeznaczony według IFU do odbudowy lub zwiększania objętości ust.",
        presentation="1 × 1,0 ml",
        volume_ml=1.0,
        contains_lidocaine=True,
        manufacturer_uses=("Odbudowa lub zwiększanie objętości ust",),
        aliases=("restylane kysse", "galderma kysse"),
        storage="Do 25°C; chronić przed mrozem i światłem słonecznym.",
        source_url=RESTYLANE_KYSSE_IFU_URL,
        source_documents=(
            _source_document(
                "Galderma — Restylane Kysse IFU",
                RESTYLANE_KYSSE_IFU_URL,
                "Skład, format, przeznaczenie, przeciwwskazania i ostrzeżenia",
            ),
        ),
        image_path="/beautydocs/catalog/restylane-family.png",
        image_note=(
            "Oficjalne zdjęcie poglądowe rodziny Restylane; opakowanie wariantu może się różnić."
        ),
        offers=(
            _price_offer(
                "Dermatic",
                295.0,
                "https://dermatic.pl/restylane-kysse-1ml/",
                availability="OUT_OF_STOCK",
            ),
        ),
    ),
    _professional_device(
        "professional-device:soprano-titanium-special-edition",
        "Soprano Titanium Special Edition",
        "Alma Lasers",
        "Platforma do redukcji owłosienia łącząca trzy długości fal w jednej "
        "głowicy zabiegowej, z technologiami SHR i ICE Plus.",
        presentation="Platforma laserowa",
        manufacturer_uses=("Redukcja owłosienia",),
        technologies=("3D: jednoczesne działanie trzech długości fal", "SHR", "ICE Plus"),
        wavelengths=("755 nm", "810 nm", "1064 nm"),
        features=(
            "Jednoczesna emisja trzech długości fal opisana przez producenta",
            "Chłodzenie kontaktowe ICE Plus",
            "Tryb SHR wykorzystujący stopniowe dostarczanie energii",
        ),
        aliases=(
            "soprano titanium",
            "alma soprano",
            "laser 755 810 1064",
            "depilacja laserowa alma",
        ),
        source_url=SOPRANO_TITANIUM_URL,
        image_path="/beautydocs/catalog/soprano-titanium-official.png",
    ),
    _professional_device(
        "professional-device:gentlemax-pro-plus",
        "GentleMax Pro Plus",
        "Candela",
        "Dwufalowa platforma laserowa łącząca laser aleksandrytowy 755 nm "
        "i Nd:YAG 1064 nm, rozwijająca rodzinę Gentle Pro.",
        presentation="Platforma laserowa",
        manufacturer_uses=(
            "Trwała redukcja owłosienia",
            "Łagodne zmiany barwnikowe i zmiany naczyniowe",
            "Zmarszczki i onychomikoza w zakresach opisanych przez producenta",
        ),
        technologies=("Laser aleksandrytowy", "Laser Nd:YAG", "DCD / ACC"),
        wavelengths=("755 nm", "1064 nm"),
        features=(
            "Plamka zabiegowa do 26 mm w konfiguracji GLX",
            "Krótkie czasy impulsu przeznaczone także do cienkich włosów",
            "Chłodzenie DCD lub kompatybilność z chłodzeniem powietrznym ACC",
        ),
        aliases=(
            "candela gentlemax",
            "gentle max pro plus",
            "laser aleksandrytowy nd yag",
            "laser 755 1064",
        ),
        source_url=GENTLEMAX_PRO_PLUS_URL,
        image_path="/beautydocs/catalog/gentlemax-pro-plus.jpg",
        source_documents=(
            _source_document(
                "Candela — GentleMax Pro Plus",
                GENTLEMAX_PRO_PLUS_URL,
                "Model i zastosowania opisane przez producenta",
            ),
            _source_document(
                "Candela — oficjalna broszura techniczna",
                GENTLEMAX_PRO_PLUS_BROCHURE_URL,
                "Długości fal, zakres plamek, czasy impulsu i systemy chłodzenia",
            ),
        ),
    ),
    _professional_device(
        "professional-device:lightsheer-quattro",
        "LightSheer QUATTRO",
        "Lumenis",
        "Dwufalowy system diodowy do redukcji owłosienia z końcówkami "
        "wykorzystującymi podciśnienie lub chłodzenie kontaktowe ChillTip.",
        presentation="System lasera diodowego",
        manufacturer_uses=("Redukcja owłosienia",),
        technologies=("Laser diodowy", "High-Speed Vacuum", "ChillTip"),
        wavelengths=("805 nm", "1060 nm"),
        features=(
            "Dwie długości fal dostępne na jednej platformie",
            "Końcówki zabiegowe o różnych rozmiarach plamki",
            "Podciśnienie lub chłodzenie kontaktowe zależnie od końcówki",
        ),
        aliases=(
            "lightsheer quattro",
            "lumenis lightsheer",
            "laser diodowy 805 1060",
            "depilacja laserowa lumenis",
        ),
        source_url=LIGHTSHEER_QUATTRO_URL,
        image_path="/beautydocs/catalog/lightsheer-quattro.png",
    ),
    _professional_device(
        "professional-device:elite-iq",
        "Elite iQ",
        "Cynosure Lutronic",
        "Dwufalowa platforma laserowa z czytnikiem melaniny Skintel, "
        "przeznaczona do wielu procedur estetycznych.",
        presentation="Platforma laserowa",
        manufacturer_uses=(
            "Redukcja owłosienia",
            "Zmiany naczyniowe i barwnikowe",
            "Wybrane procedury odmładzające skórę",
        ),
        technologies=("Laser aleksandrytowy", "Laser Nd:YAG", "Czytnik Skintel"),
        wavelengths=("755 nm", "1064 nm"),
        features=(
            "Wbudowany czytnik melaniny Skintel",
            "Dwie długości fal na jednej platformie",
            "Konfigurowalne rozmiary plamki i parametry zabiegowe",
        ),
        aliases=("elite iq", "cynosure elite", "skintel", "laser 755 1064"),
        source_url=ELITE_IQ_URL,
        image_path="/beautydocs/catalog/elite-iq-official.png",
    ),
    _professional_device(
        "professional-device:stellar-m22",
        "Stellar M22",
        "Lumenis",
        "Modułowa platforma wielozadaniowa łącząca technologie światła "
        "impulsowego i laserowe w zależności od konfiguracji urządzenia.",
        presentation="Platforma wieloaplikacyjna",
        manufacturer_uses=(
            "Redukcja owłosienia",
            "Zmiany naczyniowe i barwnikowe",
            "Wybrane procedury poprawiające wygląd i strukturę skóry",
        ),
        technologies=("IPL / XPL", "ResurFX", "Nd:YAG"),
        features=(
            "Moduły i aplikatory dobierane do konfiguracji platformy",
            "Ponad 30 wskazań deklarowanych dla rodziny urządzenia",
            "Wymienne filtry i prowadzenie parametrów zależne od aplikatora",
        ),
        aliases=("stellar m22", "lumenis m22", "ipl xpl", "resurfx"),
        source_url=STELLAR_M22_URL,
        image_path="/beautydocs/catalog/stellar-m22-official.png",
    ),
    _professional_cosmetic(
        "professional-cosmetic:cicaplast-baume-b5-plus",
        "Cicaplast Baume B5+",
        "La Roche-Posay",
        "Balsam kojąco-regenerujący do podrażnionej i osłabionej skóry, "
        "w tym do pielęgnacji po wybranych zabiegach dermatologicznych.",
        presentation="Tuba • 40 ml / 100 ml",
        available_sizes=("40 ml", "100 ml"),
        manufacturer_uses=(
            "Pielęgnacja podrażnionej i osłabionej skóry twarzy i ciała",
            "Pielęgnacja skóry po powierzchownych zabiegach zgodnie z opisem marki",
        ),
        key_ingredients=("Pantenol 5%", "Madedekasozyd", "Tribioma"),
        skin_types=("Skóra wrażliwa", "Skóra podrażniona lub osłabiona"),
        aftercare_category="BARRIER_CARE",
        aliases=("cicaplast b5", "cicaplast baume", "krem po zabiegu"),
        source_url=CICAPLAST_BAUME_B5_URL,
        image_path="/beautydocs/catalog/cicaplast-baume-b5-plus.png",
        offers=(
            _price_offer(
                "MAKEUP — 40 ml",
                39.30,
                "https://makeup.pl/product/19844/",
                source_type="MARKETPLACE",
            ),
        ),
    ),
    _professional_cosmetic(
        "professional-cosmetic:cicaplast-baume-b5-spf50",
        "Cicaplast Baume B5+ SPF 50",
        "La Roche-Posay",
        "Balsam regenerujący z bardzo wysoką ochroną przeciwsłoneczną, "
        "przeznaczony dla skóry osłabionej i narażonej na promieniowanie UV.",
        presentation="Tuba • 40 ml",
        available_sizes=("40 ml",),
        manufacturer_uses=(
            "Pielęgnacja osłabionej skóry narażonej na promieniowanie UV",
            "Ochrona skóry po wybranych zabiegach dermatologicznych i kosmetycznych",
        ),
        key_ingredients=("Pantenol 5%", "Madedekasozyd", "Filtry UVA i UVB"),
        skin_types=("Skóra wrażliwa", "Skóra osłabiona i narażona na UV"),
        aftercare_category="SUN_PROTECTION",
        aliases=("cicaplast spf", "cicaplast 50", "balsam po zabiegu z filtrem"),
        source_url=CICAPLAST_BAUME_B5_SPF50_URL,
        image_path="/beautydocs/catalog/cicaplast-baume-b5-spf50.png",
        offers=(
            _price_offer(
                "MAKEUP — 40 ml",
                62.34,
                "https://makeup.pl/product/950617/",
                source_type="MARKETPLACE",
            ),
        ),
    ),
    _professional_cosmetic(
        "professional-cosmetic:avene-cicalfate-plus",
        "Cicalfate+ Regenerujący krem ochronny",
        "Avène",
        "Krem ochronny do wrażliwej, podrażnionej i uszkodzonej skóry, "
        "opisywany przez markę także w kontekście pielęgnacji pozabiegowej.",
        presentation="Tuba • 40 ml / 100 ml",
        available_sizes=("40 ml", "100 ml"),
        manufacturer_uses=(
            "Pielęgnacja podrażnionej i uszkodzonej skóry twarzy i ciała",
            "Pielęgnacja po powierzchownych zabiegach dermatologicznych",
        ),
        key_ingredients=("C+-Restore", "Kompleks miedzi i cynku", "Woda termalna Avène"),
        skin_types=("Skóra wrażliwa", "Skóra podrażniona lub uszkodzona"),
        aftercare_category="BARRIER_CARE",
        aliases=("avene cicalfate", "cicalfate plus", "krem regenerujący avene"),
        source_url=AVENE_CICALFATE_URL,
        image_path="/beautydocs/catalog/avene-cicalfate-plus.png",
        offers=(
            _price_offer(
                "MAKEUP — 40 ml",
                44.99,
                "https://makeup.pl/product/472316/",
                source_type="MARKETPLACE",
            ),
        ),
    ),
    _professional_cosmetic(
        "professional-cosmetic:avene-cicalfate-spf50",
        "Cicalfate+ Multi-Protective Repair Cream SPF 50+",
        "Avène",
        "Krem regenerujący w opakowaniu z pompką, łączący pielęgnację "
        "osłabionej skóry z ochroną UVB, UVA i światłem wysokoenergetycznym.",
        presentation="Pompka • 30 ml",
        available_sizes=("30 ml",),
        manufacturer_uses=(
            "Pielęgnacja podrażnionej skóry wystawionej na działanie słońca",
            "Pielęgnacja po powierzchownych zabiegach dermatologicznych",
        ),
        key_ingredients=("C+-Restore", "System filtrów SPF 50+", "Woda termalna Avène"),
        skin_types=("Skóra wrażliwa", "Skóra podrażniona i narażona na słońce"),
        aftercare_category="SUN_PROTECTION",
        aliases=("avene cicalfate spf", "cicalfate 50", "krem pozabiegowy spf"),
        source_url=AVENE_CICALFATE_SPF50_URL,
        image_path="/beautydocs/catalog/avene-cicalfate-spf50.png",
        offers=(
            _price_offer(
                "Apteka w Sieci",
                51.87,
                "https://www.aptekawsieci.pl/avene-cicalfate-spf-50-krem-regenerujacy-30ml.pdf",
            ),
        ),
    ),
    _professional_cosmetic(
        "professional-cosmetic:bioderma-cicabio-creme-plus",
        "Cicabio Crème+",
        "Bioderma",
        "Krem do skóry osłabionej i podrażnionej, tworzący ochronną, "
        "oddychającą warstwę i wspierający komfort skóry.",
        presentation="Tuba • 40 ml",
        available_sizes=("40 ml",),
        manufacturer_uses=(
            "Pielęgnacja osłabionej i podrażnionej skóry",
            "Wsparcie komfortu oraz ochrony skóry podczas regeneracji",
        ),
        key_ingredients=("Kompleks Optimal Repair", "Technologia Antalgicine"),
        skin_types=("Skóra wrażliwa", "Skóra podrażniona lub osłabiona"),
        aftercare_category="BARRIER_CARE",
        aliases=("bioderma cicabio", "cicabio creme", "cicabio cream plus"),
        source_url=BIODERMA_CICABIO_URL,
        image_path="/beautydocs/catalog/bioderma-cicabio-creme-plus.png",
        offers=(
            _price_offer(
                "MAKEUP — 40 ml",
                36.16,
                "https://makeup.pl/product/973939/",
                source_type="MARKETPLACE",
            ),
        ),
    ),
    _professional_cosmetic(
        "professional-cosmetic:uriage-bariederm-cica",
        "Bariéderm-CICA Repairing Cream with Cu-Zn",
        "Uriage",
        "Krem do podrażnionej i wrażliwej skóry twarzy oraz ciała, "
        "opisywany przez markę jako produkt ochronny i regenerujący.",
        presentation="Tuba • 15 ml / 40 ml / 100 ml",
        available_sizes=("15 ml", "40 ml", "100 ml"),
        manufacturer_uses=(
            "Pielęgnacja podrażnionej i wrażliwej skóry twarzy oraz ciała",
            "Ochrona skóry i wsparcie komfortu podczas regeneracji",
        ),
        key_ingredients=("D-pantenol", "Miedź i cynk", "GF-Repair", "Poly-2P"),
        skin_types=("Skóra wrażliwa", "Skóra podrażniona"),
        aftercare_category="BARRIER_CARE",
        aliases=("uriage bariederm", "bariederm cica", "cica cu zn"),
        source_url=URIAGE_BARIEDERM_CICA_URL,
        image_path="/beautydocs/catalog/uriage-bariederm-cica-product.webp",
        offers=(
            _price_offer(
                "Rossmann — 40 ml",
                43.99,
                "https://www.rossmann.pl/Produkt/Kremy-do-twarzy/Uriage-Bariederm-CICA-krem-do-twarzy-i-ciala-regenerujacy-40-ml%2C2133697%2C13049",
            ),
            _price_offer(
                "MAKEUP — 15 ml",
                26.03,
                "https://makeup.pl/product/300633/",
                source_type="MARKETPLACE",
            ),
        ),
        additional_images=(
            _product_image(
                "/beautydocs/catalog/uriage-bariederm-cica-formula.webp",
                "Uriage Bariéderm-CICA — infografika składników formuły",
                label="Formuła",
            ),
            _product_image(
                "/beautydocs/catalog/uriage-bariederm-cica-dermatology.webp",
                "Uriage Bariéderm-CICA — informacje o cechach produktu",
                label="Cechy produktu",
            ),
            _product_image(
                "/beautydocs/catalog/uriage-bariederm-cica-clinical-results.webp",
                "Uriage Bariéderm-CICA — materiał z wynikami badania klinicznego",
                label="Badanie kliniczne",
            ),
            _product_image(
                "/beautydocs/catalog/uriage-bariederm-cica-poly-2p.webp",
                "Uriage Bariéderm-CICA — infografika technologii Poly-2P",
                label="Technologia Poly-2P",
            ),
            _product_image(
                "/beautydocs/catalog/uriage-bariederm-cica-regeneration.webp",
                "Uriage Bariéderm-CICA — materiał dotyczący regeneracji skóry",
                label="Regeneracja",
            ),
            _product_image(
                "/beautydocs/catalog/uriage-bariederm-cica-application.webp",
                "Uriage Bariéderm-CICA — konsystencja kremu na skórze",
                label="Konsystencja",
            ),
        ),
    ),
    _comparison_product(
        "professional-product:avalon-vital-plus",
        CatalogItemKind.TREATMENT_SUBSTANCE,
        "Avalon Vital Plus — usieciowany kwas hialuronowy",
        "Avalon",
        "Usieciowany preparat kwasu hialuronowego przeznaczony do zastosowań "
        "profesjonalnych; wariant i instrukcję użycia należy potwierdzić w IFU.",
        presentation="1 opakowanie — format do potwierdzenia w ofercie",
        product_category="Preparat zabiegowy",
        product_family="Wypełniacz na bazie kwasu hialuronowego",
        manufacturer_uses=("Profesjonalne zabiegi estetyczne po kwalifikacji",),
        treatment_categories=("Wypełniacze i modelowanie",),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        key_ingredients=("Usieciowany kwas hialuronowy",),
        aliases=("avalon vital plus", "avalon kwas hialuronowy"),
        image_path="/beautydocs/catalog/avalon-vital-plus-pack.webp",
        image_alt="Avalon Vital Plus — opakowanie i ampułkostrzykawka 1 ml",
        additional_images=(
            _product_image(
                "/beautydocs/catalog/avalon-vital-plus-lifestyle.webp",
                "Avalon Vital Plus — opakowanie i ampułkostrzykawka w aranżacji produktowej",
                label="Produkt",
                fit="cover",
            ),
        ),
        offers=(_price_offer("Shopia", 159.0, SHOPIA_STORE_URL),),
        professional_only=True,
    ),
    _comparison_product(
        "professional-medicine:dexamethasone-sodium-phosphate-8mg-2ml-3",
        CatalogItemKind.MEDICINE,
        "Dexamethasone Sodium Phosphate Injection 8 mg / 2 ml / 3 ampułki",
        "Dexamethasone",
        "Roztwór do wstrzykiwań zawierający deksametazon. Pozycja jest prezentowana "
        "wyłącznie informacyjnie — bez publicznej promocji i bez odsyłacza zakupowego.",
        presentation="8 mg / 2 ml • 3 ampułki",
        product_category="Produkt leczniczy — status do weryfikacji w RPL",
        product_family="Glikokortykosteroid do wstrzykiwań",
        manufacturer_uses=(),
        treatment_categories=("Produkt leczniczy",),
        application_areas=(),
        key_ingredients=("Dexamethasone sodium phosphate",),
        aliases=("dexamethasone 8 mg 2 ml", "deksametazon ampułki"),
        image_path="/beautydocs/catalog/dexamethasone-pack.webp",
        image_alt="Dexamethasone Sodium Phosphate Injection 8 mg / 2 ml — opakowanie 3 ampułek",
        source_url=RPL_PUBLIC_URL,
        comparison_status="INFORMATION_ONLY",
        comparison_notice=(
            "Publiczne porównanie cen i odsyłacze zakupowe są wyłączone. Dla produktu "
            "leczniczego wydawanego na receptę obowiązują ograniczenia reklamy i "
            "sprzedaży wysyłkowej. Status, dostępność i sposób uzyskania potwierdź w "
            "oficjalnym RPL, z lekarzem lub farmaceutą."
        ),
        professional_only=True,
        usage_notice=(
            "Nie stosować na podstawie informacji z katalogu. Wymaga decyzji lekarza, "
            "weryfikacji produktu w RPL oraz postępowania zgodnie z Charakterystyką "
            "Produktu Leczniczego."
        ),
    ),
    _comparison_product(
        "professional-product:leedfrost-10-56-gel",
        CatalogItemKind.TREATMENT_SUBSTANCE,
        "LeedFrost 10,56% — żel znieczulający do medycyny estetycznej",
        "LeedFrost",
        "Żel o deklarowanym stężeniu 10,56%, prezentowany jako produkt do zastosowań "
        "profesjonalnych. Status prawny i instrukcję należy sprawdzić przed użyciem.",
        presentation="Żel • format do potwierdzenia w ofercie",
        product_category="Preparat profesjonalny — status do weryfikacji",
        product_family="Preparat miejscowo znieczulający",
        manufacturer_uses=("Zastosowanie miejscowe wyłącznie zgodnie z instrukcją produktu",),
        treatment_categories=("Znieczulenie miejscowe", "Medycyna estetyczna"),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        aliases=("leed frost", "leedfrost 10.56", "leedfrost 10,56"),
        image_path="/beautydocs/catalog/leedfrost-pack.webp",
        image_alt="LeedFrost 10,56% — opakowanie i tuba 50 g",
        additional_images=(
            _product_image(
                "/beautydocs/catalog/leedfrost-lifestyle.webp",
                "LeedFrost 10,56% — tuba produktu w dłoniach modelki",
                label="Ujęcie produktu",
                fit="cover",
            ),
        ),
        offers=(_price_offer("Shopia", 119.99, SHOPIA_STORE_URL),),
        comparison_status="REGULATORY_CHECK",
        professional_only=True,
    ),
    _comparison_product(
        "professional-product:progelcaine-gel-9-6",
        CatalogItemKind.TREATMENT_SUBSTANCE,
        "Progelcaine gel 9,6% — znieczulenie do medycyny estetycznej",
        "Progelcaine",
        "Żel o deklarowanym stężeniu 9,6%, oferowany do zastosowań profesjonalnych. "
        "Przed użyciem trzeba zweryfikować status produktu, skład i przeciwwskazania.",
        presentation="Żel • 50 g",
        product_category="Preparat profesjonalny — status do weryfikacji",
        product_family="Preparat miejscowo znieczulający",
        manufacturer_uses=("Zastosowanie miejscowe wyłącznie zgodnie z instrukcją produktu",),
        treatment_categories=("Znieczulenie miejscowe", "Medycyna estetyczna"),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        aliases=("progelcaine", "progelcaine 9.6", "progelcaine 9,6"),
        image_path="/beautydocs/catalog/progelcaine-pack.webp",
        image_alt="Progelcaine Gel — opakowanie i tuba 50 g",
        offers=(
            _price_offer(
                "Shopia",
                119.0,
                "https://shopia.com.pl/sklep/progelcaine-gel-9-6-50g/",
            ),
        ),
        comparison_status="REGULATORY_CHECK",
        professional_only=True,
    ),
    _comparison_product(
        "professional-cosmetic:sadoer-aloe-vera-eye-mask",
        CatalogItemKind.COSMETIC,
        "SADÖER Aloe Vera Eye Mask — chłodzące płatki pod oczy",
        "SADÖER",
        "Hydrożelowe płatki pod oczy z aloesem, przeznaczone do krótkiej pielęgnacji "
        "okolicy pod oczami.",
        presentation="Opakowanie • 60 płatków",
        product_category="Kosmetyk",
        product_family="Płatki hydrożelowe pod oczy",
        manufacturer_uses=("Pielęgnacja i chłodzenie okolicy pod oczami",),
        treatment_categories=("Pielęgnacja okolicy oczu",),
        application_areas=(_application_area("EYES", "Okolica pod oczami"),),
        key_ingredients=("Aloe vera", "Kolagen"),
        aliases=("sadoer eye mask", "platki pod oczy aloe vera"),
        image_path="/beautydocs/catalog/sadoer-eye-mask-pack.webp",
        image_alt="SADÖER Aloe Vera Eye Mask — opakowanie płatków pod oczy",
        additional_images=(
            _product_image(
                "/beautydocs/catalog/sadoer-eye-mask-application.webp",
                "SADÖER Aloe Vera Eye Mask — płatki nałożone pod oczy",
                label="Sposób użycia",
                fit="cover",
            ),
        ),
        offers=(
            _price_offer(
                "Allegro",
                22.50,
                "https://allegro.pl/oferta/platki-zelowe-pod-oczy-ekstrak-aloe-vera-60-sztuk-maseczka-sadoer-17881438360",
                source_type="MARKETPLACE",
            ),
            _price_offer(
                "Shopia",
                49.99,
                "https://shopia.com.pl/sklep/sadoer-aloe-vera-eye-mask-chlodzace-platki-pod-oczy-z-aloesem-i-kolagenem/",
            ),
        ),
    ),
    _comparison_product(
        "professional-device:lumira-silicone-led-mask-7-colors",
        CatalogItemKind.DEVICE,
        "Silikonowa maska LED z 7 kolorami światła LUMIRA",
        "LUMIRA",
        "Domowa silikonowa maska wykorzystująca siedem kolorów światła LED. "
        "Parametry, przeciwwskazania i zgodność urządzenia sprawdź w instrukcji.",
        presentation="Silikonowa maska LED • 7 kolorów światła",
        product_category="Urządzenie kosmetyczne",
        product_family="Maska do domowej terapii światłem LED",
        manufacturer_uses=("Domowa pielęgnacja skóry światłem LED zgodnie z instrukcją",),
        treatment_categories=("Terapia LED", "Pielęgnacja domowa"),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        aliases=("lumira led", "maska led 7 kolorow"),
        image_path="/beautydocs/catalog/lumira-led-mask-green.webp",
        image_alt="Silikonowa maska LED LUMIRA — widok urządzenia ze światłem zielonym",
        additional_images=(
            _product_image(
                "/beautydocs/catalog/lumira-led-mask-case.webp",
                "Silikonowa maska LED LUMIRA — urządzenie w opakowaniu",
                label="Zawartość opakowania",
                fit="cover",
            ),
        ),
        offers=(
            _price_offer(
                "Shopia",
                390.0,
                "https://shopia.com.pl/sklep/silikonowa-maska-led-z-7-kolorami-swiatla-lumira-twoja-domowa-terapia-swiatlem-na-wyciagniecie-reki/",
            ),
        ),
    ),
    _comparison_product(
        "professional-cosmetic:skin1004-centella-cream-75ml",
        CatalogItemKind.COSMETIC,
        "SKIN1004 Centella Nawilżający Krem do Twarzy 75 ml",
        "SKIN1004",
        "Nawilżający krem do twarzy z wąkrotą azjatycką przeznaczony do codziennej "
        "pielęgnacji i wsparcia komfortu skóry.",
        presentation="Słoik • 75 ml",
        product_category="Kosmetyk",
        product_family="Krem nawilżający do twarzy",
        manufacturer_uses=("Codzienna pielęgnacja nawilżająca skóry twarzy",),
        treatment_categories=("Nawilżanie", "Pielęgnacja twarzy"),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        key_ingredients=("Wąkrota azjatycka (Centella asiatica)",),
        aliases=("skin1004 centella cream", "madagascar centella cream 75"),
        image_path="/beautydocs/catalog/skin1004-centella-cream.webp",
        image_alt="SKIN1004 Madagascar Centella Cream 75 ml — tuba produktu",
        offers=(_price_offer("Shopia", 109.0, SHOPIA_STORE_URL),),
        source_url=SHOPIA_STORE_URL,
    ),
    _comparison_product(
        "professional-cosmetic:skin1004-centella-toner-210ml",
        CatalogItemKind.COSMETIC,
        "SKIN1004 Centella Tonik do Twarzy 210 ml",
        "SKIN1004",
        "Tonik do codziennej pielęgnacji twarzy z ekstraktem z wąkroty azjatyckiej.",
        presentation="Butelka • 210 ml",
        product_category="Kosmetyk",
        product_family="Tonik do twarzy",
        manufacturer_uses=("Tonizacja skóry po oczyszczaniu",),
        treatment_categories=("Tonizacja", "Pielęgnacja twarzy"),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        key_ingredients=("Wąkrota azjatycka (Centella asiatica)",),
        aliases=("skin1004 toning toner", "centella toner 210"),
        image_path="/beautydocs/catalog/skin1004-toner.webp",
        image_alt="SKIN1004 Centella — butelka toniku do twarzy",
        offers=(
            _price_offer(
                "Shopia",
                99.99,
                "https://shopia.com.pl/sklep/skin-1004-centella-tonik-do-twarzy-z-wakrota-azjatycka-210-ml/",
            ),
        ),
        source_url=(
            "https://shopia.com.pl/sklep/"
            "skin-1004-centella-tonik-do-twarzy-z-wakrota-azjatycka-210-ml/"
        ),
    ),
    _comparison_product(
        "professional-cosmetic:skin1004-hyalu-cica-sun-serum-spf50-50ml",
        CatalogItemKind.COSMETIC,
        "SKIN1004 Centella Hyalu-Cica Water-Fit Sun Serum SPF50+ 50 ml",
        "SKIN1004",
        "Lekkie serum przeciwsłoneczne SPF50+ do codziennej ochrony skóry twarzy.",
        presentation="Tuba • 50 ml",
        product_category="Kosmetyk ochronny",
        product_family="Serum przeciwsłoneczne SPF50+",
        manufacturer_uses=("Codzienna ochrona skóry twarzy przed promieniowaniem UV",),
        treatment_categories=("Ochrona przeciwsłoneczna", "Pielęgnacja twarzy"),
        application_areas=(
            _application_area("SUN_EXPOSED", "Obszary narażone na promieniowanie UV"),
        ),
        key_ingredients=("Wąkrota azjatycka", "Kwas hialuronowy", "Filtry UV"),
        aliases=("hyalu cica sun serum", "skin1004 spf50"),
        image_path="/beautydocs/catalog/skin1004-sun-serum-beach.webp",
        image_alt="SKIN1004 Hyalu-Cica Water-Fit Sun Serum SPF50+ — tuba produktu",
        additional_images=(
            _product_image(
                "/beautydocs/catalog/skin1004-sun-serum-hand.webp",
                "SKIN1004 Hyalu-Cica Water-Fit Sun Serum SPF50+ — produkt trzymany w dłoni",
                label="Produkt",
                fit="cover",
            ),
            _product_image(
                "/beautydocs/catalog/skin1004-sun-serum-duo.webp",
                "SKIN1004 Hyalu-Cica Water-Fit Sun Serum SPF50+ — zestaw dwóch tub",
                label="Opakowanie zbiorcze",
                fit="cover",
            ),
        ),
        offers=(_price_offer("Shopia", 59.0, SHOPIA_STORE_URL),),
        source_url=SHOPIA_STORE_URL,
    ),
    _comparison_product(
        "professional-cosmetic:skin1004-centella-light-cleansing-oil-200ml",
        CatalogItemKind.COSMETIC,
        "SKIN1004 Centella Lekki Olejek Myjący do Twarzy 200 ml",
        "SKIN1004",
        "Lekki olejek do pierwszego etapu oczyszczania twarzy, z wąkrotą azjatycką.",
        presentation="Butelka z pompką • 200 ml",
        product_category="Kosmetyk",
        product_family="Olejek do oczyszczania twarzy",
        manufacturer_uses=("Usuwanie makijażu, filtrów UV i zanieczyszczeń olejowych",),
        treatment_categories=("Oczyszczanie", "Pielęgnacja twarzy"),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        key_ingredients=("Wąkrota azjatycka (Centella asiatica)",),
        aliases=("skin1004 light cleansing oil", "centella olejek 200"),
        image_path="/beautydocs/catalog/skin1004-cleansing-oil-pack.webp",
        image_alt="SKIN1004 Centella Light Cleansing Oil 200 ml — butelka z pompką i opakowanie",
        additional_images=(
            _product_image(
                "/beautydocs/catalog/skin1004-cleansing-oil-use.webp",
                "SKIN1004 Centella Light Cleansing Oil — konsystencja olejku dozowana na dłoń",
                label="Konsystencja",
                fit="cover",
            ),
        ),
        offers=(_price_offer("Shopia", 99.99, SHOPIA_STORE_URL),),
        source_url=SHOPIA_STORE_URL,
    ),
    _comparison_product(
        "professional-cosmetic:skin1004-centella-ampoule-100ml",
        CatalogItemKind.COSMETIC,
        "SKIN1004 Centella Odżywcze Serum do Twarzy 100 ml",
        "SKIN1004",
        "Serum ampułkowe z wąkrotą azjatycką do codziennej pielęgnacji twarzy.",
        presentation="Butelka z pipetą • 100 ml",
        product_category="Kosmetyk",
        product_family="Serum ampułkowe do twarzy",
        manufacturer_uses=("Codzienna pielęgnacja skóry wymagającej ukojenia i nawilżenia",),
        treatment_categories=("Serum do twarzy", "Pielęgnacja twarzy"),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        key_ingredients=("Wąkrota azjatycka (Centella asiatica)",),
        aliases=("skin1004 centella ampoule", "centella serum 100"),
        image_path="/beautydocs/catalog/skin1004-centella-ampoule-reference-30ml.webp",
        image_alt="SKIN1004 Madagascar Centella Ampoule — zdjęcie wariantu 30 ml",
        image_note=(
            "Zdjęcie poglądowe wariantu 30 ml z tej samej linii. Porównywane oferty "
            "dotyczą wariantu 100 ml — pojemność potwierdź w sklepie."
        ),
        offers=(_price_offer("Shopia", 119.0, SHOPIA_STORE_URL),),
        source_url=SHOPIA_STORE_URL,
    ),
    _comparison_product(
        "professional-cosmetic:skin1004-centella-cleansing-foam",
        CatalogItemKind.COSMETIC,
        "SKIN1004 Centella Pianka do Mycia Twarzy",
        "SKIN1004",
        "Pianka z wąkrotą azjatycką przeznaczona do codziennego oczyszczania twarzy.",
        presentation="Tuba • pojemność do potwierdzenia w ofercie",
        product_category="Kosmetyk",
        product_family="Pianka do mycia twarzy",
        manufacturer_uses=("Codzienne oczyszczanie skóry twarzy",),
        treatment_categories=("Oczyszczanie", "Pielęgnacja twarzy"),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        key_ingredients=("Wąkrota azjatycka (Centella asiatica)",),
        aliases=("skin1004 centella foam", "ampoule foam"),
        image_path="/beautydocs/catalog/skin1004-foam-pack.webp",
        image_alt="SKIN1004 Madagascar Centella Ampoule Foam — tuba produktu",
        additional_images=(
            _product_image(
                "/beautydocs/catalog/skin1004-foam-lifestyle.webp",
                "SKIN1004 Madagascar Centella Ampoule Foam — produkt w ujęciu lifestyle",
                label="Produkt",
                fit="cover",
            ),
        ),
        offers=(_price_offer("Shopia", 79.99, SHOPIA_STORE_URL),),
        source_url=SHOPIA_STORE_URL,
    ),
    _comparison_product(
        "professional-cosmetic:skin1004-centella-full-size-set",
        CatalogItemKind.COSMETIC,
        "SKIN1004 Centella Zestaw Pełnowymiarowych Produktów do Pielęgnacji Twarzy",
        "SKIN1004",
        "Zestaw pełnowymiarowych produktów z linii Centella do wieloetapowej pielęgnacji twarzy.",
        presentation="Zestaw produktów pełnowymiarowych",
        product_category="Zestaw kosmetyków",
        product_family="Rutyna pielęgnacyjna Centella",
        manufacturer_uses=("Kompletna, wieloetapowa pielęgnacja skóry twarzy",),
        treatment_categories=("Zestawy pielęgnacyjne", "Pielęgnacja twarzy"),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        key_ingredients=("Wąkrota azjatycka (Centella asiatica)",),
        aliases=("skin1004 centella zestaw", "skin1004 full size set"),
        image_path="/beautydocs/catalog/skin1004-centella-set-line.webp",
        image_alt="SKIN1004 Madagascar Centella — poglądowe zdjęcie zestawu produktów z linii",
        image_note=(
            "Zdjęcie przedstawia produkty z linii Centella i ma charakter poglądowy. "
            "Dokładną zawartość zestawu pełnowymiarowego sprawdź w wybranej ofercie."
        ),
        offers=(_price_offer("Shopia", 499.0, SHOPIA_STORE_URL),),
    ),
    _comparison_product(
        "professional-cosmetic:skinoe-calmist-tonic",
        CatalogItemKind.COSMETIC,
        "SKINOE CALMIST TONIC",
        "SKINOE",
        "Kojący tonik-mgiełka z laktoferyną oraz kwasami laktobionowym i "
        "bursztynowym. Według opisu marki wspiera komfort skóry, jej barierę i "
        "przywrócenie równowagi pH.",
        presentation="Butelka z atomizerem • 150 ml",
        product_category="Kosmetyk",
        product_family="Tonik kojący do twarzy",
        manufacturer_uses=(
            "Kojenie skóry i ograniczenie widoczności zaczerwienień",
            "Wsparcie bariery ochronnej oraz mikrobiomu skóry",
            "Przywrócenie równowagi pH po oczyszczaniu",
        ),
        treatment_categories=(
            "Tonizacja",
            "Skóra wrażliwa i naczyniowa",
            "Regeneracja bariery skórnej",
            "Pielęgnacja twarzy",
        ),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        key_ingredients=(
            "Laktoferyna",
            "Kwas laktobionowy",
            "Kwas bursztynowy",
            "Trehaloza",
        ),
        aliases=("calmist", "calmist tonic", "skinoe tonik"),
        image_path="/beautydocs/catalog/skinoe-calmist-ingredients.webp",
        image_alt="SKINOE CALMIST TONIC 150 ml — tonik i opis składników aktywnych",
        brand_logo_path="/beautydocs/catalog/skinoe-logo-filter.png",
        additional_images=(
            _product_image(
                "/beautydocs/catalog/skinoe-calmist-lifestyle.jpeg",
                "SKINOE CALMIST TONIC — butelka toniku prezentowana w dłoni",
                label="Produkt w użyciu",
                fit="cover",
            ),
            _product_image(
                "/beautydocs/catalog/skinoe-line-pattern.webp",
                "Linia kosmetyków SKINOE — CALMIST TONIC, LAC GEL, PHLORA SERUM i ROSBIOME CREAM",
                label="Linia SKINOE",
                fit="cover",
            ),
        ),
        offers=(_price_offer("SKINOE", 129.0, SKINOE_CALMIST_URL),),
        source_url=SKINOE_CALMIST_URL,
    ),
    _comparison_product(
        "professional-cosmetic:skinoe-rosbiome-cream",
        CatalogItemKind.COSMETIC,
        "SKINOE ROSBIOME CREAM",
        "SKINOE",
        "Lekki krem z kwasem bursztynowym i rozmarynowym oraz ekstraktem z reishi. "
        "Marka opisuje go jako formułę wspierającą barierę i pielęgnację skóry z "
        "komponentą naczyniową.",
        presentation="Butelka z pompką • 50 ml",
        product_category="Kosmetyk",
        product_family="Krem do twarzy wspierający barierę skóry",
        manufacturer_uses=(
            "Wsparcie potencjału antyoksydacyjnego skóry",
            "Pielęgnacja skóry naczyniowej i skłonnej do zaczerwienień",
            "Wsparcie bariery ochronnej i procesu keratynizacji",
        ),
        treatment_categories=(
            "Skóra wrażliwa i naczyniowa",
            "Pielęgnacja antyoksydacyjna",
            "Regeneracja bariery skórnej",
            "Pielęgnacja twarzy",
        ),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        key_ingredients=(
            "Kwas bursztynowy",
            "Kwas rozmarynowy",
            "Ekstrakt z reishi",
            "Ksylitol",
            "Kwas linolowy",
            "Wąkrota azjatycka",
        ),
        aliases=("rosbiome", "rosbiome cream", "skinoe krem naczynkowy"),
        image_path="/beautydocs/catalog/skinoe-rosbiome-pack.jpg",
        image_alt="SKINOE ROSBIOME CREAM 50 ml — butelka z pompką",
        brand_logo_path="/beautydocs/catalog/skinoe-logo-filter.png",
        additional_images=(
            _product_image(
                "/beautydocs/catalog/skinoe-rosbiome-ingredients.png",
                "SKINOE ROSBIOME CREAM — składniki aktywne i ich rola w pielęgnacji",
                label="Składniki aktywne",
                fit="cover",
            ),
            _product_image(
                "/beautydocs/catalog/skinoe-line-pattern.webp",
                "Linia kosmetyków SKINOE — CALMIST TONIC, LAC GEL, PHLORA SERUM i ROSBIOME CREAM",
                label="Linia SKINOE",
                fit="cover",
            ),
        ),
        offers=(_price_offer("SKINOE", 209.0, SKINOE_ROSBIOME_URL),),
        source_url=SKINOE_ROSBIOME_URL,
    ),
    _comparison_product(
        "professional-cosmetic:skinoe-phlora-serum",
        CatalogItemKind.COSMETIC,
        "SKINOE PHLORA SERUM",
        "SKINOE",
        "Lekkie serum emulsyjne z EGCG, kwasem rozmarynowym i beta-glukanem. "
        "Według opisu marki łączy pielęgnację antyoksydacyjną, nawilżającą i kojącą.",
        presentation="Butelka z pompką • 50 ml",
        product_category="Kosmetyk",
        product_family="Serum antyoksydacyjne do twarzy",
        manufacturer_uses=(
            "Wsparcie nawilżenia i bariery hydrolipidowej",
            "Pielęgnacja antyoksydacyjna i kojąca",
            "Wsparcie równowagi pH i mikrobiomu skóry",
        ),
        treatment_categories=(
            "Serum do twarzy",
            "Pielęgnacja antyoksydacyjna",
            "Nawilżanie",
            "Pielęgnacja twarzy",
        ),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        key_ingredients=(
            "EGCG",
            "Kwas rozmarynowy",
            "Beta-glukan",
            "Pantenol",
            "Kwas linolowy",
            "Wąkrota azjatycka",
        ),
        aliases=("phlora", "phlora serum", "skinoe serum"),
        image_path="/beautydocs/catalog/skinoe-phlora-pack.jpg",
        image_alt="SKINOE PHLORA SERUM 50 ml — butelka serum w aranżacji z kwiatami",
        brand_logo_path="/beautydocs/catalog/skinoe-logo-filter.png",
        additional_images=(
            _product_image(
                "/beautydocs/catalog/skinoe-phlora-lifestyle.jpg",
                "SKINOE PHLORA SERUM — butelka serum prezentowana w dłoni",
                label="Produkt w użyciu",
                fit="cover",
            ),
            _product_image(
                "/beautydocs/catalog/skinoe-phlora-ingredients.png",
                "SKINOE PHLORA SERUM — składniki aktywne i ich rola w pielęgnacji",
                label="Składniki aktywne",
                fit="cover",
            ),
        ),
        offers=(_price_offer("SKINOE", 209.0, SKINOE_PHLORA_URL),),
        source_url=SKINOE_PHLORA_URL,
    ),
    _comparison_product(
        "professional-cosmetic:skinoe-lac-gel",
        CatalogItemKind.COSMETIC,
        "SKINOE LAC GEL",
        "SKINOE",
        "Delikatny żel do codziennego oczyszczania skóry. Formuła z aloesem, "
        "ekstraktem z reishi, beta-glukanem i kwasem laktobionowym została opisana "
        "przez markę jako skuteczna, a jednocześnie łagodna dla bariery.",
        presentation="Butelka z pompką • 150 ml",
        product_category="Kosmetyk",
        product_family="Żel do mycia twarzy",
        manufacturer_uses=(
            "Codzienne oczyszczanie skóry rano i wieczorem",
            "Usuwanie zanieczyszczeń z poszanowaniem bariery ochronnej",
            "Wsparcie komfortu i nawilżenia podczas oczyszczania",
        ),
        treatment_categories=(
            "Oczyszczanie",
            "Skóra wrażliwa i naczyniowa",
            "Regeneracja bariery skórnej",
            "Pielęgnacja twarzy",
        ),
        application_areas=(_application_area("FACE", "Skóra twarzy"),),
        key_ingredients=(
            "Sok z liści aloesu",
            "Ekstrakt z reishi",
            "Beta-glukan",
            "Kwas laktobionowy",
            "Pantenol",
        ),
        aliases=("lac gel", "lacgel", "skinoe zel myjacy"),
        image_path="/beautydocs/catalog/skinoe-lac-gel-pack.jpg",
        image_alt="SKINOE LAC GEL 150 ml — butelka żelu z pompką",
        brand_logo_path="/beautydocs/catalog/skinoe-logo-filter.png",
        additional_images=(
            _product_image(
                "/beautydocs/catalog/skinoe-lac-gel-ingredients.png",
                "SKINOE LAC GEL — składniki aktywne i ich rola w pielęgnacji",
                label="Składniki aktywne",
                fit="cover",
            ),
            _product_image(
                "/beautydocs/catalog/skinoe-line-bag.jpg",
                "Linia kosmetyków SKINOE — cztery produkty w transparentnej torbie",
                label="Linia SKINOE",
                fit="cover",
            ),
        ),
        offers=(_price_offer("SKINOE", 109.0, SKINOE_LAC_GEL_URL),),
        source_url=SKINOE_LAC_GEL_URL,
    ),
    _comparison_product(
        "professional-product:liquid-anesthetic-15ml-pmu-brows",
        CatalogItemKind.TREATMENT_SUBSTANCE,
        "Painrelief 15 ml — znieczulenie do makijażu permanentnego brwi",
        "Painrelief",
        "Płyn oferowany do zastosowania podczas makijażu permanentnego brwi. Przed "
        "użyciem należy bezwzględnie sprawdzić pełny skład, status i instrukcję.",
        presentation="Butelka • 15 ml",
        product_category="Preparat profesjonalny — status do weryfikacji",
        product_family="Płyn miejscowo znieczulający",
        manufacturer_uses=("Makijaż permanentny brwi zgodnie z instrukcją produktu",),
        treatment_categories=("Makijaż permanentny brwi", "Znieczulenie miejscowe"),
        application_areas=(_application_area("BROWS", "Brwi"),),
        aliases=(
            "pain relief",
            "painrelief",
            "znieczulenie w plynie 15 ml",
            "liquid anesthetic pmu",
        ),
        image_path="/beautydocs/catalog/liquid-anesthetic-clinic.webp",
        image_alt="Painrelief — płyn miejscowo znieczulający do PMU, butelka 15 ml",
        additional_images=(
            _product_image(
                "/beautydocs/catalog/liquid-anesthetic-hand.webp",
                "Płyn miejscowo znieczulający do PMU — butelka w dłoni",
                label="Produkt",
                fit="cover",
            ),
            _product_image(
                "/beautydocs/catalog/liquid-anesthetic-lifestyle.webp",
                "Płyn miejscowo znieczulający do PMU — ujęcie lifestyle",
                label="Ujęcie produktu",
                fit="cover",
            ),
        ),
        offers=(_price_offer("Shopia", 170.0, SHOPIA_STORE_URL),),
        comparison_status="REGULATORY_CHECK",
        professional_only=True,
    ),
)


def _load_healthlabs_catalog_items() -> tuple[CatalogSearchItem, ...]:
    """Load the reviewed, server-owned Health Labs Care catalogue snapshot."""

    payload = json.loads(HEALTHLABS_SNAPSHOT_PATH.read_text(encoding="utf-8"))
    products = payload.get("products", [])
    if (
        payload.get("source") != HEALTHLABS_COSMETICS_URL
        or payload.get("count") != 69
        or not isinstance(products, list)
    ):
        raise RuntimeError("Nieprawidłowy snapshot katalogu Health Labs Care")

    items: list[CatalogSearchItem] = []
    for product in products:
        if not isinstance(product, dict):
            raise RuntimeError("Nieprawidłowy produkt w snapshocie Health Labs Care")
        offer = product.get("offer")
        offers = (offer,) if isinstance(offer, dict) else ()
        items.append(
            _comparison_product(
                f"professional-cosmetic:healthlabs-{product['slug']}",
                CatalogItemKind.COSMETIC,
                str(product["name"]),
                "Health Labs Care",
                str(product["summary"]),
                presentation=str(product["presentation"]),
                product_category=str(product["productCategory"]),
                product_family=str(product["productFamily"]),
                manufacturer_uses=tuple(str(value) for value in product["manufacturerUses"]),
                treatment_categories=tuple(str(value) for value in product["treatmentCategories"]),
                application_areas=tuple(
                    {
                        "code": str(area["code"]),
                        "label": str(area["label"]),
                    }
                    for area in product["applicationAreas"]
                    if isinstance(area, dict)
                ),
                key_ingredients=tuple(str(value) for value in product["keyIngredients"]),
                aliases=tuple(str(value) for value in product["aliases"]),
                offers=offers,
                source_url=str(product["sourceUrl"]),
                image_path=str(product["imagePath"]),
                image_alt=str(product["imageAlt"]),
                image_note=(
                    "Oficjalne zdjęcie produktu pobrane z publicznej karty "
                    "Health Labs Care podczas weryfikacji katalogu."
                ),
                image_fit="cover",
                usage_notice=(
                    "Sposób użycia, pełny skład INCI i środki ostrożności sprawdź "
                    "na aktualnej etykiecie oraz w oficjalnej karcie Health Labs Care."
                ),
            )
        )
    return tuple(items)


def _load_dmcell_catalog_items() -> tuple[CatalogSearchItem, ...]:
    """Load the reviewed official DM.Cell catalogue and Polish quote workflow."""

    payload = json.loads(DMCELL_SNAPSHOT_PATH.read_text(encoding="utf-8"))
    products = payload.get("products", [])
    if (
        payload.get("source") != DMCELL_CATALOG_URL
        or payload.get("polishDistributor") != DMCELL_POLISH_URL
        or payload.get("count") != 63
        or not isinstance(products, list)
    ):
        raise RuntimeError("Nieprawidłowy snapshot katalogu DM.Cell")

    items: list[CatalogSearchItem] = []
    for product in products:
        if not isinstance(product, dict):
            raise RuntimeError("Nieprawidłowy produkt w snapshocie DM.Cell")
        additional_images = tuple(
            {
                "path": str(image["path"]),
                "alt": str(image["alt"]),
                "label": str(image["label"]),
                "fit": str(image.get("fit") or "cover"),
            }
            for image in product.get("additionalImages", [])
            if isinstance(image, dict)
        )
        quote_notice = (
            "Polski dystrybutor DM.Cell nie publikuje obecnie detalicznego cennika PLN. "
            "Cena, wariant, dostępność, szkolenie i warunki profesjonalnego użycia "
            "wymagają potwierdzenia bezpośrednio u dystrybutora."
        )
        item = _comparison_product(
            f"professional-cosmetic:dmcell-{product['slug']}",
            CatalogItemKind.COSMETIC,
            str(product["name"]),
            "DM.Cell",
            str(product["summary"]),
            presentation=str(product["presentation"]),
            product_category=str(product["productCategory"]),
            product_family=str(product["productFamily"]),
            manufacturer_uses=tuple(str(value) for value in product["manufacturerUses"]),
            treatment_categories=tuple(str(value) for value in product["treatmentCategories"]),
            application_areas=tuple(
                {
                    "code": str(area["code"]),
                    "label": str(area["label"]),
                }
                for area in product["applicationAreas"]
                if isinstance(area, dict)
            ),
            key_ingredients=tuple(str(value) for value in product["keyIngredients"]),
            aliases=tuple(str(value) for value in product["aliases"]),
            offers=(),
            source_url=str(product["sourceUrl"]),
            comparison_status="REQUEST_QUOTE",
            comparison_notice=quote_notice,
            professional_only=bool(product["professionalOnly"]),
            image_path=str(product["imagePath"]),
            image_alt=str(product["imageAlt"]),
            image_note=("Oficjalne zdjęcie pobrane z publicznej karty producenta DM.Cell."),
            image_fit="cover",
            additional_images=additional_images,
            usage_notice=(
                "Sposób użycia, pełny skład INCI, ograniczenia profesjonalne i środki "
                "ostrożności sprawdź w aktualnej etykiecie oraz protokole DM.Cell."
            ),
        )
        item.details["priceComparison"]["quoteUrl"] = str(product["quoteUrl"])
        reference_price = product.get("officialReferencePrice")
        if isinstance(reference_price, dict):
            item.details["officialReferencePrice"] = reference_price
        item.details["sourceLine"] = str(product["sourceLine"])
        item.details["sourceDocuments"] = [
            _source_document(
                "DM.Cell — oficjalna karta produktu",
                str(product["sourceUrl"]),
                "Nazwa, wariant, zdjęcia oraz międzynarodowa cena referencyjna",
            ),
            _source_document(
                "DM.Cell Polska — wyłączny dystrybutor",
                str(product["quoteUrl"]),
                "Kontakt w sprawie aktualnej dostępności i ceny w Polsce",
            ),
        ]
        items.append(item)
    return tuple(items)


def _load_makeup_catalog_items() -> tuple[CatalogSearchItem, ...]:
    """Load the reviewed starter set of visible MAKEUP face-care listings."""

    payload = json.loads(MAKEUP_SNAPSHOT_PATH.read_text(encoding="utf-8"))
    products = payload.get("products", [])
    if (
        payload.get("source") != MAKEUP_FACE_CARE_URL
        or payload.get("count") != 20
        or not isinstance(products, list)
    ):
        raise RuntimeError("Nieprawidłowy snapshot katalogu MAKEUP")

    items: list[CatalogSearchItem] = []
    for product in products:
        if not isinstance(product, dict):
            raise RuntimeError("Nieprawidłowy produkt w snapshocie MAKEUP")
        offer = product.get("offer")
        if not isinstance(offer, dict):
            raise RuntimeError("Brak oferty w snapshocie MAKEUP")
        additional_images = tuple(
            {
                "path": str(image["path"]),
                "alt": str(image["alt"]),
                "label": str(image["label"]),
                "fit": str(image.get("fit") or "cover"),
            }
            for image in product.get("additionalImages", [])
            if isinstance(image, dict)
        )
        item = _comparison_product(
            f"professional-cosmetic:makeup-{product['slug']}",
            CatalogItemKind.COSMETIC,
            str(product["name"]),
            str(product["brand"]),
            str(product["summary"]),
            presentation=str(product["presentation"]),
            product_category=str(product["productCategory"]),
            product_family=str(product["productFamily"]),
            manufacturer_uses=tuple(str(value) for value in product["manufacturerUses"]),
            treatment_categories=tuple(str(value) for value in product["treatmentCategories"]),
            application_areas=tuple(
                {
                    "code": str(area["code"]),
                    "label": str(area["label"]),
                }
                for area in product["applicationAreas"]
                if isinstance(area, dict)
            ),
            key_ingredients=tuple(str(value) for value in product["keyIngredients"]),
            aliases=tuple(str(value) for value in product["aliases"]),
            offers=(offer,),
            source_url=str(product["sourceUrl"]),
            image_path=str(product["imagePath"]),
            image_alt=str(product["imageAlt"]),
            image_note=(
                "Zdjęcie pobrane z publicznej oferty MAKEUP podczas weryfikacji wariantu i ceny."
            ),
            image_fit="cover",
            additional_images=additional_images,
            usage_notice=(
                "Pełny skład INCI, sposób użycia i środki ostrożności sprawdź na "
                "aktualnej etykiecie oraz w ofercie produktu."
            ),
        )
        item.details["skinTypes"] = [str(value) for value in product["skinTypes"]]
        items.append(item)
    return tuple(items)


def _load_luvee_catalog_items() -> tuple[CatalogSearchItem, ...]:
    """Load the complete public LUVEE shop snapshot."""

    payload = json.loads(LUVEE_SNAPSHOT_PATH.read_text(encoding="utf-8"))
    products = payload.get("products", [])
    if (
        payload.get("source") != LUVEE_CATALOG_URL
        or payload.get("count") != 1
        or not isinstance(products, list)
    ):
        raise RuntimeError("Nieprawidłowy snapshot katalogu LUVEE")

    items: list[CatalogSearchItem] = []
    for product in products:
        if not isinstance(product, dict):
            raise RuntimeError("Nieprawidłowy produkt w snapshocie LUVEE")
        offer = product.get("offer")
        if not isinstance(offer, dict):
            raise RuntimeError("Brak oferty w snapshocie LUVEE")
        additional_images = tuple(
            {
                "path": str(image["path"]),
                "alt": str(image["alt"]),
                "label": str(image["label"]),
                "fit": str(image.get("fit") or "cover"),
            }
            for image in product.get("additionalImages", [])
            if isinstance(image, dict)
        )
        item = _comparison_product(
            f"professional-cosmetic:luvee-{product['slug']}",
            CatalogItemKind.COSMETIC,
            str(product["name"]),
            str(product["brand"]),
            str(product["summary"]),
            presentation=str(product["presentation"]),
            product_category=str(product["productCategory"]),
            product_family=str(product["productFamily"]),
            manufacturer_uses=tuple(str(value) for value in product["manufacturerUses"]),
            treatment_categories=tuple(str(value) for value in product["treatmentCategories"]),
            application_areas=tuple(
                {
                    "code": str(area["code"]),
                    "label": str(area["label"]),
                }
                for area in product["applicationAreas"]
                if isinstance(area, dict)
            ),
            key_ingredients=tuple(str(value) for value in product["keyIngredients"]),
            aliases=tuple(str(value) for value in product["aliases"]),
            offers=(offer,),
            source_url=str(product["sourceUrl"]),
            image_path=str(product["imagePath"]),
            image_alt=str(product["imageAlt"]),
            image_note=(
                "Oficjalne zdjęcie pobrane z publicznej karty produktu LUVEE podczas "
                "weryfikacji wariantu, dostępności i ceny."
            ),
            image_fit="cover",
            additional_images=additional_images,
            usage_notice=(
                "Rozpylaj zgodnie z aktualną etykietą produktu. Nie zastępuje to "
                "zaleceń pozabiegowych ani kwalifikacji specjalisty."
            ),
        )
        item.details["skinTypes"] = [str(value) for value in product["skinTypes"]]
        items.append(item)
    return tuple(items)


def _load_sensum_mare_catalog_items() -> tuple[CatalogSearchItem, ...]:
    """Load all visible variants from the official Sensum Mare catalogue."""

    payload = json.loads(SENSUM_MARE_SNAPSHOT_PATH.read_text(encoding="utf-8"))
    products = payload.get("products", [])
    if (
        payload.get("source") != SENSUM_MARE_CATALOG_URL
        or payload.get("count") != 96
        or not isinstance(products, list)
    ):
        raise RuntimeError("Nieprawidłowy snapshot katalogu Sensum Mare")

    items: list[CatalogSearchItem] = []
    for product in products:
        if not isinstance(product, dict):
            raise RuntimeError("Nieprawidłowy produkt w snapshocie Sensum Mare")
        offer = product.get("offer")
        if not isinstance(offer, dict):
            raise RuntimeError("Brak oferty w snapshocie Sensum Mare")
        item = _comparison_product(
            f"professional-cosmetic:sensum-mare-{product['slug']}",
            CatalogItemKind.COSMETIC,
            str(product["name"]),
            str(product["brand"]),
            str(product["summary"]),
            presentation=str(product["presentation"]),
            product_category=str(product["productCategory"]),
            product_family=str(product["productFamily"]),
            manufacturer_uses=tuple(str(value) for value in product["manufacturerUses"]),
            treatment_categories=tuple(str(value) for value in product["treatmentCategories"]),
            application_areas=tuple(
                {
                    "code": str(area["code"]),
                    "label": str(area["label"]),
                }
                for area in product["applicationAreas"]
                if isinstance(area, dict)
            ),
            key_ingredients=tuple(str(value) for value in product["keyIngredients"]),
            aliases=tuple(str(value) for value in product["aliases"]),
            offers=(offer,),
            source_url=str(product["sourceUrl"]),
            image_path=str(product["imagePath"]),
            image_alt=str(product["imageAlt"]),
            image_note=(
                "Oficjalne zdjęcie pobrane z publicznej karty produktu Sensum Mare "
                "podczas weryfikacji wariantu, dostępności i ceny."
            ),
            image_fit="cover",
            usage_notice=(
                "Pełny skład INCI, sposób użycia i środki ostrożności sprawdź na "
                "aktualnej etykiecie oraz w oficjalnej karcie produktu Sensum Mare."
            ),
        )
        item.details["skinTypes"] = [str(value) for value in product["skinTypes"]]
        item.details["sourceLine"] = str(product["series"])
        item.details["lastReviewedAt"] = str(payload["reviewedAt"])
        item.details["priceComparison"]["updatedAt"] = str(payload["reviewedAt"])
        items.append(item)
    return tuple(items)


def _load_gigi_poland_catalog_items() -> tuple[CatalogSearchItem, ...]:
    """Load the complete public GIGI Poland range without inventing hidden prices."""

    payload = json.loads(GIGI_POLAND_SNAPSHOT_PATH.read_text(encoding="utf-8"))
    products = payload.get("products", [])
    if (
        payload.get("source") != GIGI_POLAND_CATALOG_URL
        or payload.get("count") != 145
        or not isinstance(products, list)
    ):
        raise RuntimeError("Nieprawidłowy snapshot katalogu GIGI Poland")

    items: list[CatalogSearchItem] = []
    for product in products:
        if not isinstance(product, dict):
            raise RuntimeError("Nieprawidłowy produkt w snapshocie GIGI Poland")
        quote_notice = (
            "GIGI Poland udostępnia ceny wyłącznie zalogowanym, zweryfikowanym "
            "profesjonalistom. Zaloguj się w oficjalnym sklepie, aby sprawdzić "
            "aktualną cenę, wariant i dostępność bez pośrednika."
        )
        item = _comparison_product(
            f"professional-cosmetic:gigi-{product['slug']}",
            CatalogItemKind.COSMETIC,
            str(product["name"]),
            "GIGI Laboratories",
            str(product["summary"]),
            presentation=str(product["presentation"]),
            product_category=str(product["productCategory"]),
            product_family=str(product["productFamily"]),
            manufacturer_uses=tuple(str(value) for value in product["manufacturerUses"]),
            treatment_categories=tuple(str(value) for value in product["treatmentCategories"]),
            application_areas=tuple(
                {"code": str(area["code"]), "label": str(area["label"])}
                for area in product["applicationAreas"]
                if isinstance(area, dict)
            ),
            key_ingredients=tuple(str(value) for value in product["keyIngredients"]),
            aliases=tuple(str(value) for value in product["aliases"]),
            offers=(),
            source_url=str(product["sourceUrl"]),
            comparison_status="REQUEST_QUOTE",
            comparison_notice=quote_notice,
            professional_only=bool(product["professionalOnly"]),
            image_path=str(product["imagePath"]),
            image_alt=str(product["imageAlt"]),
            image_note=("Oficjalne zdjęcie pobrane z publicznej karty produktu GIGI Poland."),
            image_fit="cover",
            usage_notice=(
                "Pełny skład, sposób użycia, status profesjonalny i protokół sprawdź "
                "w aktualnej karcie GIGI Poland po zalogowaniu."
            ),
        )
        item.details["skinTypes"] = [str(value) for value in product["skinTypes"]]
        item.details["sourceLine"] = str(product["series"])
        item.details["lastReviewedAt"] = str(payload["reviewedAt"])
        item.details["priceComparison"]["quoteUrl"] = str(product["sourceUrl"])
        items.append(item)
    return tuple(items)


def _load_instytutum_catalog_items() -> tuple[CatalogSearchItem, ...]:
    """Load the full official range and direct Polish store offers."""

    payload = json.loads(INSTYTUTUM_SNAPSHOT_PATH.read_text(encoding="utf-8"))
    products = payload.get("products", [])
    if (
        payload.get("source") != INSTYTUTUM_CATALOG_URL
        or payload.get("count") != 52
        or not isinstance(products, list)
    ):
        raise RuntimeError("Nieprawidłowy snapshot katalogu INSTYTUTUM")

    items: list[CatalogSearchItem] = []
    for product in products:
        if not isinstance(product, dict):
            raise RuntimeError("Nieprawidłowy produkt w snapshocie INSTYTUTUM")
        offers = product.get("offers")
        product_images = product.get("productImages")
        official_reference_price = product.get("officialReferencePrice")
        if (
            not isinstance(offers, list)
            or not isinstance(product_images, list)
            or not isinstance(official_reference_price, dict)
        ):
            raise RuntimeError("Niepełna karta produktu INSTYTUTUM")

        additional_images = tuple(
            {
                "path": str(image["path"]),
                "alt": str(image["alt"]),
                "label": str(image["label"]),
                "scale": float(image["scale"]),
                "fit": str(image["fit"]),
            }
            for image in product_images[1:]
            if isinstance(image, dict)
        )
        has_pln_offer = any(
            isinstance(offer, dict) and offer.get("availability") != "OUT_OF_STOCK"
            for offer in offers
        )
        comparison_notice = (
            "Ceny pochodzą bezpośrednio z publicznych kart polskich sklepów, nie "
            "z zewnętrznej porównywarki. Cena producenta w EUR jest pokazywana "
            "osobno i nie jest automatycznie przeliczana na złote."
            if has_pln_offer
            else (
                "Nie znaleźliśmy jeszcze aktywnej, bezpośredniej oferty polskiego "
                "sklepu. Pokazujemy aktualną cenę referencyjną producenta w EUR "
                "bez orientacyjnego przeliczania jej na złote."
            )
        )
        item = _comparison_product(
            f"professional-cosmetic:instytutum-{product['slug']}",
            (
                CatalogItemKind.DEVICE
                if product["productFamily"] == "Lodówka kosmetyczna"
                else CatalogItemKind.COSMETIC
            ),
            str(product["name"]),
            "INSTYTUTUM",
            str(product["summary"]),
            presentation=str(product["presentation"]),
            product_category=str(product["productCategory"]),
            product_family=str(product["productFamily"]),
            manufacturer_uses=tuple(str(value) for value in product["manufacturerUses"]),
            treatment_categories=tuple(str(value) for value in product["treatmentCategories"]),
            application_areas=tuple(
                {"code": str(area["code"]), "label": str(area["label"])}
                for area in product["applicationAreas"]
                if isinstance(area, dict)
            ),
            key_ingredients=tuple(str(value) for value in product["keyIngredients"]),
            aliases=tuple(str(value) for value in product["aliases"]),
            offers=tuple(offer for offer in offers if isinstance(offer, dict)),
            source_url=str(product["sourceUrl"]),
            comparison_status="ACTIVE",
            comparison_notice=comparison_notice,
            image_path=str(product["imagePath"]),
            image_alt=str(product["imageAlt"]),
            image_note=("Oficjalne zdjęcie pobrane z publicznej karty INSTYTUTUM."),
            image_fit="cover",
            additional_images=additional_images,
            usage_notice=(
                "Pełny skład INCI, sposób użycia i środki ostrożności sprawdź "
                "w aktualnej, oficjalnej karcie produktu INSTYTUTUM."
            ),
        )
        item.details["skinTypes"] = [str(value) for value in product["skinTypes"]]
        item.details["officialReferencePrice"] = {
            **official_reference_price,
        }
        item.details["lastReviewedAt"] = str(payload["reviewedAt"])
        item.details["priceComparison"]["updatedAt"] = str(payload["reviewedAt"])
        items.append(item)
    return tuple(items)


def _load_partner_brand_catalog_items() -> tuple[CatalogSearchItem, ...]:
    """Load direct cards from the additional official brand and store sources."""

    payload = json.loads(PARTNER_BRAND_SNAPSHOT_PATH.read_text(encoding="utf-8"))
    products = payload.get("products", [])
    if (
        not isinstance(products, list)
        or payload.get("count") != len(products)
        or len(products) < 400
        or not isinstance(payload.get("brandLogos"), dict)
    ):
        raise RuntimeError("Nieprawidłowy snapshot katalogu marek partnerskich")

    items: list[CatalogSearchItem] = []
    for product in products:
        if not isinstance(product, dict):
            raise RuntimeError("Nieprawidłowy produkt w katalogu marek partnerskich")
        offers = product.get("offers")
        product_images = product.get("productImages")
        application_areas = product.get("applicationAreas")
        if (
            not isinstance(offers, list)
            or not isinstance(product_images, list)
            or not product_images
            or not isinstance(application_areas, list)
        ):
            raise RuntimeError("Niepełna karta produktu marki partnerskiej")

        brand = str(product["brand"])
        brand_slug = re.sub(r"[^a-z0-9]+", "-", _normalized_filter_text((brand,))).strip("-")
        is_device = product.get("kind") == "DEVICE"
        external_prefix = "professional-device" if is_device else "professional-cosmetic"
        direct_offers = tuple(offer for offer in offers if isinstance(offer, dict))
        comparison_notice = (
            "Ceny pochodzą bezpośrednio z publicznych kart wskazanych sklepów "
            "lub producentów. BeautyDocs nie korzysta tu z Ceneo ani innej "
            "zewnętrznej porównywarki."
            if direct_offers
            else (
                "Dla tej karty nie znaleźliśmy obecnie aktywnej, bezpośredniej "
                "oferty w PLN. Pokazujemy produkt bez szacowania ceny i bez "
                "danych z zewnętrznych porównywarek."
            )
        )
        additional_images = tuple(
            {
                "path": str(image["path"]),
                "alt": str(image["alt"]),
                "label": str(image["label"]),
                "scale": float(image.get("scale", 1.0)),
                "fit": str(image.get("fit", "cover")),
            }
            for image in product_images[1:]
            if isinstance(image, dict)
        )
        item = _comparison_product(
            f"{external_prefix}:{brand_slug}-{product['slug']}",
            CatalogItemKind.DEVICE if is_device else CatalogItemKind.COSMETIC,
            str(product["name"]),
            brand,
            str(product["summary"]),
            presentation=str(product["presentation"]),
            product_category=str(product["productCategory"]),
            product_family=str(product["productFamily"]),
            manufacturer_uses=tuple(str(value) for value in product["manufacturerUses"]),
            treatment_categories=tuple(str(value) for value in product["treatmentCategories"]),
            application_areas=tuple(
                {"code": str(area["code"]), "label": str(area["label"])}
                for area in application_areas
                if isinstance(area, dict)
            ),
            key_ingredients=tuple(str(value) for value in product["keyIngredients"]),
            aliases=tuple(str(value) for value in product["aliases"] if str(value).strip()),
            offers=direct_offers,
            source_url=str(product["sourceUrl"]),
            comparison_status="ACTIVE" if direct_offers else "INFORMATION_ONLY",
            comparison_notice=comparison_notice,
            professional_only=bool(product["professionalOnly"]),
            image_path=str(product["imagePath"]),
            image_alt=str(product["imageAlt"]),
            image_note="Oficjalne zdjęcie z publicznej karty produktu.",
            image_fit="cover",
            brand_logo_path=BRAND_LOGO_PATHS.get(brand),
            additional_images=additional_images,
            source_label_override=(
                None if direct_offers else "Oficjalna karta produktu — bez aktywnej oferty cenowej"
            ),
            source_document_title=(None if direct_offers else "Oficjalna karta produktu"),
            source_document_description=(
                None
                if direct_offers
                else "Nazwa, wariant, opis i zdjęcia produktu; bez szacowania ceny"
            ),
            usage_notice=(
                "Pełny skład, sposób użycia, środki ostrożności i aktualny status "
                "profesjonalny sprawdź w źródłowej karcie produktu."
            ),
        )
        skin_types = product.get("skinTypes")
        if isinstance(skin_types, list):
            item.details["skinTypes"] = [str(value) for value in skin_types]
        series = product.get("series")
        if series:
            item.details["sourceLine"] = str(series)
        item.details["lastReviewedAt"] = str(payload["reviewedAt"])
        item.details["priceComparison"]["updatedAt"] = str(payload["reviewedAt"])
        items.append(item)
    return tuple(items)


def _catalog_product_key(brand: str, name: str) -> tuple[str, str]:
    """Return a conservative key for joining the same card across direct shops."""

    def normalize(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "-", _normalized_filter_text((value,))).strip("-")

    return normalize(brand), normalize(name)


def _stable_snapshot_external_id(prefix: str, slug: str) -> str:
    normalized_slug = re.sub(r"[^a-z0-9-]+", "-", slug.casefold()).strip("-")
    maximum_slug_length = 160 - len(prefix) - 1
    if len(normalized_slug) > maximum_slug_length:
        suffix = hashlib.sha1(normalized_slug.encode("utf-8")).hexdigest()[:8]
        normalized_slug = f"{normalized_slug[: maximum_slug_length - 9].rstrip('-')}-{suffix}"
    return f"{prefix}:{normalized_slug}"


def _merge_extended_snapshot_product(
    item: CatalogSearchItem,
    product: dict[str, Any],
    *,
    reviewed_at: str,
    brand_logo_path: str | None,
) -> None:
    offers = [offer for offer in product["offers"] if isinstance(offer, dict)]
    current_offers = item.details.setdefault("offers", [])
    known_offers = {
        (str(offer.get("seller")), str(offer.get("url")))
        for offer in current_offers
        if isinstance(offer, dict)
    }
    for offer in offers:
        key = (str(offer.get("seller")), str(offer.get("url")))
        if key not in known_offers:
            current_offers.append(offer)
            known_offers.add(key)

    current_images = item.details.setdefault("productImages", [])
    known_image_paths = {
        str(image.get("path")) for image in current_images if isinstance(image, dict)
    }
    for image in product["productImages"]:
        if isinstance(image, dict) and str(image.get("path")) not in known_image_paths:
            current_images.append(image)
            known_image_paths.add(str(image.get("path")))

    source_documents = item.details.setdefault("sourceDocuments", [])
    source_url = str(product["sourceUrl"])
    if not any(
        isinstance(document, dict) and document.get("url") == source_url
        for document in source_documents
    ):
        source_documents.append(
            _source_document(
                "Oficjalna karta produktu lub bezpośrednia oferta sklepu",
                source_url,
                "Nazwa, wariant, opis, zdjęcia oraz dostępna cena źródłowa",
            )
        )

    official_reference_price = product.get("officialReferencePrice")
    if isinstance(official_reference_price, dict):
        item.details.setdefault("officialReferencePrice", official_reference_price)

    price_comparison = item.details.setdefault("priceComparison", {})
    if offers:
        price_comparison.update(
            {
                "status": "ACTIVE",
                "updatedAt": reviewed_at,
                "notice": (
                    "Ceny pochodzą bezpośrednio z publicznych kart sklepów lub "
                    "producentów. BeautyDocs nie korzysta tu z Ceneo ani innej "
                    "zewnętrznej porównywarki."
                ),
            }
        )
    elif isinstance(official_reference_price, dict) and not current_offers:
        price_comparison.update(
            {
                "status": "ACTIVE",
                "updatedAt": reviewed_at,
                "notice": (
                    "Pokazujemy oficjalną cenę referencyjną producenta w walucie "
                    "źródłowej, bez automatycznego przeliczania jej na złote."
                ),
            }
        )

    if brand_logo_path and not item.details.get("brandLogoPath"):
        item.details["brandLogoPath"] = brand_logo_path
    skin_types = product.get("skinTypes")
    if isinstance(skin_types, list) and skin_types:
        item.details.setdefault("skinTypes", [str(value) for value in skin_types])
    if product.get("series"):
        item.details.setdefault("sourceLine", str(product["series"]))
    item.details["lastReviewedAt"] = reviewed_at


def _load_extended_brand_catalog_items(
    existing_items: Sequence[CatalogSearchItem],
) -> tuple[CatalogSearchItem, ...]:
    """Load and de-duplicate direct cards from the latest official sources."""

    payload = json.loads(EXTENDED_BRAND_SNAPSHOT_PATH.read_text(encoding="utf-8"))
    products = payload.get("products", [])
    brand_logos = payload.get("brandLogos", {})
    if (
        not isinstance(products, list)
        or payload.get("count") != len(products)
        or len(products) < 800
        or not isinstance(brand_logos, dict)
    ):
        raise RuntimeError("Nieprawidłowy rozszerzony snapshot katalogu marek")

    BRAND_LOGO_PATHS.update(
        {str(brand): str(path) for brand, path in brand_logos.items() if brand and path}
    )
    by_external_id = {item.external_id: item for item in existing_items}
    by_product_key = {
        _catalog_product_key(str(item.brand or ""), item.name): item
        for item in existing_items
        if item.brand and item.details.get("catalogProfile") == "PROFESSIONAL_PRODUCT"
    }
    items: list[CatalogSearchItem] = []
    reviewed_at = str(payload["reviewedAt"])

    for product in products:
        if not isinstance(product, dict):
            raise RuntimeError("Nieprawidłowy produkt w rozszerzonym katalogu marek")
        offers = product.get("offers")
        product_images = product.get("productImages")
        application_areas = product.get("applicationAreas")
        official_reference_price = product.get("officialReferencePrice")
        if (
            not isinstance(offers, list)
            or not isinstance(product_images, list)
            or not product_images
            or not isinstance(application_areas, list)
            or (
                official_reference_price is not None
                and not isinstance(official_reference_price, dict)
            )
        ):
            raise RuntimeError("Niepełna karta w rozszerzonym katalogu marek")

        brand = str(product["brand"])
        brand_logo_path = str(
            product.get("brandLogoPath") or BRAND_LOGO_PATHS.get(brand) or ""
        ) or None
        merge_external_id = product.get("mergeExternalId")
        existing_item = (
            by_external_id.get(str(merge_external_id)) if merge_external_id else None
        )
        product_key = _catalog_product_key(brand, str(product["name"]))
        if existing_item is None:
            existing_item = by_product_key.get(product_key)
        if existing_item is not None:
            _merge_extended_snapshot_product(
                existing_item,
                product,
                reviewed_at=reviewed_at,
                brand_logo_path=brand_logo_path,
            )
            continue

        raw_kind = str(product.get("kind") or "COSMETIC")
        if raw_kind == "DEVICE":
            kind = CatalogItemKind.DEVICE
            external_prefix = "professional-device"
        elif raw_kind == "PRODUCT":
            kind = CatalogItemKind.TREATMENT_SUBSTANCE
            external_prefix = "professional-product"
        else:
            kind = CatalogItemKind.COSMETIC
            external_prefix = "professional-cosmetic"

        direct_offers = tuple(offer for offer in offers if isinstance(offer, dict))
        has_reference_price = isinstance(official_reference_price, dict)
        comparison_status = (
            "ACTIVE" if direct_offers or has_reference_price else "INFORMATION_ONLY"
        )
        if direct_offers:
            comparison_notice = (
                "Ceny pochodzą bezpośrednio z publicznych kart wskazanych sklepów "
                "lub producentów. BeautyDocs nie korzysta tu z Ceneo ani innej "
                "zewnętrznej porównywarki."
            )
        elif has_reference_price:
            comparison_notice = (
                "Pokazujemy oficjalną cenę referencyjną producenta w walucie "
                "źródłowej, bez automatycznego przeliczania jej na złote."
            )
        else:
            comparison_notice = (
                "Nie znaleźliśmy aktywnej, bezpośredniej oferty. Pokazujemy kartę "
                "informacyjną bez szacowania ceny i bez danych z porównywarek."
            )

        additional_images = tuple(
            {
                "path": str(image["path"]),
                "alt": str(image["alt"]),
                "label": str(image["label"]),
                "scale": float(image.get("scale", 1.0)),
                "fit": str(image.get("fit", "cover")),
            }
            for image in product_images[1:]
            if isinstance(image, dict)
        )
        item = _comparison_product(
            _stable_snapshot_external_id(external_prefix, str(product["slug"])),
            kind,
            str(product["name"]),
            brand,
            str(product["summary"]),
            presentation=str(product["presentation"]),
            product_category=str(product["productCategory"]),
            product_family=str(product["productFamily"]),
            manufacturer_uses=tuple(str(value) for value in product["manufacturerUses"]),
            treatment_categories=tuple(
                str(value) for value in product["treatmentCategories"]
            ),
            application_areas=tuple(
                {"code": str(area["code"]), "label": str(area["label"])}
                for area in application_areas
                if isinstance(area, dict)
            ),
            key_ingredients=tuple(str(value) for value in product["keyIngredients"]),
            aliases=tuple(
                str(value) for value in product["aliases"] if str(value).strip()
            ),
            offers=direct_offers,
            source_url=str(product["sourceUrl"]),
            comparison_status=comparison_status,
            comparison_notice=comparison_notice,
            professional_only=bool(product["professionalOnly"]),
            image_path=str(product["imagePath"]),
            image_alt=str(product["imageAlt"]),
            image_note="Oficjalne zdjęcie z publicznej karty produktu.",
            image_fit="cover",
            brand_logo_path=brand_logo_path,
            additional_images=additional_images,
            source_label_override=(
                "Oficjalna cena producenta — bez przeliczenia waluty"
                if has_reference_price and not direct_offers
                else (
                    "Oficjalna karta produktu — bez aktywnej oferty cenowej"
                    if not direct_offers
                    else None
                )
            ),
            source_document_title=(
                "Oficjalna karta produktu"
                if not direct_offers
                else "Bezpośrednia oferta sklepu lub producenta"
            ),
            source_document_description=(
                "Nazwa, wariant, opis i zdjęcia; bez szacowania ceny"
                if not direct_offers and not has_reference_price
                else "Nazwa, wariant, zdjęcia oraz cena w walucie źródłowej"
            ),
            usage_notice=(
                "Pełny skład, sposób użycia, środki ostrożności i status produktu "
                "sprawdź w aktualnej karcie źródłowej."
            ),
        )
        if isinstance(product.get("skinTypes"), list):
            item.details["skinTypes"] = [str(value) for value in product["skinTypes"]]
        if product.get("series"):
            item.details["sourceLine"] = str(product["series"])
        if has_reference_price:
            item.details["officialReferencePrice"] = {**official_reference_price}
        item.details["lastReviewedAt"] = reviewed_at
        item.details["priceComparison"]["updatedAt"] = reviewed_at
        items.append(item)
        by_external_id[item.external_id] = item
        by_product_key[product_key] = item

    return tuple(items)


CURATED_ITEMS = (
    *CURATED_ITEMS,
    *_load_healthlabs_catalog_items(),
    *_load_dmcell_catalog_items(),
    *_load_makeup_catalog_items(),
    *_load_luvee_catalog_items(),
    *_load_sensum_mare_catalog_items(),
    *_load_gigi_poland_catalog_items(),
    *_load_instytutum_catalog_items(),
    *_load_partner_brand_catalog_items(),
)

CURATED_ITEMS = (
    *CURATED_ITEMS,
    *_load_extended_brand_catalog_items(CURATED_ITEMS),
)

_rpl_cache: dict[str, tuple[float, list[CatalogSearchItem]]] = {}


def public_catalog_product_slug(item: CatalogSearchItem) -> str | None:
    if item.details.get("catalogProfile") != "PROFESSIONAL_PRODUCT":
        return None
    for prefix in PROFESSIONAL_CATALOG_PREFIXES:
        if item.external_id.startswith(prefix):
            slug = item.external_id.removeprefix(prefix)
            return slug if PUBLIC_PRODUCT_SLUG_PATTERN.fullmatch(slug) else None
    return None


def list_public_catalog_products() -> list[CatalogSearchItem]:
    return [item for item in CURATED_ITEMS if public_catalog_product_slug(item) is not None]


def get_public_catalog_product(slug: str) -> CatalogSearchItem | None:
    if not PUBLIC_PRODUCT_SLUG_PATTERN.fullmatch(slug):
        return None
    return next(
        (
            item
            for item in list_public_catalog_products()
            if public_catalog_product_slug(item) == slug
        ),
        None,
    )


def normalize_catalog_search(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold()).replace("ł", "l")
    return " ".join(
        "".join(character for character in part if not unicodedata.combining(character))
        for part in normalized.split()
    )


def search_curated_catalog(
    query: str,
    *,
    kind: CatalogItemKind | None = None,
) -> list[CatalogSearchItem]:
    phrase = normalize_catalog_search(query)
    matches: list[CatalogSearchItem] = []
    for item in CURATED_ITEMS:
        if kind is not None and item.kind != kind.value:
            continue
        aliases = item.details.get("aliases", [])
        search_terms = item.details.get("searchTerms", [])
        haystack = normalize_catalog_search(
            " ".join(
                [
                    item.name,
                    item.brand or "",
                    item.summary,
                    *(str(value) for value in aliases),
                    *(str(value) for value in search_terms),
                ]
            )
        )
        if phrase and phrase not in haystack:
            continue
        matches.append(item)
    return matches


async def search_catalog(
    query: str,
    *,
    kind: CatalogItemKind | None = None,
    limit: int = 24,
    session: AsyncSession | None = None,
) -> CatalogSearchResult:
    curated = search_curated_catalog(query, kind=kind)
    should_search_rpl = len(query.strip()) >= 2 and kind in {None, CatalogItemKind.MEDICINE}
    medicines: list[CatalogSearchItem] = []
    rpl_available = True
    if should_search_rpl:
        safety_rules: Sequence[SafetyRuleSnapshot] | None = None
        local_available = False
        if session is not None:
            safety_rules = await load_safety_rules(session)
            medicines, local_available = await _search_local_rpl(
                session,
                query.strip(),
                limit=min(limit, 30),
                safety_rules=safety_rules,
            )
        if not local_available:
            medicines, rpl_available = await _search_rpl(
                query.strip(),
                limit=min(limit, 20),
                safety_rules=safety_rules,
            )
    items = [*medicines, *curated]
    return CatalogSearchResult(items=items[:limit], rpl_available=rpl_available)


async def resolve_catalog_snapshot(
    source: CatalogItemSource,
    external_id: str,
    name: str,
    session: AsyncSession | None = None,
) -> tuple[CatalogSearchItem | None, bool]:
    """Resolve facts server-side so a client cannot forge an official source."""

    if source == CatalogItemSource.BEAUTYDOCS:
        item = next(
            (candidate for candidate in CURATED_ITEMS if candidate.external_id == external_id),
            None,
        )
        return item, True
    if source != CatalogItemSource.RPL:
        return None, True

    result = await search_catalog(
        name,
        kind=CatalogItemKind.MEDICINE,
        limit=50,
        session=session,
    )
    return (
        next(
            (candidate for candidate in result.items if candidate.external_id == external_id),
            None,
        ),
        result.rpl_available,
    )


async def _search_rpl(
    query: str,
    *,
    limit: int,
    safety_rules: Sequence[SafetyRuleSnapshot] | None = None,
) -> tuple[list[CatalogSearchItem], bool]:
    cache_key = f"{normalize_catalog_search(query)}:{limit}"
    cached = _rpl_cache.get(cache_key)
    if cached is not None and monotonic() - cached[0] < RPL_CACHE_SECONDS:
        return list(cached[1]), True

    params: dict[str, str | int] = {
        "page": 0,
        "size": limit,
        "sort": "name,ASC",
    }
    timeout = httpx.Timeout(4.5, connect=2.0)
    try:
        async with httpx.AsyncClient(
            base_url=RPL_API_BASE,
            timeout=timeout,
            follow_redirects=False,
            headers={"Accept": "application/json", "User-Agent": "BeautyDocs/1.0"},
        ) as client:
            results = await asyncio.gather(
                client.get(
                    "/medicinal-products/search/public",
                    params={**params, "name": query},
                ),
                client.get(
                    "/medicinal-products/search/public",
                    params={**params, "commonName": query},
                ),
                return_exceptions=True,
            )
    except httpx.HTTPError:
        return [], False

    merged: dict[str, CatalogSearchItem] = {}
    any_available = False
    for response in results:
        if isinstance(response, BaseException) or response.status_code != 200:
            continue
        any_available = True
        try:
            payload = response.json()
        except ValueError:
            continue
        content = payload.get("content") if isinstance(payload, dict) else None
        if not isinstance(content, list):
            continue
        for raw in content:
            item = _rpl_item(raw, safety_rules=safety_rules)
            if item is not None:
                merged[item.external_id] = item

    items = sorted(merged.values(), key=lambda item: item.name.casefold())[:limit]
    if any_available:
        if len(_rpl_cache) >= RPL_CACHE_MAX_ITEMS:
            oldest_key = min(_rpl_cache, key=lambda key: _rpl_cache[key][0])
            _rpl_cache.pop(oldest_key, None)
        _rpl_cache[cache_key] = (monotonic(), items)
    return items, any_available


def _rpl_item(
    value: object,
    *,
    safety_rules: Sequence[SafetyRuleSnapshot] | None = None,
) -> CatalogSearchItem | None:
    if not isinstance(value, dict) or value.get("specimenType") != "Ludzki":
        return None
    product_id = value.get("id")
    name = value.get("medicinalProductName")
    if not isinstance(product_id, int) or not isinstance(name, str) or not name.strip():
        return None
    common_name = _optional_text(value.get("commonName"), 500)
    active_substance = _optional_text(value.get("activeSubstanceName"), 1_000)
    form = _optional_text(value.get("pharmaceuticalFormName"), 300)
    strength = _optional_text(value.get("medicinalProductPower"), 300)
    holder = _optional_text(value.get("subjectMedicinalProductName"), 300)
    characteristic_url = f"{RPL_API_BASE}/medicinal-products/{product_id}/characteristic"
    return CatalogSearchItem(
        external_id=f"rpl:{product_id}",
        kind=CatalogItemKind.MEDICINE.value,
        source=CatalogItemSource.RPL.value,
        name=name.strip()[:250],
        brand=holder,
        summary=" · ".join(part for part in (active_substance, strength, form) if part),
        details={
            "rplId": product_id,
            "commonName": common_name,
            "activeSubstance": active_substance,
            "pharmaceuticalForm": form,
            "strength": strength,
            "marketingAuthorisationHolder": holder,
            "registryNumber": _optional_text(value.get("registryNumber"), 100),
            "atcCode": _optional_text(value.get("atcCode"), 100),
            "characteristicUrl": characteristic_url,
            "leafletUrl": f"{RPL_API_BASE}/medicinal-products/{product_id}/leaflet",
            "verification": "OFFICIAL_REGISTRY",
            "safetyAssessment": medicine_safety_assessment(
                active_substance=active_substance,
                pharmaceutical_form=form,
                characteristic_url=characteristic_url,
                safety_rules=safety_rules,
            ),
        },
        source_label="Rejestr Produktów Leczniczych (CeZ)",
        source_url=RPL_PUBLIC_URL,
    )


def medicine_safety_assessment(
    *,
    active_substance: str | None,
    pharmaceutical_form: str | None,
    characteristic_url: str,
    safety_rules: Sequence[SafetyRuleSnapshot] | None = None,
) -> dict[str, Any]:
    """Return conservative, source-backed flags rather than treatment clearance.

    The RPL search response contains registry facts, but it does not expose a
    ready-made beauty-treatment safety classification. Therefore an unknown
    medicine always requires verification. A red flag is only emitted for a
    narrowly scoped rule backed by an official regulator source.
    """

    substance = normalize_catalog_search(active_substance or "")
    product_form = normalize_catalog_search(pharmaceutical_form or "")
    rules = BUILTIN_SAFETY_RULES if safety_rules is None else safety_rules
    matched_rule = next(
        (
            rule
            for rule in rules
            if any(
                re.search(
                    rf"(?:^|[^a-z0-9]){re.escape(normalize_catalog_search(name))}"
                    r"(?:$|[^a-z0-9])",
                    substance,
                )
                for name in rule.substance_names
            )
            and any(
                normalize_catalog_search(term) in product_form
                for term in rule.pharmaceutical_form_terms
            )
        ),
        None,
    )
    if matched_rule is not None:
        return {
            "status": matched_rule.status,
            "label": matched_rule.label,
            "summary": matched_rule.summary,
            "flags": list(matched_rule.flags),
            "relevantTreatmentFamilies": list(matched_rule.treatment_families),
            "evidenceLabel": matched_rule.evidence_label,
            "evidenceUrl": matched_rule.evidence_url,
            "requiresProfessionalReview": True,
        }
    return {
        "status": "VERIFY",
        "label": "Wymaga weryfikacji",
        "summary": (
            "Nie znaleziono automatycznej, źródłowej klasyfikacji dla tego "
            "produktu. Przed zabiegiem sprawdź aktualną ChPL i oceń sytuację "
            "klientki indywidualnie."
        ),
        "flags": [],
        "relevantTreatmentFamilies": [],
        "evidenceLabel": "Charakterystyka Produktu Leczniczego (RPL)",
        "evidenceUrl": characteristic_url,
        "requiresProfessionalReview": True,
    }


async def _search_local_rpl(
    session: AsyncSession,
    query: str,
    *,
    limit: int,
    safety_rules: Sequence[SafetyRuleSnapshot],
) -> tuple[list[CatalogSearchItem], bool]:
    available = await session.scalar(
        select(MedicineProduct.rpl_id).where(MedicineProduct.is_active.is_(True)).limit(1)
    )
    if available is None:
        return [], False
    phrase = normalize_catalog_search(query)
    products = (
        await session.scalars(
            select(MedicineProduct)
            .where(
                MedicineProduct.is_active.is_(True),
                MedicineProduct.search_text.contains(phrase),
            )
            .order_by(MedicineProduct.name)
            .limit(limit)
        )
    ).all()
    return [
        _medicine_product_item(product, safety_rules=safety_rules) for product in products
    ], True


async def list_medicine_catalog_page(
    session: AsyncSession,
    *,
    query: str = "",
    page: int = 1,
    page_size: int = 30,
) -> MedicineCatalogPage:
    """Browse the complete local RPL mirror without loading it all at once."""

    available = await session.scalar(
        select(MedicineProduct.rpl_id).where(MedicineProduct.is_active.is_(True)).limit(1)
    )
    if available is None:
        return MedicineCatalogPage(
            items=[],
            total=0,
            page=page,
            page_size=page_size,
            rpl_available=False,
        )

    filters = [MedicineProduct.is_active.is_(True)]
    phrase = normalize_catalog_search(query)
    if phrase:
        filters.append(MedicineProduct.search_text.contains(phrase))

    total = int(
        await session.scalar(select(func.count()).select_from(MedicineProduct).where(*filters)) or 0
    )
    products = (
        await session.scalars(
            select(MedicineProduct)
            .where(*filters)
            .order_by(MedicineProduct.name, MedicineProduct.strength, MedicineProduct.rpl_id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    safety_rules = await load_safety_rules(session)
    return MedicineCatalogPage(
        items=[_medicine_product_item(product, safety_rules=safety_rules) for product in products],
        total=total,
        page=page,
        page_size=page_size,
        rpl_available=True,
    )


async def load_safety_rules(session: AsyncSession) -> tuple[SafetyRuleSnapshot, ...]:
    """Load the active, versioned safety rules used for current assessments."""

    rows = (
        await session.scalars(
            select(MedicineSafetyRule)
            .where(MedicineSafetyRule.is_active.is_(True))
            .order_by(MedicineSafetyRule.code)
        )
    ).all()
    return tuple(
        SafetyRuleSnapshot(
            substance_names=tuple(_string_list(row.substance_names)),
            pharmaceutical_form_terms=tuple(_string_list(row.pharmaceutical_form_terms)),
            status=row.status,
            label=row.label,
            summary=row.summary,
            flags=tuple(_string_list(row.flags)),
            treatment_families=tuple(_string_list(row.treatment_families)),
            evidence_label=row.evidence_label,
            evidence_url=row.evidence_url,
        )
        for row in rows
    )


def _medicine_product_item(
    product: MedicineProduct,
    *,
    safety_rules: Sequence[SafetyRuleSnapshot],
) -> CatalogSearchItem:
    characteristic_url = f"{RPL_API_BASE}/medicinal-products/{product.rpl_id}/characteristic"
    details = {
        **(product.source_payload if isinstance(product.source_payload, dict) else {}),
        "rplId": product.rpl_id,
        "commonName": product.common_name,
        "activeSubstance": product.active_substance,
        "pharmaceuticalForm": product.pharmaceutical_form,
        "strength": product.strength,
        "marketingAuthorisationHolder": product.marketing_authorisation_holder,
        "registryNumber": product.registry_number,
        "atcCode": product.atc_code,
        "characteristicUrl": characteristic_url,
        "leafletUrl": f"{RPL_API_BASE}/medicinal-products/{product.rpl_id}/leaflet",
        "verification": "OFFICIAL_REGISTRY_LOCAL_MIRROR",
        "safetyAssessment": medicine_safety_assessment(
            active_substance=product.active_substance,
            pharmaceutical_form=product.pharmaceutical_form,
            characteristic_url=characteristic_url,
            safety_rules=safety_rules,
        ),
    }
    return CatalogSearchItem(
        external_id=f"rpl:{product.rpl_id}",
        kind=CatalogItemKind.MEDICINE.value,
        source=CatalogItemSource.RPL.value,
        name=product.name,
        brand=product.marketing_authorisation_holder,
        summary=" · ".join(
            part
            for part in (
                product.active_substance,
                product.strength,
                product.pharmaceutical_form,
            )
            if part
        ),
        details=details,
        source_label="Rejestr Produktów Leczniczych (CeZ) — lokalna kopia",
        source_url=RPL_PUBLIC_URL,
    )


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def _optional_text(value: object, max_length: int) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text[:max_length] if text else None
