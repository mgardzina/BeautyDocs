"""Provision the BeautyDocs form-template catalogue from the legacy PowderBrows forms.

Idempotent. For each legacy treatment form it upserts a global ``form_templates``
row, ensures a published ``form_template_versions`` row carrying the real
per-treatment questionnaire (contraindications / wywiad medyczny extracted from
``types/booking.ts`` into ``form_catalog.json``) plus the shared consent/legal
blocks, and enables the template for the target tenant via
``tenant_form_templates``.

Because published versions are immutable (DB trigger), enriched content is added
as a new version when the content hash changes.

Regenerate the questionnaire catalogue first, then run this:

    npx tsx scripts/extract-forms.ts                 # writes apps/api/scripts/form_catalog.json
    cd apps/api
    uv run python scripts/provision_powderbrows_forms.py [tenant_slug | --catalog-only]
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any

import asyncpg

DEFAULT_DSN = "postgresql://beautydocs@127.0.0.1:5433/beautydocs"

# Real per-treatment questionnaire extracted from types/booking.ts.
_CATALOG_PATH = Path(__file__).parent / "form_catalog.json"
if not _CATALOG_PATH.exists():
    _CATALOG_PATH = Path("scripts/form_catalog.json")
QUESTIONNAIRE: dict[str, Any] = (
    json.loads(_CATALOG_PATH.read_text(encoding="utf-8")) if _CATALOG_PATH.exists() else {}
)

# code, legacy FormType, display name, subtitle/description (from SelectionScreen)
CATALOG: tuple[tuple[str, str, str, str], ...] = (
    ("modelowanie-ust", "LIP_AUGMENTATION", "Modelowanie Ust", "Kwas hialuronowy"),
    ("wolumetria-twarzy", "FACIAL_VOLUMETRY", "Wypełnianie Kwasem Hialuronowym", "Modelowanie twarzy"),
    ("mezoterapia-iglowa", "NEEDLE_MESOTHERAPY", "Mezoterapia igłowa", "Kwas polimlekowy, osocze"),
    ("lipoliza-iniekcyjna", "INJECTION_LIPOLYSIS", "Lipoliza Iniekcyjna", "Redukcja tkanki tłuszczowej"),
    ("makijaz-permanentny", "PERMANENT_MAKEUP", "Makijaż Permanentny", "Zabieg makijażowy"),
    ("depilacja-laserowa", "LASER_HAIR_REMOVAL", "Depilacja Laserowa", "Laser diodowy"),
    ("usuwanie-tatuazu", "LASER_TATTOO_REMOVAL", "Usuwanie Tatuażu", "Laser pikosekundowy"),
    ("niwelowanie-zmarszczek", "WRINKLE_REDUCTION", "Niwelowanie Zmarszczek", "Usuwanie zmarszczek"),
    ("lifting-powiek", "EYELID_LIFT", "Lifting Powiek", "Zabieg liftingowy"),
    ("stymulacja-tkankowa", "TISSUE_STIMULATION", "Stymulacja Tkankowa", "Zabieg liftingowy"),
    ("farbowanie-rzes-brwi", "EYEBROW_TINTING", "Farbowanie Rzęs i Brwi", "Henna / Farba"),
    ("przedluzanie-rzes", "EYELASH_EXTENSION", "Przedłużanie Rzęs", "1:1 / Objętościowe"),
    ("laminacja-rzes-brwi", "EYEBROW_LAMINATION", "Laminacja Rzęs i Brwi", "Laminacja / Lifting"),
    ("oczyszczanie-twarzy", "FACIAL_CLEANSING", "Oczyszczanie Twarzy", "Zabieg oczyszczający"),
)

# Real consent wording from the legacy forms; {{salonName}} is filled per tenant.
LEGAL_CONTENT: dict[str, Any] = {
    "locale": "pl-PL",
    "documentForm": "Art. 78¹ Kodeksu cywilnego (forma dokumentowa)",
    "consents": [
        {
            "key": "zgodaPrzetwarzanieDanych",
            "title": "Zgoda na przetwarzanie danych",
            "required": True,
            "text": (
                "Wyrażam zgodę na przetwarzanie moich danych osobowych przez {{salonName}} "
                "w celu wykonania zabiegu, kontaktu oraz prowadzenia dokumentacji zabiegowej, "
                "zgodnie z RODO."
            ),
        },
        {
            "key": "zgodaMarketing",
            "title": "Zgoda marketingowa",
            "required": False,
            "text": (
                "Wyrażam zgodę na otrzymywanie informacji o nowościach, promocjach i ofertach "
                "specjalnych od firmy {{salonName}} drogą elektroniczną (SMS / E-mail)."
            ),
        },
        {
            "key": "zgodaFotografie",
            "title": "Zgoda na wykorzystanie wizerunku",
            "required": False,
            "text": (
                "Wyrażam nieodpłatną zgodę na utrwalenie i rozpowszechnianie mojego wizerunku "
                "(zdjęcia/video efektów zabiegu) w celach promocyjnych salonu {{salonName}}."
            ),
        },
    ],
    # Documents attached to the signature fields in the "Podpisy" section.
    "documents": [
        {
            "key": "podpisDane",
            "title": "Zgoda na wykonanie zabiegu",
            "text": (
                "Oświadczam, że zapoznałam/em się z informacjami dotyczącymi zabiegu, jego "
                "przebiegiem, zaleceniami przed- i pozabiegowymi oraz możliwymi skutkami ubocznymi "
                "i powikłaniami.\n\n"
                "Podane przeze mnie informacje o stanie zdrowia, przyjmowanych lekach i "
                "przeciwwskazaniach są zgodne z prawdą. Zobowiązuję się do stosowania zaleceń "
                "pozabiegowych.\n\n"
                "Wyrażam świadomą i dobrowolną zgodę na wykonanie zabiegu w salonie {{salonName}} "
                "oraz na udokumentowanie jego przebiegu."
            ),
        },
        {
            "key": "podpisRodo",
            "title": "Klauzula informacyjna RODO",
            "text": (
                "Administratorem Twoich danych osobowych jest {{salonName}}. Dane przetwarzamy w "
                "celu wykonania zabiegu, prowadzenia dokumentacji zabiegowej oraz kontaktu — na "
                "podstawie Twojej zgody oraz obowiązków prawnych ciążących na administratorze.\n\n"
                "Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia lub ograniczenia "
                "przetwarzania, prawo do przenoszenia danych oraz wniesienia skargi do Prezesa "
                "Urzędu Ochrony Danych Osobowych (PUODO).\n\n"
                "Podanie danych jest dobrowolne, jednak niezbędne do bezpiecznego wykonania zabiegu "
                "i prowadzenia dokumentacji medycznej."
            ),
        },
    ],
}


# Treatment-area anatomy per form (drives the interactive face/body selector).
# model: "face" | "body" | "both"; faceZoneSet / bodyZoneSet name the ported
# zone geometry (pmu/face/tissue for face, body for body).
ANATOMY_BY_CODE: dict[str, dict[str, str]] = {
    "makijaz-permanentny": {"model": "face", "faceZoneSet": "pmu"},
    "wolumetria-twarzy": {"model": "face", "faceZoneSet": "face"},
    "niwelowanie-zmarszczek": {"model": "face", "faceZoneSet": "face"},
    "stymulacja-tkankowa": {"model": "face", "faceZoneSet": "tissue"},
    "depilacja-laserowa": {"model": "body", "bodyZoneSet": "body"},
    "usuwanie-tatuazu": {"model": "both", "faceZoneSet": "face", "bodyZoneSet": "body"},
}


def build_schema(code: str, form_type: str, name: str) -> dict[str, Any]:
    """Structured schema for a migrated legacy consent form, with the real wywiad."""

    extracted = QUESTIONNAIRE.get(code, {})
    questions = extracted.get("contraindications", [])
    categories = extracted.get("categories", [])

    treatment_fields = [
        {"key": "nazwaProduktu", "label": "Nazwa produktu", "type": "text"},
        {"key": "obszarZabiegu", "label": "Obszar zabiegu", "type": "text"},
        {"key": "celEfektu", "label": "Cel / oczekiwany efekt", "type": "text"},
        {"key": "osobaPrzeprowadzajacaZabieg", "label": "Osoba wykonująca zabieg", "type": "text"},
    ]
    if form_type in {"NEEDLE_MESOTHERAPY", "FACIAL_VOLUMETRY", "TISSUE_STIMULATION"}:
        treatment_fields.append({"key": "metodaZabiegu", "label": "Metoda zabiegu", "type": "text"})
    if form_type in {"FACIAL_VOLUMETRY", "TISSUE_STIMULATION"}:
        treatment_fields.extend(
            [
                {"key": "planowanaIloscZabiegow", "label": "Planowana ilość zabiegów", "type": "text"},
                {"key": "odstepMiedzyZabiegami", "label": "Odstęp między zabiegami", "type": "text"},
            ]
        )

    sections: list[dict[str, Any]] = [
        {
            "key": "dane_osobowe",
            "title": "Dane osobowe",
            "fields": [
                {"key": "imieNazwisko", "label": "Imię i nazwisko", "type": "text", "required": True},
                {"key": "dataUrodzenia", "label": "Data urodzenia", "type": "date"},
                {"key": "telefon", "label": "Telefon", "type": "tel", "required": True},
                {"key": "email", "label": "E-mail", "type": "email"},
                {"key": "ulica", "label": "Ulica", "type": "text"},
                {"key": "kodPocztowy", "label": "Kod pocztowy", "type": "text"},
                {"key": "miasto", "label": "Miasto", "type": "text"},
            ],
        },
        {"key": "szczegoly_zabiegu", "title": "Szczegóły zabiegu", "fields": treatment_fields},
        {
            "key": "przeciwwskazania",
            "title": "Wywiad medyczny / przeciwwskazania",
            "type": "contraindications",
            "categories": categories,
            "itemCount": len(questions),
            "items": [
                {
                    "key": q["key"],
                    "question": q["question"],
                    "type": "yes_no",
                    "hasFollowUp": bool(q.get("hasFollowUp")),
                    "followUpPlaceholder": q.get("followUpPlaceholder"),
                    "category": q.get("category"),
                }
                for q in questions
            ],
        },
        {
            "key": "zgody",
            "title": "Zgody",
            "fields": [
                {"key": "zgodaPrzetwarzanieDanych", "label": "Zgoda na przetwarzanie danych osobowych", "type": "consent", "required": True},
                {"key": "zgodaMarketing", "label": "Zgoda marketingowa", "type": "consent"},
                {"key": "zgodaFotografie", "label": "Zgoda na wykorzystanie wizerunku", "type": "consent"},
            ],
        },
        {
            "key": "podpisy",
            "title": "Podpisy",
            "fields": [
                {
                    "key": "podpisDane",
                    "label": "Podpis — zgoda na zabieg i dane",
                    "type": "signature",
                    "required": True,
                },
                {"key": "podpisRodo", "label": "Podpis — RODO", "type": "signature"},
                {
                    "key": "podpisMarketing",
                    "label": "Podpis — zgoda marketingowa",
                    "type": "signature",
                },
                {
                    "key": "podpisFotografie",
                    "label": "Podpis — wykorzystanie wizerunku",
                    "type": "signature",
                },
            ],
        },
    ]

    return {
        "version": 2,
        "locale": "pl-PL",
        "code": code,
        "treatment": name,
        "legacyFormType": form_type,
        "source": "powderbrows-legacy",
        "anatomy": ANATOMY_BY_CODE.get(code),
        "sections": sections,
    }


def content_hash(schema: dict[str, Any], legal: dict[str, Any]) -> str:
    payload = json.dumps({"schema": schema, "legal": legal}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def provision(dsn: str, tenant_slug: str | None) -> None:
    conn = await asyncpg.connect(dsn)
    try:
        async with conn.transaction():
            tenant_id = None
            if tenant_slug is not None:
                tenant_id = await conn.fetchval("SELECT id FROM tenants WHERE slug = $1", tenant_slug)
                if tenant_id is None:
                    raise SystemExit(f"Tenant '{tenant_slug}' not found — seed it first.")
                await conn.execute("SELECT set_config('app.tenant_id', $1, false)", str(tenant_id))
            if not QUESTIONNAIRE or any(code not in QUESTIONNAIRE for code, _, _, _ in CATALOG):
                raise SystemExit("The complete extracted questionnaire catalogue is required.")
    
            created_versions = 0
            total_questions = 0
    
            for order, (code, form_type, name, description) in enumerate(CATALOG):
                template_id = await conn.fetchval(
                    """
                    INSERT INTO form_templates (id, code, name, description, status, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, 'ACTIVE', now(), now())
                    ON CONFLICT (code) DO UPDATE
                        SET name = EXCLUDED.name, description = EXCLUDED.description,
                            status = 'ACTIVE', updated_at = now()
                    RETURNING id
                    """,
                    uuid.uuid4(), code, name, description,
                )
    
                schema = build_schema(code, form_type, name)
                total_questions += schema["sections"][2]["itemCount"]
                digest = content_hash(schema, LEGAL_CONTENT)
    
                latest = await conn.fetchrow(
                    """
                    SELECT version_number, content_hash FROM form_template_versions
                    WHERE form_template_id = $1 ORDER BY version_number DESC LIMIT 1
                    """,
                    template_id,
                )
                if latest is None or latest["content_hash"] != digest:
                    next_version = 1 if latest is None else latest["version_number"] + 1
                    await conn.execute(
                        """
                        INSERT INTO form_template_versions
                            (id, form_template_id, version_number, "schema", legal_content, content_hash, created_at, published_at)
                        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, now(), now())
                        """,
                        uuid.uuid4(), template_id, next_version,
                        json.dumps(schema, ensure_ascii=False),
                        json.dumps(LEGAL_CONTENT, ensure_ascii=False),
                        digest,
                    )
                    created_versions += 1
    
                if tenant_id is not None:
                    await conn.execute(
                        """
                        INSERT INTO tenant_form_templates
                            (id, tenant_id, form_template_id, enabled, display_order, created_at, updated_at)
                        VALUES ($1, $2, $3, true, $4, now(), now())
                        ON CONFLICT (tenant_id, form_template_id) DO UPDATE
                            SET enabled = true, display_order = EXCLUDED.display_order, updated_at = now()
                        """,
                        uuid.uuid4(), tenant_id, template_id, order,
                    )
    
            active = await conn.fetchval("SELECT count(*) FROM form_templates WHERE status = 'ACTIVE'")
            print(f"Catalogue: {active} active forms; {created_versions} new versions; {total_questions} questions")
            if tenant_slug:
                print(f"Enabled {len(CATALOG)} forms for {tenant_slug}")
    finally:
        await conn.close()


def main() -> None:
    tenant_slug = sys.argv[1] if len(sys.argv) > 1 else "powderbrows"
    if tenant_slug == "--catalog-only":
        tenant_slug = None
    raw = os.getenv("BEAUTYDOCS_MIGRATION_DATABASE_URL") or os.getenv("BEAUTYDOCS_DATABASE_URL", DEFAULT_DSN)
    dsn = raw.replace("postgresql+asyncpg://", "postgresql://")
    asyncio.run(provision(dsn, tenant_slug))


if __name__ == "__main__":
    main()
