"""Tenant calendar views for planned and completed salon visits."""

from __future__ import annotations

import unicodedata
from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Path, Query
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import exists, or_, select

from app.api.dependencies import (
    DbSessionDep,
    TenantAccessDep,
    TrustedOriginDep,
    enforce_roles,
)
from app.api.routes.admin_tenant import TenantBookingSchedule
from app.core.errors import AppError
from app.models.domain import (
    ChatMessageKind,
    Client,
    FormSubmission,
    FormTemplate,
    MembershipRole,
    SubmissionStatus,
    TemplateStatus,
    Tenant,
    TenantFormTemplate,
    Visit,
    VisitStatus,
)
from app.services.booking_schedule import booking_start_allowed, normalize_booking_schedule
from app.services.chat_automation import append_visit_chat_event
from app.services.signature_sms import normalize_phone

router = APIRouter(prefix="/admin/tenants", tags=["admin-visits"])
VIEW_VISITS_ROLES = frozenset(MembershipRole)
MANAGE_VISITS_ROLES = frozenset({MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.STAFF})
VISITS_TIME_ZONE = ZoneInfo("Europe/Warsaw")


class AdminVisitModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AdminVisitResponse(AdminVisitModel):
    id: UUID
    client_id: UUID
    client_name: str = Field(max_length=281)
    client_phone: str | None = Field(default=None, max_length=32)
    treatment_name: str = Field(max_length=250)
    form_code: str | None = Field(default=None, max_length=100)
    form_name: str | None = Field(default=None, max_length=250)
    starts_at: datetime
    ends_at: datetime | None
    status: str = Field(max_length=16)
    form_submitted: bool


class AdminVisitListResponse(AdminVisitModel):
    items: list[AdminVisitResponse] = Field(max_length=2_000)
    date_from: date
    date_to: date
    booking_schedule: TenantBookingSchedule


class AdminVisitNewClientRequest(AdminVisitModel):
    full_name: str = Field(min_length=2, max_length=281)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=320)


class AdminVisitCreateRequest(AdminVisitModel):
    client_id: UUID | None = None
    new_client: AdminVisitNewClientRequest | None = None
    form_code: str = Field(min_length=1, max_length=100)
    starts_at: datetime


class AdminVisitRescheduleRequest(AdminVisitModel):
    starts_at: datetime


def _split_client_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split()
    if len(parts) == 1:
        return parts[0][:120], ""
    return parts[0][:120], " ".join(parts[1:])[:160]


def _normalize_client_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold()).replace("ł", "l")
    return "".join(character for character in normalized if not unicodedata.combining(character))


def _validated_visit_start(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise AppError(
            status_code=422,
            code="visit_time_zone_required",
            message="Visit time zone is required",
        )
    starts_at = value.astimezone(UTC)
    local_start = starts_at.astimezone(VISITS_TIME_ZONE)
    if (
        starts_at <= datetime.now(UTC)
        or local_start.minute % 15 != 0
        or local_start.second != 0
        or local_start.microsecond != 0
    ):
        raise AppError(
            status_code=422,
            code="invalid_visit_time",
            message="Visit time must be in the future on a 15-minute interval",
        )
    return starts_at


def _enforce_booking_schedule(
    tenant: Tenant,
    starts_at: datetime,
    *,
    duration_minutes: int = 60,
) -> None:
    if booking_start_allowed(
        tenant.booking_schedule,
        starts_at,
        duration_minutes=duration_minutes,
    ):
        return
    raise AppError(
        status_code=422,
        code="visit_outside_booking_schedule",
        message="The visit is outside the salon booking schedule",
    )


def _visit_response(
    visit: Visit,
    *,
    client: Client,
    form: FormTemplate,
    form_submitted: bool = False,
) -> AdminVisitResponse:
    return AdminVisitResponse(
        id=visit.id,
        client_id=visit.client_id,
        client_name=f"{client.first_name} {client.last_name}".strip(),
        client_phone=client.phone,
        treatment_name=visit.treatment_name,
        form_code=form.code,
        form_name=form.name,
        starts_at=visit.starts_at,
        ends_at=visit.ends_at,
        status=visit.status,
        form_submitted=form_submitted,
    )


@router.get("/{slug}/visits", response_model=AdminVisitListResponse)
async def list_tenant_visits(
    access: TenantAccessDep,
    session: DbSessionDep,
    date_from: Annotated[date, Query(alias="from")],
    date_to: Annotated[date, Query(alias="to")],
) -> AdminVisitListResponse:
    enforce_roles(access, VIEW_VISITS_ROLES)
    if date_to < date_from or date_to - date_from > timedelta(days=370):
        raise AppError(
            status_code=422,
            code="invalid_date_range",
            message="Visit date range is invalid",
        )
    period_start = datetime.combine(date_from, time.min, tzinfo=VISITS_TIME_ZONE).astimezone(UTC)
    period_end = datetime.combine(
        date_to + timedelta(days=1), time.min, tzinfo=VISITS_TIME_ZONE
    ).astimezone(UTC)
    submitted_exists = exists(
        select(FormSubmission.id).where(
            FormSubmission.tenant_id == Visit.tenant_id,
            FormSubmission.visit_id == Visit.id,
            FormSubmission.status.in_(
                [SubmissionStatus.SUBMITTED.value, SubmissionStatus.SIGNED.value]
            ),
        )
    )
    rows = (
        await session.execute(
            select(
                Visit,
                Client.first_name,
                Client.last_name,
                Client.phone,
                FormTemplate.code.label("form_code"),
                FormTemplate.name.label("form_name"),
                submitted_exists.label("form_submitted"),
            )
            .join(
                Client,
                (Client.tenant_id == Visit.tenant_id) & (Client.id == Visit.client_id),
            )
            .outerjoin(FormTemplate, FormTemplate.id == Visit.form_template_id)
            .where(
                Visit.tenant_id == access.tenant.id,
                Visit.starts_at >= period_start,
                Visit.starts_at < period_end,
            )
            .order_by(Visit.starts_at, Visit.id)
            .limit(2_000)
        )
    ).all()
    return AdminVisitListResponse(
        items=[
            AdminVisitResponse(
                id=row.Visit.id,
                client_id=row.Visit.client_id,
                client_name=f"{row.first_name} {row.last_name}".strip(),
                client_phone=row.phone,
                treatment_name=row.Visit.treatment_name,
                form_code=row.form_code,
                form_name=row.form_name,
                starts_at=row.Visit.starts_at,
                ends_at=row.Visit.ends_at,
                status=row.Visit.status,
                form_submitted=bool(row.form_submitted),
            )
            for row in rows
        ],
        date_from=date_from,
        date_to=date_to,
        booking_schedule=TenantBookingSchedule.model_validate(
            normalize_booking_schedule(access.tenant.booking_schedule)
        ),
    )


@router.post("/{slug}/visits", response_model=AdminVisitResponse, status_code=201)
async def create_tenant_visit(
    access: TenantAccessDep,
    _origin: TrustedOriginDep,
    payload: AdminVisitCreateRequest,
    session: DbSessionDep,
) -> AdminVisitResponse:
    enforce_roles(access, MANAGE_VISITS_ROLES)
    if (payload.client_id is None) == (payload.new_client is None):
        raise AppError(
            status_code=422,
            code="invalid_visit_client",
            message="Choose an existing client or provide a new client",
        )
    starts_at = _validated_visit_start(payload.starts_at)

    tenant = await session.scalar(
        select(Tenant).where(Tenant.id == access.tenant.id).with_for_update()
    )
    form_row = (
        await session.execute(
            select(FormTemplate, TenantFormTemplate.duration_minutes)
            .join(
                TenantFormTemplate,
                TenantFormTemplate.form_template_id == FormTemplate.id,
            )
            .where(
                TenantFormTemplate.tenant_id == access.tenant.id,
                TenantFormTemplate.enabled.is_(True),
                FormTemplate.status == TemplateStatus.ACTIVE.value,
                FormTemplate.code == payload.form_code,
            )
        )
    ).first()
    if form_row is None:
        raise AppError(
            status_code=404,
            code="visit_dependency_not_found",
            message="Client or form was not found",
        )
    form, duration_minutes = form_row
    duration_minutes = int(duration_minutes)
    ends_at = starts_at + timedelta(minutes=duration_minutes)
    _enforce_booking_schedule(
        tenant or access.tenant,
        starts_at,
        duration_minutes=duration_minutes,
    )
    client: Client | None = None
    if payload.client_id is not None:
        client = await session.scalar(
            select(Client).where(
                Client.tenant_id == access.tenant.id,
                Client.id == payload.client_id,
                Client.archived_at.is_(None),
            )
        )
    elif payload.new_client is not None:
        raw_phone = (payload.new_client.phone or "").strip()
        phone_normalized = normalize_phone(raw_phone) if raw_phone else None
        if phone_normalized is not None:
            client = await session.scalar(
                select(Client).where(
                    Client.tenant_id == access.tenant.id,
                    Client.phone_normalized == phone_normalized,
                    Client.archived_at.is_(None),
                )
            )
        if client is None:
            first_name, last_name = _split_client_name(payload.new_client.full_name)
            client = Client(
                tenant_id=access.tenant.id,
                first_name=first_name,
                last_name=last_name,
                first_name_normalized=_normalize_client_name(first_name),
                last_name_normalized=_normalize_client_name(last_name),
                phone=raw_phone or None,
                phone_normalized=phone_normalized,
                email=(payload.new_client.email or "").strip() or None,
            )
            session.add(client)
            await session.flush()
    if client is None:
        raise AppError(
            status_code=404,
            code="visit_dependency_not_found",
            message="Client or form was not found",
        )

    conflicting_visit = await session.scalar(
        select(Visit.id)
        .where(
            Visit.tenant_id == access.tenant.id,
            Visit.status != VisitStatus.CANCELLED.value,
            Visit.starts_at < ends_at,
            or_(
                Visit.ends_at > starts_at,
                (Visit.ends_at.is_(None))
                & (Visit.starts_at >= starts_at - timedelta(minutes=duration_minutes)),
            ),
        )
        .limit(1)
    )
    if conflicting_visit is not None:
        raise AppError(
            status_code=409,
            code="visit_time_unavailable",
            message="The selected visit time is no longer available",
        )

    visit = Visit(
        tenant_id=access.tenant.id,
        client_id=client.id,
        form_template_id=form.id,
        treatment_name=form.name,
        starts_at=starts_at,
        ends_at=ends_at,
        status=VisitStatus.PLANNED.value,
    )
    session.add(visit)
    await session.flush()
    await append_visit_chat_event(
        session,
        tenant=tenant or access.tenant,
        visit=visit,
        client=client,
        kind=ChatMessageKind.VISIT_CREATED,
    )
    return _visit_response(visit, client=client, form=form)


@router.patch(
    "/{slug}/visits/{visit_id}",
    response_model=AdminVisitResponse,
)
async def reschedule_tenant_visit(
    access: TenantAccessDep,
    _origin: TrustedOriginDep,
    visit_id: Annotated[UUID, Path()],
    payload: AdminVisitRescheduleRequest,
    session: DbSessionDep,
) -> AdminVisitResponse:
    enforce_roles(access, MANAGE_VISITS_ROLES)
    starts_at = _validated_visit_start(payload.starts_at)
    tenant = await session.scalar(
        select(Tenant).where(Tenant.id == access.tenant.id).with_for_update()
    )
    visit = await session.scalar(
        select(Visit)
        .where(
            Visit.tenant_id == access.tenant.id,
            Visit.id == visit_id,
            Visit.status == VisitStatus.PLANNED.value,
        )
        .with_for_update()
    )
    if visit is None:
        raise AppError(
            status_code=404,
            code="visit_not_found",
            message="Visit was not found",
        )
    duration = (
        visit.ends_at - visit.starts_at
        if visit.ends_at is not None and visit.ends_at > visit.starts_at
        else timedelta(hours=1)
    )
    ends_at = starts_at + duration
    _enforce_booking_schedule(
        tenant or access.tenant,
        starts_at,
        duration_minutes=max(1, int(duration.total_seconds() // 60)),
    )
    conflicting_visit = await session.scalar(
        select(Visit.id)
        .where(
            Visit.tenant_id == access.tenant.id,
            Visit.id != visit.id,
            Visit.status != VisitStatus.CANCELLED.value,
            Visit.starts_at < ends_at,
            or_(
                Visit.ends_at > starts_at,
                (Visit.ends_at.is_(None)) & (Visit.starts_at >= starts_at - timedelta(hours=1)),
            ),
        )
        .limit(1)
    )
    if conflicting_visit is not None:
        raise AppError(
            status_code=409,
            code="visit_time_unavailable",
            message="The selected visit time is no longer available",
        )
    client = await session.scalar(
        select(Client).where(
            Client.tenant_id == access.tenant.id,
            Client.id == visit.client_id,
        )
    )
    form = await session.scalar(
        select(FormTemplate).where(FormTemplate.id == visit.form_template_id)
    )
    if client is None or form is None:
        raise AppError(
            status_code=404,
            code="visit_dependency_not_found",
            message="Client or form was not found",
        )
    visit.starts_at = starts_at
    visit.ends_at = ends_at
    await session.flush()
    await append_visit_chat_event(
        session,
        tenant=tenant or access.tenant,
        visit=visit,
        client=client,
        kind=ChatMessageKind.VISIT_RESCHEDULED,
    )
    return _visit_response(visit, client=client, form=form)
