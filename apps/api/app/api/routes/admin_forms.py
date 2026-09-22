"""Salon-panel form catalogue management.

A salon sees the platform's active form templates and chooses which ones it
offers. Reading the catalogue is allowed for every member; toggling a form on or
off is a mutation restricted to management roles and a trusted origin.
"""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import and_, func, select

from app.api.dependencies import (
    DbSessionDep,
    TenantAccessDep,
    TrustedOriginDep,
    enforce_roles,
)
from app.core.errors import AppError
from app.db.tenant_context import set_tenant_context
from app.models.domain import (
    FormTemplate,
    FormTemplateVersion,
    MembershipRole,
    TeamMember,
    TemplateStatus,
    TenantFormTemplate,
)
from app.services.team_assignments import can_perform_treatment

router = APIRouter(prefix="/admin/tenants", tags=["admin-forms"])

VIEW_FORMS_ROLES = frozenset(MembershipRole)
MANAGE_FORMS_ROLES = frozenset({MembershipRole.OWNER, MembershipRole.ADMIN})
_FORM_CODE_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$")


class AdminResponseModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AdminFormResponse(AdminResponseModel):
    code: str = Field(max_length=100)
    name: str = Field(max_length=250)
    description: str | None = None
    enabled: bool
    display_order: int = Field(ge=0)
    version: int | None = None
    question_count: int = Field(ge=0)
    duration_minutes: int = Field(ge=15, le=480)


class AdminFormListResponse(AdminResponseModel):
    forms: list[AdminFormResponse] = Field(max_length=500)
    can_manage: bool


class AdminFormPreviewPractitioner(AdminResponseModel):
    id: UUID
    display_name: str = Field(max_length=200)
    job_title: str | None = None


class AdminFormPreviewResponse(AdminResponseModel):
    code: str = Field(max_length=100)
    name: str = Field(max_length=250)
    description: str | None = None
    version: int
    definition: dict[str, Any]
    legal: dict[str, Any]
    practitioners: list[AdminFormPreviewPractitioner] = Field(max_length=250)


class SetFormSettingsRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )
    enabled: bool
    duration_minutes: int | None = Field(default=None, ge=15, le=480, multiple_of=15)


def _question_count(schema: dict[str, Any] | None) -> int:
    if not schema:
        return 0
    for section in schema.get("sections", []):
        if isinstance(section, dict) and section.get("type") == "contraindications":
            items = section.get("items")
            return len(items) if isinstance(items, list) else 0
    return 0


async def _latest_published_versions(
    session: DbSessionDep,
) -> dict[Any, tuple[int, dict[str, Any] | None]]:
    """Map form_template_id -> (version_number, schema) for the newest published version."""

    rows = (
        await session.execute(
            select(
                FormTemplateVersion.form_template_id,
                FormTemplateVersion.version_number,
                FormTemplateVersion.schema_definition,
            )
            .where(FormTemplateVersion.published_at.is_not(None))
            .order_by(
                FormTemplateVersion.form_template_id,
                FormTemplateVersion.version_number.desc(),
            )
        )
    ).all()

    latest: dict[Any, tuple[int, dict[str, Any] | None]] = {}
    for form_template_id, version_number, schema in rows:
        if form_template_id not in latest:
            latest[form_template_id] = (version_number, schema)
    return latest


@router.get("/{slug}/forms", response_model=AdminFormListResponse)
async def list_tenant_forms(
    access: TenantAccessDep,
    session: DbSessionDep,
) -> AdminFormListResponse:
    enforce_roles(access, VIEW_FORMS_ROLES)
    tenant_id = access.tenant.id

    latest = await _latest_published_versions(session)
    rows = (
        await session.execute(
            select(
                FormTemplate.id,
                FormTemplate.code,
                FormTemplate.name,
                FormTemplate.description,
                TenantFormTemplate.enabled,
                TenantFormTemplate.display_order,
                TenantFormTemplate.duration_minutes,
            )
            .outerjoin(
                TenantFormTemplate,
                and_(
                    TenantFormTemplate.form_template_id == FormTemplate.id,
                    TenantFormTemplate.tenant_id == tenant_id,
                ),
            )
            .where(FormTemplate.status == TemplateStatus.ACTIVE.value)
            .order_by(
                func.coalesce(TenantFormTemplate.display_order, 9_999),
                FormTemplate.name,
            )
        )
    ).all()

    forms = [
        AdminFormResponse(
            code=row.code,
            name=row.name,
            description=row.description,
            enabled=bool(row.enabled),
            display_order=row.display_order or 0,
            version=latest.get(row.id, (None, None))[0],
            question_count=_question_count(latest.get(row.id, (None, None))[1]),
            duration_minutes=row.duration_minutes or 60,
        )
        for row in rows
    ]
    return AdminFormListResponse(
        forms=forms,
        can_manage=access.role in MANAGE_FORMS_ROLES,
    )


@router.get("/{slug}/forms/{code}/preview", response_model=AdminFormPreviewResponse)
async def preview_tenant_form(
    access: TenantAccessDep,
    code: str,
    session: DbSessionDep,
) -> AdminFormPreviewResponse:
    """Let any salon member see a form's full content before deciding to enable it.

    Unlike the public endpoint, this does not require the salon to have the
    form enabled — an owner should be able to preview a form to decide
    whether to switch it on at all.
    """

    enforce_roles(access, VIEW_FORMS_ROLES)
    if not _FORM_CODE_PATTERN.fullmatch(code):
        raise AppError(status_code=404, code="form_not_found", message="Form was not found")

    row = (
        await session.execute(
            select(
                FormTemplate.id,
                FormTemplate.code,
                FormTemplate.name,
                FormTemplate.description,
                FormTemplateVersion.version_number,
                FormTemplateVersion.schema_definition,
                FormTemplateVersion.legal_content,
            )
            .join(
                FormTemplateVersion,
                FormTemplateVersion.form_template_id == FormTemplate.id,
            )
            .where(
                FormTemplate.code == code,
                FormTemplate.status == TemplateStatus.ACTIVE.value,
                FormTemplateVersion.published_at.is_not(None),
            )
            .order_by(FormTemplateVersion.version_number.desc())
            .limit(1)
        )
    ).first()
    if row is None:
        raise AppError(status_code=404, code="form_not_found", message="Form was not found")

    # RLS context before touching team_members.
    await set_tenant_context(session, access.tenant.id)
    practitioners = (
        await session.execute(
            select(
                TeamMember.id,
                TeamMember.display_name,
                TeamMember.job_title,
                TeamMember.all_treatments,
                TeamMember.treatment_codes,
            )
            .where(
                TeamMember.tenant_id == access.tenant.id,
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

    return AdminFormPreviewResponse(
        code=row.code,
        name=row.name,
        description=row.description,
        version=row.version_number,
        definition=row.schema_definition,
        legal=row.legal_content,
        practitioners=[
            AdminFormPreviewPractitioner(
                id=practitioner.id,
                display_name=practitioner.display_name,
                job_title=practitioner.job_title,
            )
            for practitioner in practitioners
            if can_perform_treatment(practitioner, code)
        ],
    )


@router.put("/{slug}/forms/{code}", response_model=AdminFormResponse)
async def set_tenant_form_settings(
    access: TenantAccessDep,
    _origin: TrustedOriginDep,
    code: str,
    payload: SetFormSettingsRequest,
    session: DbSessionDep,
) -> AdminFormResponse:
    enforce_roles(access, MANAGE_FORMS_ROLES)
    if not _FORM_CODE_PATTERN.fullmatch(code):
        raise AppError(status_code=404, code="form_not_found", message="Form was not found")

    tenant_id = access.tenant.id
    template = await session.scalar(
        select(FormTemplate).where(
            FormTemplate.code == code,
            FormTemplate.status == TemplateStatus.ACTIVE.value,
        )
    )
    if template is None:
        raise AppError(status_code=404, code="form_not_found", message="Form was not found")

    link = await session.scalar(
        select(TenantFormTemplate).where(
            TenantFormTemplate.tenant_id == tenant_id,
            TenantFormTemplate.form_template_id == template.id,
        )
    )
    if link is None:
        next_order = await session.scalar(
            select(func.max(TenantFormTemplate.display_order)).where(
                TenantFormTemplate.tenant_id == tenant_id
            )
        )
        link = TenantFormTemplate(
            tenant_id=tenant_id,
            form_template_id=template.id,
            enabled=payload.enabled,
            display_order=(next_order + 1) if next_order is not None else 0,
            duration_minutes=payload.duration_minutes or 60,
        )
        session.add(link)
    else:
        link.enabled = payload.enabled
        if payload.duration_minutes is not None:
            link.duration_minutes = payload.duration_minutes
    await session.flush()

    latest = await _latest_published_versions(session)
    version, schema = latest.get(template.id, (None, None))
    return AdminFormResponse(
        code=template.code,
        name=template.name,
        description=template.description,
        enabled=link.enabled,
        display_order=link.display_order,
        version=version,
        question_count=_question_count(schema),
        duration_minutes=link.duration_minutes,
    )
