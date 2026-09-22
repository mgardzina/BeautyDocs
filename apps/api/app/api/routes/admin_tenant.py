from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import func, select

from app.api.dependencies import (
    DbSessionDep,
    SettingsDep,
    TenantAccessDep,
    TrustedOriginDep,
    enforce_roles,
)
from app.core.errors import AppError
from app.models.domain import (
    AuditEvent,
    Client,
    ConsumerAccount,
    FormSubmission,
    FormTemplate,
    FormTemplateVersion,
    MembershipRole,
    SubmissionStatus,
    TemplateStatus,
    TenantFormTemplate,
    TenantMembership,
    TenantStatus,
    Visit,
)
from app.services.booking_schedule import (
    BOOKING_DURATION_MINUTES,
    clock_minutes,
    normalize_booking_schedule,
)
from app.services.check_in_token import CheckInTokenError, verify_check_in_token
from app.services.logo_image import InvalidLogoImageError, validate_logo_data_url
from app.services.polish_nip import is_valid_polish_nip, normalize_polish_nip
from app.services.salon_profile import SalonProfile

router = APIRouter(prefix="/admin/tenants", tags=["admin-tenants"])
OVERVIEW_ROLES = frozenset(MembershipRole)
SETTINGS_MANAGE_ROLES = frozenset({MembershipRole.OWNER, MembershipRole.ADMIN})
SETTINGS_DELETE_ROLES = frozenset({MembershipRole.OWNER})
NO_STORE_HEADERS = {"Cache-Control": "private, no-store"}


class AdminResponseModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class OverviewTenantResponse(AdminResponseModel):
    slug: str = Field(max_length=63)
    display_name: str = Field(max_length=200)
    legal_name: str = Field(max_length=250)


class OverviewMembershipResponse(AdminResponseModel):
    role: MembershipRole


class OverviewStatsResponse(AdminResponseModel):
    clients_count: int = Field(ge=0)
    active_forms_count: int = Field(ge=0)
    form_submissions_count: int = Field(ge=0)
    signed_form_submissions_count: int = Field(ge=0)


class OverviewCapabilitiesResponse(AdminResponseModel):
    can_view_clients: bool
    can_manage_clients: bool
    can_manage_forms: bool
    can_manage_members: bool


class TenantBookingDay(AdminResponseModel):
    weekday: int = Field(ge=0, le=6)
    enabled: bool
    opens_at: str = Field(pattern=r"^\d{2}:\d{2}$")
    closes_at: str = Field(pattern=r"^\d{2}:\d{2}$")

    @model_validator(mode="after")
    def validate_hours(self) -> TenantBookingDay:
        opens_minutes = clock_minutes(self.opens_at)
        closes_minutes = clock_minutes(self.closes_at)
        if (
            opens_minutes is None
            or closes_minutes is None
            or closes_minutes - opens_minutes < BOOKING_DURATION_MINUTES
        ):
            raise ValueError("Working hours must contain at least one appointment")
        return self


class TenantBookingSchedule(AdminResponseModel):
    slot_interval_minutes: Literal[15, 30, 60] = 60
    days: list[TenantBookingDay] = Field(min_length=7, max_length=7)

    @model_validator(mode="after")
    def validate_days(self) -> TenantBookingSchedule:
        if sorted(day.weekday for day in self.days) != list(range(7)):
            raise ValueError("Exactly one working-hours entry is required for every weekday")
        return self


class TenantOverviewResponse(AdminResponseModel):
    tenant: OverviewTenantResponse
    membership: OverviewMembershipResponse
    stats: OverviewStatsResponse
    capabilities: OverviewCapabilitiesResponse


class TenantSettingsResponse(AdminResponseModel):
    slug: str = Field(max_length=63)
    display_name: str = Field(max_length=200)
    legal_name: str = Field(max_length=250)
    nip: str | None = Field(default=None, max_length=20)
    regon: str | None = Field(default=None, max_length=14)
    krs: str | None = Field(default=None, max_length=10)
    email: str = Field(max_length=320)
    privacy_contact_email: str = Field(max_length=320)
    phone: str | None = Field(default=None, max_length=32)
    website_url: str | None = Field(default=None, max_length=2048)
    logo_image: str | None = Field(default=None, max_length=320_000)
    address_line1: str | None = Field(default=None, max_length=250)
    address_line2: str | None = Field(default=None, max_length=250)
    postal_code: str | None = Field(default=None, max_length=20)
    city: str | None = Field(default=None, max_length=120)
    country_code: str = Field(max_length=2)
    directory_visible: bool
    booking_schedule: TenantBookingSchedule
    role: MembershipRole
    can_edit: bool
    can_delete: bool


class TenantSettingsUpdateRequest(AdminResponseModel):
    display_name: str = Field(min_length=2, max_length=200)
    legal_name: str = Field(min_length=2, max_length=250)
    nip: str | None = Field(default=None, max_length=20)
    regon: str | None = Field(default=None, max_length=14)
    krs: str | None = Field(default=None, max_length=10)
    email: str = Field(min_length=3, max_length=320)
    privacy_contact_email: str = Field(min_length=3, max_length=320)
    phone: str | None = Field(default=None, max_length=32)
    website_url: str | None = Field(default=None, max_length=2048)
    address_line1: str | None = Field(default=None, max_length=250)
    address_line2: str | None = Field(default=None, max_length=250)
    postal_code: str | None = Field(default=None, max_length=20)
    city: str | None = Field(default=None, max_length=120)
    directory_visible: bool = True
    booking_schedule: TenantBookingSchedule | None = None

    @field_validator("nip")
    @classmethod
    def validate_nip(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = normalize_polish_nip(value)
        if not is_valid_polish_nip(normalized):
            raise ValueError("NIP must contain 10 digits and have a valid checksum")
        return normalized


class DeleteTenantRequest(AdminResponseModel):
    confirmation: Literal["USUŃ SALON"]


def _capabilities(role: MembershipRole) -> OverviewCapabilitiesResponse:
    is_management = role in {MembershipRole.OWNER, MembershipRole.ADMIN}
    can_manage_clients = is_management or role is MembershipRole.STAFF
    return OverviewCapabilitiesResponse(
        can_view_clients=True,
        can_manage_clients=can_manage_clients,
        can_manage_forms=is_management,
        can_manage_members=is_management,
    )


def _tenant_settings(access: TenantAccessDep) -> TenantSettingsResponse:
    tenant = access.tenant
    return TenantSettingsResponse(
        slug=tenant.slug,
        display_name=tenant.display_name,
        legal_name=tenant.legal_name,
        nip=tenant.nip,
        regon=tenant.regon,
        krs=tenant.krs,
        email=tenant.email,
        privacy_contact_email=tenant.privacy_contact_email,
        phone=tenant.phone,
        website_url=tenant.website_url,
        logo_image=tenant.logo_image,
        address_line1=tenant.address_line1,
        address_line2=tenant.address_line2,
        postal_code=tenant.postal_code,
        city=tenant.city,
        country_code=tenant.country_code,
        directory_visible=bool(tenant.directory_visible),
        booking_schedule=TenantBookingSchedule.model_validate(
            normalize_booking_schedule(tenant.booking_schedule)
        ),
        role=access.role,
        can_edit=access.role in SETTINGS_MANAGE_ROLES,
        can_delete=access.role in SETTINGS_DELETE_ROLES,
    )


def _optional(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.strip().split())
    return normalized or None


@router.get("/{slug}/overview", response_model=TenantOverviewResponse)
async def tenant_overview(
    access: TenantAccessDep,
    session: DbSessionDep,
) -> TenantOverviewResponse:
    enforce_roles(access, OVERVIEW_ROLES)
    tenant_id = access.tenant.id

    clients_count = await session.scalar(
        select(func.count()).select_from(Client).where(Client.tenant_id == tenant_id)
    )
    form_submissions_count = await session.scalar(
        select(func.count())
        .select_from(FormSubmission)
        .where(FormSubmission.tenant_id == tenant_id)
    )
    signed_form_submissions_count = await session.scalar(
        select(func.count())
        .select_from(FormSubmission)
        .where(
            FormSubmission.tenant_id == tenant_id,
            FormSubmission.status == SubmissionStatus.SIGNED.value,
        )
    )
    active_forms_count = await session.scalar(
        select(func.count())
        .select_from(TenantFormTemplate)
        .join(
            FormTemplate,
            FormTemplate.id == TenantFormTemplate.form_template_id,
        )
        .where(
            TenantFormTemplate.tenant_id == tenant_id,
            TenantFormTemplate.enabled.is_(True),
            FormTemplate.status == TemplateStatus.ACTIVE.value,
        )
    )

    return TenantOverviewResponse(
        tenant=OverviewTenantResponse(
            slug=access.tenant.slug,
            display_name=access.tenant.display_name,
            legal_name=access.tenant.legal_name,
        ),
        membership=OverviewMembershipResponse(role=access.role),
        stats=OverviewStatsResponse(
            clients_count=clients_count or 0,
            active_forms_count=active_forms_count or 0,
            form_submissions_count=form_submissions_count or 0,
            signed_form_submissions_count=signed_form_submissions_count or 0,
        ),
        capabilities=_capabilities(access.role),
    )


class AnalyticsWeekPoint(AdminResponseModel):
    week_start: date
    visits: int = Field(ge=0)
    new_clients: int = Field(ge=0)
    submissions: int = Field(ge=0)


class AnalyticsTreatment(AdminResponseModel):
    label: str = Field(max_length=250)
    count: int = Field(ge=0)


class TenantAnalyticsResponse(AdminResponseModel):
    weeks: list[AnalyticsWeekPoint]
    treatments: list[AnalyticsTreatment]


_ANALYTICS_WEEKS = 12


@router.get("/{slug}/overview/analytics", response_model=TenantAnalyticsResponse)
async def tenant_analytics(
    access: TenantAccessDep,
    session: DbSessionDep,
) -> TenantAnalyticsResponse:
    enforce_roles(access, OVERVIEW_ROLES)
    tenant_id = access.tenant.id

    now = datetime.now(UTC)
    current_monday = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    cutoff = current_monday - timedelta(weeks=_ANALYTICS_WEEKS - 1)

    async def _weekly(time_column, table) -> dict[date, int]:
        bucket = func.date_trunc("week", time_column)
        rows = (
            await session.execute(
                select(bucket, func.count())
                .select_from(table)
                .where(table.tenant_id == tenant_id, time_column >= cutoff)
                .group_by(bucket)
            )
        ).all()
        return {row[0].date(): int(row[1]) for row in rows}

    visits_by_week = await _weekly(Visit.starts_at, Visit)
    clients_by_week = await _weekly(Client.created_at, Client)
    submissions_by_week = await _weekly(FormSubmission.created_at, FormSubmission)

    weeks = [
        AnalyticsWeekPoint(
            week_start=(bucket_date := (cutoff + timedelta(weeks=index)).date()),
            visits=visits_by_week.get(bucket_date, 0),
            new_clients=clients_by_week.get(bucket_date, 0),
            submissions=submissions_by_week.get(bucket_date, 0),
        )
        for index in range(_ANALYTICS_WEEKS)
    ]

    treatment_rows = (
        await session.execute(
            select(FormTemplate.name, func.count())
            .select_from(FormSubmission)
            .join(
                FormTemplateVersion,
                FormTemplateVersion.id == FormSubmission.form_template_version_id,
            )
            .join(
                FormTemplate,
                FormTemplate.id == FormTemplateVersion.form_template_id,
            )
            .where(FormSubmission.tenant_id == tenant_id)
            .group_by(FormTemplate.name)
            .order_by(func.count().desc())
            .limit(8)
        )
    ).all()
    treatments = [
        AnalyticsTreatment(label=name, count=int(count))
        for name, count in treatment_rows
    ]

    return TenantAnalyticsResponse(weeks=weeks, treatments=treatments)


class CheckInResolveRequest(AdminResponseModel):
    token: str = Field(min_length=10, max_length=2048)


class CheckInConsumer(AdminResponseModel):
    full_name: str
    phone: str | None
    email: str | None


class CheckInClient(AdminResponseModel):
    id: UUID
    first_name: str
    last_name: str
    phone: str | None


class CheckInResolveResponse(AdminResponseModel):
    consumer: CheckInConsumer
    client: CheckInClient | None


@router.post("/{slug}/check-in/resolve", response_model=CheckInResolveResponse)
async def resolve_check_in(
    payload: CheckInResolveRequest,
    _origin: TrustedOriginDep,
    access: TenantAccessDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> CheckInResolveResponse:
    enforce_roles(access, OVERVIEW_ROLES)
    key = settings.check_in_signing_key
    if key is None:
        raise AppError(
            status_code=503,
            code="check_in_not_configured",
            message="Check-in QR is not configured",
            headers={"Cache-Control": "no-store"},
        )
    try:
        consumer_id = verify_check_in_token(
            token=payload.token, key=key.get_secret_value()
        )
    except CheckInTokenError:
        raise AppError(
            status_code=401,
            code="invalid_check_in_token",
            message="Check-in code is invalid or expired",
            headers={"Cache-Control": "no-store"},
        ) from None

    consumer = await session.get(ConsumerAccount, consumer_id)
    if consumer is None:
        raise AppError(
            status_code=404,
            code="consumer_not_found",
            message="Client account not found",
            headers={"Cache-Control": "no-store"},
        )

    client = None
    if consumer.phone_normalized:
        client = await session.scalar(
            select(Client).where(
                Client.tenant_id == access.tenant.id,
                Client.phone_normalized == consumer.phone_normalized,
                Client.archived_at.is_(None),
            )
        )

    return CheckInResolveResponse(
        consumer=CheckInConsumer(
            full_name=consumer.full_name,
            phone=consumer.phone,
            email=consumer.email,
        ),
        client=(
            CheckInClient(
                id=client.id,
                first_name=client.first_name,
                last_name=client.last_name,
                phone=client.phone,
            )
            if client is not None
            else None
        ),
    )


@router.get("/{slug}/settings", response_model=TenantSettingsResponse)
async def tenant_settings(
    access: TenantAccessDep,
    response: Response,
) -> TenantSettingsResponse:
    enforce_roles(access, OVERVIEW_ROLES)
    response.headers.update(NO_STORE_HEADERS)
    return _tenant_settings(access)


@router.put("/{slug}/settings", response_model=TenantSettingsResponse)
async def update_tenant_settings(
    payload: TenantSettingsUpdateRequest,
    _origin: TrustedOriginDep,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> TenantSettingsResponse:
    enforce_roles(access, SETTINGS_MANAGE_ROLES)
    tenant = access.tenant
    tenant.display_name = " ".join(payload.display_name.strip().split())
    # The legal company name, like NIP/REGON/KRS below, is locked once set —
    # only the display name shown in the app can change afterward.
    if not tenant.legal_name:
        tenant.legal_name = " ".join(payload.legal_name.strip().split())
    # NIP, REGON and KRS are validated once at registration and virtually
    # never change afterward, so once set they are locked from further
    # edits here (defense in depth — the settings UI already disables
    # these fields once a value exists).
    if tenant.nip is None:
        tenant.nip = _optional(payload.nip)
    if tenant.regon is None:
        tenant.regon = _optional(payload.regon)
    if tenant.krs is None:
        tenant.krs = _optional(payload.krs)
    tenant.email = payload.email.strip().lower()
    tenant.privacy_contact_email = payload.privacy_contact_email.strip().lower()
    tenant.phone = _optional(payload.phone)
    tenant.website_url = _optional(payload.website_url)
    tenant.address_line1 = _optional(payload.address_line1)
    tenant.address_line2 = _optional(payload.address_line2)
    tenant.postal_code = _optional(payload.postal_code)
    tenant.city = _optional(payload.city)
    tenant.directory_visible = payload.directory_visible
    if payload.booking_schedule is not None:
        tenant.booking_schedule = payload.booking_schedule.model_dump(by_alias=True)
    await session.flush()
    response.headers.update(NO_STORE_HEADERS)
    return _tenant_settings(access)


class TenantLogoUpdateRequest(AdminResponseModel):
    data_url: str | None = Field(default=None, max_length=320_000)


@router.put("/{slug}/logo", response_model=TenantSettingsResponse)
async def update_tenant_logo(
    payload: TenantLogoUpdateRequest,
    _origin: TrustedOriginDep,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> TenantSettingsResponse:
    enforce_roles(access, SETTINGS_MANAGE_ROLES)
    tenant = access.tenant
    if payload.data_url is None:
        tenant.logo_image = None
    else:
        try:
            tenant.logo_image = validate_logo_data_url(payload.data_url)
        except InvalidLogoImageError:
            raise AppError(
                status_code=422,
                code="invalid_logo",
                message="Logo must be a small PNG, JPEG, or WebP image",
                headers=NO_STORE_HEADERS,
            ) from None
    await session.flush()
    response.headers.update(NO_STORE_HEADERS)
    return _tenant_settings(access)


@router.delete("/{slug}", status_code=204, response_class=Response)
async def delete_tenant(
    payload: DeleteTenantRequest,
    _origin: TrustedOriginDep,
    access: TenantAccessDep,
    session: DbSessionDep,
) -> Response:
    """Close a salon immediately while retaining records subject to retention."""

    del payload
    enforce_roles(access, SETTINGS_DELETE_ROLES)
    membership_id = await session.scalar(
        select(TenantMembership.id).where(
            TenantMembership.tenant_id == access.tenant.id,
            TenantMembership.user_id == access.principal.user_id,
            TenantMembership.is_active.is_(True),
        )
    )
    now = datetime.now(UTC)
    access.tenant.status = TenantStatus.ARCHIVED.value
    access.tenant.deletion_requested_at = now
    session.add(
        AuditEvent(
            tenant_id=access.tenant.id,
            actor_membership_id=membership_id,
            action="tenant.deletion_requested",
            resource_type="tenant",
            resource_id=access.tenant.id,
            details={"retentionReviewRequired": True},
            occurred_at=now,
        )
    )
    await session.flush()
    return Response(status_code=204, headers=NO_STORE_HEADERS)


@router.get("/{slug}/profile")
async def read_salon_profile(access: TenantAccessDep, response: Response) -> dict:
    enforce_roles(access, OVERVIEW_ROLES)
    response.headers.update(NO_STORE_HEADERS)
    return access.tenant.public_profile or SalonProfile().model_dump(by_alias=True)


@router.put("/{slug}/profile")
async def update_salon_profile(
    payload: SalonProfile, _origin: TrustedOriginDep, access: TenantAccessDep,
    session: DbSessionDep, response: Response,
) -> dict:
    enforce_roles(access, SETTINGS_MANAGE_ROLES)
    access.tenant.public_profile = payload.model_dump(by_alias=True)
    await session.flush()
    response.headers.update(NO_STORE_HEADERS)
    return {"saved": True}
