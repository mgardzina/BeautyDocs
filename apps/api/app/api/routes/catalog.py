"""Medicine, treatment product, equipment and aftercare catalogue endpoints."""

from __future__ import annotations

import re
from collections.abc import Sequence
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Path, Query, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import or_, select

from app.api.dependencies import (
    CurrentConsumerDep,
    DbSessionDep,
    TenantAccessDep,
    TrustedOriginDep,
    enforce_roles,
)
from app.core.errors import AppError
from app.db.tenant_context import set_tenant_context
from app.models.domain import (
    CatalogItemKind,
    CatalogItemSource,
    ConsumerSubmissionLink,
    FormSubmission,
    FormTemplate,
    FormTemplateVersion,
    MembershipRole,
    SalonCatalogItem,
    SubmissionStatus,
    Tenant,
    TenantStatus,
)
from app.services.catalog import (
    DEPRECATED_EDITORIAL_EXTERNAL_IDS,
    CatalogSearchItem,
    SafetyRuleSnapshot,
    get_public_catalog_product,
    list_medicine_catalog_page,
    list_public_catalog_products,
    load_safety_rules,
    medicine_safety_assessment,
    resolve_catalog_snapshot,
    search_catalog,
)

router = APIRouter(tags=["catalog"])
VIEW_CATALOG_ROLES = frozenset(MembershipRole)
MANAGE_CATALOG_ROLES = frozenset({MembershipRole.OWNER, MembershipRole.ADMIN})
_FORM_CODE_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$")


class CatalogModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class CatalogItemResponse(CatalogModel):
    external_id: str = Field(min_length=1, max_length=160)
    kind: str = Field(max_length=32)
    source: str = Field(max_length=24)
    name: str = Field(max_length=250)
    brand: str | None = Field(default=None, max_length=300)
    summary: str = Field(max_length=2_000)
    details: dict[str, Any]
    source_label: str = Field(max_length=200)
    source_url: str = Field(max_length=2_048)


class CatalogSearchResponse(CatalogModel):
    items: list[CatalogItemResponse] = Field(max_length=50)
    rpl_available: bool
    medical_notice: str = Field(max_length=1_000)


class CatalogProductListResponse(CatalogModel):
    items: list[CatalogItemResponse] = Field(max_length=2_000)


class CatalogMedicinePageResponse(CatalogModel):
    items: list[CatalogItemResponse] = Field(max_length=50)
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=50)
    total_pages: int = Field(ge=0)
    rpl_available: bool
    medical_notice: str = Field(max_length=1_000)


class SalonCatalogItemResponse(CatalogModel):
    id: UUID
    source: str = Field(max_length=24)
    external_id: str | None = Field(default=None, max_length=160)
    kind: str = Field(max_length=32)
    name: str = Field(max_length=250)
    brand: str | None = Field(default=None, max_length=200)
    summary: str | None = None
    details: dict[str, Any]
    source_label: str | None = Field(default=None, max_length=200)
    source_url: str | None = Field(default=None, max_length=2_048)
    used_in_treatments: bool
    recommended_aftercare: bool
    treatment_codes: list[str] = Field(max_length=100)
    recommendation_note: str | None = Field(default=None, max_length=2_000)
    is_sponsored: bool
    sponsor_name: str | None = Field(default=None, max_length=200)
    is_active: bool


class SalonCatalogListResponse(CatalogModel):
    items: list[SalonCatalogItemResponse] = Field(max_length=500)
    can_manage: bool


class SalonCatalogCreateRequest(CatalogModel):
    source: CatalogItemSource
    external_id: str | None = Field(default=None, max_length=160)
    kind: CatalogItemKind
    name: str = Field(min_length=2, max_length=250)
    brand: str | None = Field(default=None, max_length=200)
    summary: str | None = Field(default=None, max_length=2_000)
    details: dict[str, Any] = Field(default_factory=dict)
    source_label: str | None = Field(default=None, max_length=200)
    source_url: str | None = Field(default=None, max_length=2_048, pattern=r"^https://")
    used_in_treatments: bool = False
    recommended_aftercare: bool = False
    treatment_codes: list[str] = Field(default_factory=list, max_length=100)
    recommendation_note: str | None = Field(default=None, max_length=2_000)

    @model_validator(mode="after")
    def validate_catalog_semantics(self) -> SalonCatalogCreateRequest:
        if self.source == CatalogItemSource.RPL and (
            self.kind != CatalogItemKind.MEDICINE
            or not re.fullmatch(r"rpl:[1-9][0-9]{0,15}", self.external_id or "")
        ):
            raise ValueError("RPL catalogue entry is invalid")
        if self.source == CatalogItemSource.BEAUTYDOCS and not self.external_id:
            raise ValueError("BeautyDocs catalogue entry requires an external id")
        if self.source == CatalogItemSource.SALON and self.external_id is not None:
            raise ValueError("Salon catalogue entry cannot use an external id")
        if self.recommended_aftercare and self.kind != CatalogItemKind.COSMETIC:
            raise ValueError("Only cosmetics can be recommended as aftercare")
        if any(not _FORM_CODE_PATTERN.fullmatch(code) for code in self.treatment_codes):
            raise ValueError("Treatment code is invalid")
        return self


class SalonCatalogUpdateRequest(CatalogModel):
    used_in_treatments: bool
    recommended_aftercare: bool
    treatment_codes: list[str] = Field(max_length=100)
    recommendation_note: str | None = Field(default=None, max_length=2_000)

    @model_validator(mode="after")
    def validate_treatment_codes(self) -> SalonCatalogUpdateRequest:
        if any(not _FORM_CODE_PATTERN.fullmatch(code) for code in self.treatment_codes):
            raise ValueError("Treatment code is invalid")
        return self


class ConsumerAftercareResponse(CatalogModel):
    salon_name: str = Field(max_length=200)
    treatment_code: str = Field(max_length=100)
    items: list[SalonCatalogItemResponse] = Field(max_length=100)
    notice: str = Field(max_length=1_000)


@router.get("/catalog/search", response_model=CatalogSearchResponse)
async def search_shared_catalog(
    session: DbSessionDep,
    query: Annotated[str, Query(alias="q", max_length=100)] = "",
    kind: Annotated[CatalogItemKind | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 24,
) -> CatalogSearchResponse:
    result = await search_catalog(query, kind=kind, limit=limit, session=session)
    return CatalogSearchResponse(
        items=[_catalog_response(item) for item in result.items],
        rpl_available=result.rpl_available,
        medical_notice=(
            "Katalog ma charakter informacyjny. Nie odstawiaj ani nie zmieniaj leku "
            "bez konsultacji z lekarzem lub farmaceutą."
        ),
    )


@router.get("/catalog/medicines", response_model=CatalogMedicinePageResponse)
async def browse_medicine_catalog(
    session: DbSessionDep,
    response: Response,
    query: Annotated[str, Query(alias="q", max_length=100)] = "",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=50)] = 30,
) -> CatalogMedicinePageResponse:
    result = await list_medicine_catalog_page(
        session,
        query=query,
        page=page,
        page_size=page_size,
    )
    response.headers["Cache-Control"] = "public, max-age=60, s-maxage=300"
    return CatalogMedicinePageResponse(
        items=[_catalog_response(item) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=(result.total + result.page_size - 1) // result.page_size,
        rpl_available=result.rpl_available,
        medical_notice=(
            "Katalog ma charakter informacyjny. Nie odstawiaj ani nie zmieniaj leku "
            "bez konsultacji z lekarzem lub farmaceutą."
        ),
    )


@router.get("/catalog/products", response_model=CatalogProductListResponse)
async def list_public_products(response: Response) -> CatalogProductListResponse:
    response.headers["Cache-Control"] = "public, max-age=300, s-maxage=3600"
    return CatalogProductListResponse(
        items=[_catalog_response(item) for item in list_public_catalog_products()]
    )


@router.get("/catalog/products/{product_slug}", response_model=CatalogItemResponse)
async def get_public_product(
    product_slug: Annotated[
        str,
        Path(min_length=1, max_length=160, pattern=r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"),
    ],
    response: Response,
) -> CatalogItemResponse:
    item = get_public_catalog_product(product_slug)
    if item is None:
        raise AppError(
            status_code=404,
            code="catalog_product_not_found",
            message="Catalogue product was not found",
        )
    response.headers["Cache-Control"] = "public, max-age=300, s-maxage=3600"
    return _catalog_response(item)


@router.get(
    "/admin/tenants/{slug}/catalog",
    response_model=SalonCatalogListResponse,
)
async def list_salon_catalog(
    access: TenantAccessDep,
    session: DbSessionDep,
) -> SalonCatalogListResponse:
    enforce_roles(access, VIEW_CATALOG_ROLES)
    items = (
        await session.scalars(
            select(SalonCatalogItem)
            .where(
                SalonCatalogItem.tenant_id == access.tenant.id,
                SalonCatalogItem.is_active.is_(True),
                or_(
                    SalonCatalogItem.external_id.is_(None),
                    SalonCatalogItem.external_id.not_in(
                        tuple(sorted(DEPRECATED_EDITORIAL_EXTERNAL_IDS))
                    ),
                ),
            )
            .order_by(SalonCatalogItem.kind, SalonCatalogItem.name)
            .limit(500)
        )
    ).all()
    safety_rules = await load_safety_rules(session)
    return SalonCatalogListResponse(
        items=[_salon_response(item, safety_rules=safety_rules) for item in items],
        can_manage=access.role in MANAGE_CATALOG_ROLES,
    )


@router.post(
    "/admin/tenants/{slug}/catalog",
    response_model=SalonCatalogItemResponse,
    status_code=201,
)
async def add_salon_catalog_item(
    access: TenantAccessDep,
    _origin: TrustedOriginDep,
    payload: SalonCatalogCreateRequest,
    session: DbSessionDep,
) -> SalonCatalogItemResponse:
    enforce_roles(access, MANAGE_CATALOG_ROLES)
    trusted_item: CatalogSearchItem | None = None
    if payload.source != CatalogItemSource.SALON:
        trusted_item, source_available = await resolve_catalog_snapshot(
            payload.source,
            payload.external_id or "",
            payload.name,
            session=session,
        )
        if not source_available:
            raise AppError(
                status_code=503,
                code="catalog_source_unavailable",
                message="The official catalogue is temporarily unavailable",
            )
        if trusted_item is None:
            raise AppError(
                status_code=422,
                code="catalog_item_invalid",
                message="The catalogue item could not be verified",
            )
    item = None
    if payload.external_id is not None:
        item = await session.scalar(
            select(SalonCatalogItem).where(
                SalonCatalogItem.tenant_id == access.tenant.id,
                SalonCatalogItem.source == payload.source.value,
                SalonCatalogItem.external_id == payload.external_id,
            )
        )
    if item is None:
        item = SalonCatalogItem(
            tenant_id=access.tenant.id,
            source=payload.source.value,
            external_id=payload.external_id,
            kind=trusted_item.kind if trusted_item else payload.kind.value,
            name=trusted_item.name if trusted_item else payload.name.strip(),
            brand=trusted_item.brand if trusted_item else _clean_optional(payload.brand),
            summary=(trusted_item.summary if trusted_item else _clean_optional(payload.summary)),
            details=trusted_item.details if trusted_item else payload.details,
            source_label=(
                trusted_item.source_label if trusted_item else _clean_optional(payload.source_label)
            ),
            source_url=trusted_item.source_url if trusted_item else payload.source_url,
            is_sponsored=False,
            sponsor_name=None,
        )
        session.add(item)
    item.used_in_treatments = payload.used_in_treatments
    item.recommended_aftercare = payload.recommended_aftercare
    item.treatment_codes = list(dict.fromkeys(payload.treatment_codes))
    item.recommendation_note = _clean_optional(payload.recommendation_note)
    item.is_active = True
    await session.flush()
    safety_rules = await load_safety_rules(session)
    return _salon_response(item, safety_rules=safety_rules)


@router.put(
    "/admin/tenants/{slug}/catalog/{item_id}",
    response_model=SalonCatalogItemResponse,
)
async def update_salon_catalog_item(
    access: TenantAccessDep,
    _origin: TrustedOriginDep,
    item_id: Annotated[UUID, Path()],
    payload: SalonCatalogUpdateRequest,
    session: DbSessionDep,
) -> SalonCatalogItemResponse:
    enforce_roles(access, MANAGE_CATALOG_ROLES)
    item = await _salon_item_or_404(session, access.tenant.id, item_id)
    if payload.recommended_aftercare and item.kind != CatalogItemKind.COSMETIC.value:
        raise AppError(
            status_code=422,
            code="invalid_aftercare_item",
            message="Only cosmetics can be recommended as aftercare",
        )
    item.used_in_treatments = payload.used_in_treatments
    item.recommended_aftercare = payload.recommended_aftercare
    item.treatment_codes = list(dict.fromkeys(payload.treatment_codes))
    item.recommendation_note = _clean_optional(payload.recommendation_note)
    await session.flush()
    safety_rules = await load_safety_rules(session)
    return _salon_response(item, safety_rules=safety_rules)


@router.delete(
    "/admin/tenants/{slug}/catalog/{item_id}",
    status_code=204,
)
async def archive_salon_catalog_item(
    access: TenantAccessDep,
    _origin: TrustedOriginDep,
    item_id: Annotated[UUID, Path()],
    session: DbSessionDep,
) -> Response:
    enforce_roles(access, MANAGE_CATALOG_ROLES)
    item = await _salon_item_or_404(session, access.tenant.id, item_id)
    item.is_active = False
    await session.flush()
    return Response(status_code=204)


@router.get(
    "/consumer/catalog/recommendations",
    response_model=ConsumerAftercareResponse,
)
async def get_consumer_aftercare_recommendations(
    principal: CurrentConsumerDep,
    session: DbSessionDep,
    tenant_slug: Annotated[
        str,
        Query(alias="tenantSlug", min_length=1, max_length=63, pattern=r"^[a-z0-9-]+$"),
    ],
    treatment_code: Annotated[
        str,
        Query(alias="treatmentCode", min_length=1, max_length=100),
    ],
) -> ConsumerAftercareResponse:
    if not _FORM_CODE_PATTERN.fullmatch(treatment_code):
        raise AppError(
            status_code=422,
            code="invalid_treatment_code",
            message="Treatment code is invalid",
        )
    tenant = await session.scalar(
        select(Tenant).where(
            Tenant.slug == tenant_slug,
            Tenant.status == TenantStatus.ACTIVE.value,
        )
    )
    if tenant is None:
        raise AppError(status_code=404, code="tenant_not_found", message="Salon was not found")
    await set_tenant_context(session, tenant.id)
    eligible_document = await session.scalar(
        select(ConsumerSubmissionLink.id)
        .join(
            FormSubmission,
            FormSubmission.id == ConsumerSubmissionLink.form_submission_id,
        )
        .join(
            FormTemplateVersion,
            FormTemplateVersion.id == FormSubmission.form_template_version_id,
        )
        .join(FormTemplate, FormTemplate.id == FormTemplateVersion.form_template_id)
        .where(
            ConsumerSubmissionLink.consumer_account_id == principal.consumer_account_id,
            ConsumerSubmissionLink.tenant_id == tenant.id,
            ConsumerSubmissionLink.revoked_at.is_(None),
            FormSubmission.status == SubmissionStatus.SIGNED.value,
            FormTemplate.code == treatment_code,
        )
        .limit(1)
    )
    if eligible_document is None:
        raise AppError(
            status_code=404,
            code="aftercare_not_available",
            message="Aftercare recommendations are not available",
        )
    candidates = (
        await session.scalars(
            select(SalonCatalogItem)
            .where(
                SalonCatalogItem.tenant_id == tenant.id,
                SalonCatalogItem.is_active.is_(True),
                SalonCatalogItem.recommended_aftercare.is_(True),
                or_(
                    SalonCatalogItem.external_id.is_(None),
                    SalonCatalogItem.external_id.not_in(
                        tuple(sorted(DEPRECATED_EDITORIAL_EXTERNAL_IDS))
                    ),
                ),
            )
            .order_by(SalonCatalogItem.is_sponsored, SalonCatalogItem.name)
            .limit(100)
        )
    ).all()
    items = [
        item
        for item in candidates
        if not item.treatment_codes or treatment_code in item.treatment_codes
    ]
    safety_rules = await load_safety_rules(session)
    return ConsumerAftercareResponse(
        salon_name=tenant.display_name,
        treatment_code=treatment_code,
        items=[_salon_response(item, safety_rules=safety_rules) for item in items],
        notice=(
            "To zalecenia pielęgnacyjne przekazane przez salon. W razie niepokojących "
            "objawów skontaktuj się z osobą wykonującą zabieg lub lekarzem."
        ),
    )


def _catalog_response(item: CatalogSearchItem) -> CatalogItemResponse:
    return CatalogItemResponse(
        external_id=item.external_id,
        kind=item.kind,
        source=item.source,
        name=item.name,
        brand=item.brand,
        summary=item.summary,
        details=item.details,
        source_label=item.source_label,
        source_url=item.source_url,
    )


def _salon_response(
    item: SalonCatalogItem,
    *,
    safety_rules: Sequence[SafetyRuleSnapshot] | None = None,
) -> SalonCatalogItemResponse:
    details = item.details if isinstance(item.details, dict) else {}
    if item.kind == CatalogItemKind.MEDICINE.value:
        characteristic_url = details.get("characteristicUrl")
        if not isinstance(characteristic_url, str) or not characteristic_url.startswith("https://"):
            characteristic_url = "https://rejestry.ezdrowie.gov.pl/rpl/search/public"
        details = {
            **details,
            "safetyAssessment": medicine_safety_assessment(
                active_substance=(
                    details.get("activeSubstance")
                    if isinstance(details.get("activeSubstance"), str)
                    else None
                ),
                pharmaceutical_form=(
                    details.get("pharmaceuticalForm")
                    if isinstance(details.get("pharmaceuticalForm"), str)
                    else None
                ),
                characteristic_url=characteristic_url,
                safety_rules=safety_rules,
            ),
        }
    return SalonCatalogItemResponse(
        id=item.id,
        source=item.source,
        external_id=item.external_id,
        kind=item.kind,
        name=item.name,
        brand=item.brand,
        summary=item.summary,
        details=details,
        source_label=item.source_label,
        source_url=item.source_url,
        used_in_treatments=item.used_in_treatments,
        recommended_aftercare=item.recommended_aftercare,
        treatment_codes=(
            [code for code in item.treatment_codes if isinstance(code, str)]
            if isinstance(item.treatment_codes, list)
            else []
        ),
        recommendation_note=item.recommendation_note,
        is_sponsored=item.is_sponsored,
        sponsor_name=item.sponsor_name,
        is_active=item.is_active,
    )


async def _salon_item_or_404(
    session: DbSessionDep,
    tenant_id: UUID,
    item_id: UUID,
) -> SalonCatalogItem:
    item = await session.scalar(
        select(SalonCatalogItem).where(
            SalonCatalogItem.tenant_id == tenant_id,
            SalonCatalogItem.id == item_id,
            SalonCatalogItem.is_active.is_(True),
        )
    )
    if item is None:
        raise AppError(
            status_code=404,
            code="catalog_item_not_found",
            message="Catalogue item was not found",
        )
    return item


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None
