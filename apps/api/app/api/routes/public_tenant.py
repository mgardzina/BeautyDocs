from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    DbSessionDep,
    RequestContextDep,
    SettingsDep,
    TenantSlugPath,
)
from app.core.errors import AppError
from app.db.tenant_context import set_tenant_context
from app.models.domain import (
    FormSubmission,
    FormTemplate,
    FormTemplateVersion,
    SubmissionStatus,
    TeamMember,
    TemplateStatus,
    Tenant,
    TenantFormTemplate,
    TenantStatus,
)
from app.services.team_assignments import can_perform_treatment

_FORM_CODE_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$")

router = APIRouter(prefix="/public", tags=["public"])


class PublicResponseModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class TenantPostalAddressResponse(PublicResponseModel):
    street: str = Field(max_length=501)
    postal_code: str = Field(max_length=20)
    city: str = Field(max_length=120)
    country_code: str = Field(min_length=2, max_length=2)


class TenantLegalDetailsResponse(PublicResponseModel):
    nip: str | None = Field(max_length=20)
    address: TenantPostalAddressResponse | None
    privacy_contact_email: str | None = Field(max_length=320)


class TenantPublicContactResponse(PublicResponseModel):
    phone: str | None = Field(max_length=32)
    email: str | None = Field(max_length=320)
    website_url: str | None = Field(max_length=2048)


class TenantActiveFormResponse(PublicResponseModel):
    code: str = Field(max_length=100)
    display_name: str = Field(max_length=250)
    display_order: int


class TenantPublicConfigResponse(PublicResponseModel):
    slug: str = Field(max_length=63)
    display_name: str = Field(max_length=200)
    legal_name: str = Field(max_length=250)
    logo_url: str | None = Field(default=None, max_length=320_000)
    legal: TenantLegalDetailsResponse
    contact: TenantPublicContactResponse
    active_forms: list[TenantActiveFormResponse] = Field(max_length=100)


def _public_address(tenant: Tenant) -> TenantPostalAddressResponse | None:
    if not tenant.address_line1 or not tenant.postal_code or not tenant.city:
        return None
    street_parts = [tenant.address_line1]
    if tenant.address_line2:
        street_parts.append(tenant.address_line2)
    return TenantPostalAddressResponse(
        street="\n".join(street_parts),
        postal_code=tenant.postal_code,
        city=tenant.city,
        country_code=tenant.country_code,
    )


async def _public_tenant_config_for_slug(
    session: AsyncSession,
    slug: str,
) -> TenantPublicConfigResponse:
    tenant = await session.scalar(
        select(Tenant).where(
            Tenant.slug == slug,
            Tenant.status == TenantStatus.ACTIVE.value,
        )
    )
    if tenant is None:
        raise AppError(
            status_code=404,
            code="tenant_not_found",
            message="Tenant was not found",
        )

    # This must happen inside the dependency-owned transaction and before the
    # first query to the RLS-protected tenant_form_templates table.
    await set_tenant_context(session, tenant.id)
    form_rows = (
        await session.execute(
            select(
                FormTemplate.code,
                FormTemplate.name,
                TenantFormTemplate.display_order,
            )
            .join(
                TenantFormTemplate,
                TenantFormTemplate.form_template_id == FormTemplate.id,
            )
            .where(
                TenantFormTemplate.tenant_id == tenant.id,
                TenantFormTemplate.enabled.is_(True),
                FormTemplate.status == TemplateStatus.ACTIVE.value,
            )
            .order_by(TenantFormTemplate.display_order, FormTemplate.code)
        )
    ).all()

    return TenantPublicConfigResponse(
        slug=tenant.slug,
        display_name=tenant.display_name,
        legal_name=tenant.legal_name,
        logo_url=tenant.logo_image,
        legal=TenantLegalDetailsResponse(
            nip=tenant.nip,
            address=_public_address(tenant),
            privacy_contact_email=tenant.privacy_contact_email,
        ),
        contact=TenantPublicContactResponse(
            phone=tenant.phone,
            email=tenant.email,
            website_url=tenant.website_url,
        ),
        active_forms=[
            TenantActiveFormResponse(
                code=code,
                display_name=name,
                display_order=display_order,
            )
            for code, name, display_order in form_rows
        ],
    )


class PublicPractitionerResponse(PublicResponseModel):
    id: UUID
    display_name: str = Field(max_length=200)
    job_title: str | None = Field(default=None, max_length=160)
    sms_signing_ready: bool


class PublicFormContentResponse(PublicResponseModel):
    code: str = Field(max_length=100)
    display_name: str = Field(max_length=250)
    description: str | None = None
    version: int
    definition: dict[str, Any]
    legal: dict[str, Any]
    practitioners: list[PublicPractitionerResponse] = Field(max_length=250)


async def _public_form_content(
    session: AsyncSession,
    slug: str,
    code: str,
) -> PublicFormContentResponse:
    """Serve the latest published content of a form the salon has enabled.

    Re-checks tenant is active, the template is enabled for this tenant and
    ACTIVE, and returns the newest published version. Anything else is a 404, so
    disabled/unknown/unpublished forms are indistinguishable to the public.
    """

    if not _FORM_CODE_PATTERN.fullmatch(code):
        raise AppError(status_code=404, code="form_not_found", message="Form was not found")

    tenant = await session.scalar(
        select(Tenant).where(
            Tenant.slug == slug,
            Tenant.status == TenantStatus.ACTIVE.value,
        )
    )
    if tenant is None:
        raise AppError(status_code=404, code="form_not_found", message="Form was not found")

    # RLS context before touching tenant_form_templates.
    await set_tenant_context(session, tenant.id)
    row = (
        await session.execute(
            select(
                FormTemplate.code,
                FormTemplate.name,
                FormTemplate.description,
                FormTemplateVersion.version_number,
                FormTemplateVersion.schema_definition,
                FormTemplateVersion.legal_content,
            )
            .join(
                TenantFormTemplate,
                TenantFormTemplate.form_template_id == FormTemplate.id,
            )
            .join(
                FormTemplateVersion,
                FormTemplateVersion.form_template_id == FormTemplate.id,
            )
            .where(
                TenantFormTemplate.tenant_id == tenant.id,
                TenantFormTemplate.enabled.is_(True),
                FormTemplate.status == TemplateStatus.ACTIVE.value,
                FormTemplate.code == code,
                FormTemplateVersion.published_at.is_not(None),
            )
            .order_by(FormTemplateVersion.version_number.desc())
            .limit(1)
        )
    ).first()

    if row is None:
        raise AppError(status_code=404, code="form_not_found", message="Form was not found")

    practitioners = (
        await session.execute(
            select(
                TeamMember.id,
                TeamMember.display_name,
                TeamMember.job_title,
                TeamMember.all_treatments,
                TeamMember.treatment_codes,
                (
                    TeamMember.membership_id.is_not(None) & TeamMember.phone_normalized.is_not(None)
                ).label("sms_signing_ready"),
            )
            .where(
                TeamMember.tenant_id == tenant.id,
                TeamMember.is_active.is_(True),
                TeamMember.performs_treatments.is_(True),
                TeamMember.membership_id.is_not(None),
                TeamMember.phone_normalized.is_not(None),
            )
            .order_by(
                TeamMember.is_owner.desc(),
                TeamMember.display_name.asc(),
                TeamMember.id.asc(),
            )
            .limit(250)
        )
    ).all()

    return PublicFormContentResponse(
        code=row.code,
        display_name=row.name,
        description=row.description,
        version=row.version_number,
        definition=row.schema_definition,
        legal=row.legal_content,
        practitioners=[
            PublicPractitionerResponse(
                id=practitioner.id,
                display_name=practitioner.display_name,
                job_title=practitioner.job_title,
                sms_signing_ready=practitioner.sms_signing_ready,
            )
            for practitioner in practitioners
            if can_perform_treatment(practitioner, code)
        ],
    )


@router.get(
    "/tenants/{slug}/forms/{code}",
    response_model=PublicFormContentResponse,
)
async def public_tenant_form(
    slug: TenantSlugPath,
    code: str,
    settings: SettingsDep,
    session: DbSessionDep,
) -> PublicFormContentResponse:
    """Return the published content of one enabled form for a salon."""

    if slug in settings.reserved_subdomains:
        raise AppError(status_code=404, code="form_not_found", message="Form was not found")
    return await _public_form_content(session, slug, code)


@router.get("/tenant", response_model=TenantPublicConfigResponse)
async def public_tenant_config(
    context: RequestContextDep,
    session: DbSessionDep,
) -> TenantPublicConfigResponse:
    """Compatibility endpoint for the former tenant-per-subdomain flow."""

    return await _public_tenant_config_for_slug(session, context.tenant.slug)


@router.get("/tenants/{slug}", response_model=TenantPublicConfigResponse)
async def public_tenant_config_by_slug(
    slug: TenantSlugPath,
    settings: SettingsDep,
    session: DbSessionDep,
) -> TenantPublicConfigResponse:
    """Resolve a salon by path on the shared forms.beautydocs.pl surface."""

    if slug in settings.reserved_subdomains:
        raise AppError(
            status_code=404,
            code="tenant_not_found",
            message="Tenant was not found",
        )
    return await _public_tenant_config_for_slug(session, slug)


class PlatformStatsResponse(PublicResponseModel):
    """Aggregate, non-identifying platform totals for marketing social proof."""

    company_count: int = Field(ge=0)
    signed_form_count: int = Field(ge=0)
    available_form_count: int = Field(ge=0)


async def _platform_stats(session: AsyncSession) -> PlatformStatsResponse:
    """Compute platform-wide counts.

    ``tenants`` and ``form_templates`` are global (not RLS-scoped), so they are
    counted directly. ``form_submissions`` is FORCE ROW LEVEL SECURITY, so we
    respect tenant isolation by setting each active salon's context in turn and
    summing — never bypassing the policy.
    """

    # One company may have several locations. Only registered Polish business
    # identifiers count; missing identifiers must not become invented companies.
    normalized_nip = func.regexp_replace(Tenant.nip, "[^0-9]", "", "g")
    company_count = await session.scalar(
        select(func.count(func.distinct(normalized_nip)))
        .select_from(Tenant)
        .where(Tenant.status == TenantStatus.ACTIVE.value, func.length(normalized_nip) == 10)
    )

    available_form_count = await session.scalar(
        select(func.count())
        .select_from(FormTemplate)
        .where(FormTemplate.status == TemplateStatus.ACTIVE.value)
    )

    active_tenant_ids = (
        await session.scalars(select(Tenant.id).where(Tenant.status == TenantStatus.ACTIVE.value))
    ).all()

    signed_form_count = 0
    for tenant_id in active_tenant_ids:
        # Transaction-local; each iteration overwrites the previous salon's context.
        await set_tenant_context(session, tenant_id)
        tenant_total = await session.scalar(
            select(func.count())
            .select_from(FormSubmission)
            .where(
                FormSubmission.tenant_id == tenant_id,
                FormSubmission.status == SubmissionStatus.SIGNED.value,
                FormSubmission.signed_at.is_not(None),
            )
        )
        signed_form_count += tenant_total or 0

    return PlatformStatsResponse(
        company_count=company_count or 0,
        signed_form_count=signed_form_count,
        available_form_count=available_form_count or 0,
    )


@router.get("/platform-stats", response_model=PlatformStatsResponse)
async def platform_stats(session: DbSessionDep) -> PlatformStatsResponse:
    """Aggregate marketing counters for the public home page."""

    return await _platform_stats(session)
