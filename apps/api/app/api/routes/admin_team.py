"""Tenant-scoped salon team profiles and reusable practitioner signatures."""

from __future__ import annotations

import base64
import io
from datetime import UTC, datetime, timedelta
from typing import Annotated, cast
from urllib.parse import urlencode
from uuid import UUID

import qrcode
from fastapi import APIRouter, Path, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import select, update

from app.api.dependencies import (
    DbSessionDep,
    SettingsDep,
    TenantAccessDep,
    TrustedOriginDep,
    enforce_roles,
)
from app.core.errors import AppError
from app.core.security import generate_session_token, normalize_email, session_token_digest
from app.models.domain import (
    AuditEvent,
    FormTemplate,
    MembershipRole,
    StaffInvitation,
    TeamMember,
    TemplateStatus,
    TenantFormTemplate,
    TenantMembership,
    User,
)
from app.services.account_email import (
    StaffInvitationEmailDeliveryError,
    send_staff_invitation_email,
)
from app.services.signature_image import (
    SIGNATURE_MAX_CHARS,
    InvalidSignatureImageError,
    decode_signature_png_data_url,
)

router = APIRouter(prefix="/admin/tenants", tags=["admin-team"])

TEAM_READ_ROLES = frozenset(MembershipRole)
TEAM_MANAGE_ROLES = frozenset({MembershipRole.OWNER, MembershipRole.ADMIN})
TeamMemberIdPath = Annotated[UUID, Path()]
NO_STORE_HEADERS = {"Cache-Control": "private, no-store"}
STAFF_INVITATION_TTL_SECONDS = 7 * 24 * 60 * 60


class AdminTeamResponseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class TeamMemberResponse(AdminTeamResponseModel):
    id: UUID
    display_name: str = Field(max_length=200)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=32)
    job_title: str | None = Field(default=None, max_length=160)
    is_owner: bool
    performs_treatments: bool
    all_treatments: bool
    treatment_codes: list[str] = Field(max_length=100)
    is_active: bool
    has_panel_access: bool
    signature_configured: bool
    sms_signing_ready: bool
    signature_updated_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TeamMemberListResponse(AdminTeamResponseModel):
    items: list[TeamMemberResponse] = Field(max_length=250)
    can_manage: bool


class TeamMemberCreateRequest(AdminTeamResponseModel):
    display_name: str = Field(min_length=2, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    job_title: str | None = Field(default=None, max_length=160)
    performs_treatments: bool = True
    all_treatments: bool = True
    treatment_codes: list[str] = Field(default_factory=list, max_length=100)

    @field_validator("display_name", "email", "job_title", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = " ".join(value.strip().split())
        return normalized or None


class TeamMemberUpdateRequest(AdminTeamResponseModel):
    display_name: str = Field(min_length=2, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    job_title: str | None = Field(default=None, max_length=160)
    performs_treatments: bool
    all_treatments: bool
    treatment_codes: list[str] = Field(max_length=100)
    is_active: bool

    @field_validator("display_name", "email", "job_title", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = " ".join(value.strip().split())
        return normalized or None


class TeamMemberSignatureRequest(AdminTeamResponseModel):
    signature: str = Field(min_length=1, max_length=SIGNATURE_MAX_CHARS)


class StaffInvitationCreateRequest(AdminTeamResponseModel):
    email: str = Field(min_length=3, max_length=320)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = normalize_email(value)
        if "@" not in normalized or " " in normalized:
            raise ValueError("A valid e-mail address is required")
        return normalized

class StaffInvitationCreatedResponse(AdminTeamResponseModel):
    id: UUID
    email: str = Field(max_length=320)
    salon_name: str = Field(max_length=200)
    expires_at: datetime
    activation_url: str = Field(max_length=2_048)
    qr_code_data_url: str = Field(max_length=50_000)


def _set_private_no_store(response: Response) -> None:
    response.headers.update(NO_STORE_HEADERS)


def _serialize_member(member: TeamMember) -> TeamMemberResponse:
    return TeamMemberResponse(
        id=member.id,
        display_name=member.display_name,
        email=member.email,
        phone=member.phone,
        job_title=member.job_title,
        is_owner=member.is_owner,
        performs_treatments=member.performs_treatments,
        all_treatments=member.all_treatments if member.all_treatments is not None else True,
        treatment_codes=sorted(set(member.treatment_codes or [])),
        is_active=member.is_active,
        has_panel_access=member.membership_id is not None,
        signature_configured=bool(member.signature_data_url),
        sms_signing_ready=bool(member.membership_id is not None and member.phone_normalized),
        signature_updated_at=member.signature_updated_at,
        created_at=member.created_at,
        updated_at=member.updated_at,
    )


async def _validated_treatment_codes(
    *,
    session: DbSessionDep,
    tenant_id: UUID,
    all_treatments: bool,
    treatment_codes: list[str],
) -> list[str]:
    if all_treatments:
        return []
    normalized = sorted({code.strip().lower() for code in treatment_codes if code.strip()})
    if any(len(code) > 100 for code in normalized):
        raise AppError(
            status_code=422,
            code="invalid_treatment_assignment",
            message="One or more assigned treatments are invalid",
            headers=NO_STORE_HEADERS,
        )
    available = set(
        (
            await session.scalars(
                select(FormTemplate.code)
                .join(
                    TenantFormTemplate,
                    TenantFormTemplate.form_template_id == FormTemplate.id,
                )
                .where(
                    TenantFormTemplate.tenant_id == tenant_id,
                    TenantFormTemplate.enabled.is_(True),
                    FormTemplate.status == TemplateStatus.ACTIVE.value,
                )
            )
        ).all()
    )
    if not set(normalized).issubset(available):
        raise AppError(
            status_code=422,
            code="invalid_treatment_assignment",
            message="One or more assigned treatments are not enabled for this salon",
            headers=NO_STORE_HEADERS,
        )
    return normalized


def _decode_signature(value: str) -> bytes:
    try:
        return decode_signature_png_data_url(value)
    except InvalidSignatureImageError:
        raise _invalid_signature() from None


def _invalid_signature() -> AppError:
    return AppError(
        status_code=422,
        code="invalid_team_member_signature",
        message="Signature must be a valid PNG image",
        headers=NO_STORE_HEADERS,
    )


def _member_not_found() -> AppError:
    return AppError(
        status_code=404,
        code="team_member_not_found",
        message="Team member was not found",
        headers=NO_STORE_HEADERS,
    )


async def _member_for_update(
    session: DbSessionDep,
    tenant_id: UUID,
    member_id: UUID,
) -> TeamMember:
    member = await session.scalar(
        select(TeamMember)
        .where(
            TeamMember.tenant_id == tenant_id,
            TeamMember.id == member_id,
        )
        .with_for_update()
    )
    if member is None:
        raise _member_not_found()
    return member


async def _actor_membership_id(
    session: DbSessionDep,
    access: TenantAccessDep,
) -> UUID | None:
    return cast(
        UUID | None,
        await session.scalar(
            select(TenantMembership.id).where(
                TenantMembership.tenant_id == access.tenant.id,
                TenantMembership.user_id == access.principal.user_id,
                TenantMembership.is_active.is_(True),
            )
        ),
    )


async def _audit(
    *,
    session: DbSessionDep,
    access: TenantAccessDep,
    action: str,
    member: TeamMember,
    details: dict[str, object],
    actor_membership_id: UUID | None = None,
) -> None:
    if actor_membership_id is None:
        actor_membership_id = await _actor_membership_id(session, access)
    session.add(
        AuditEvent(
            tenant_id=access.tenant.id,
            actor_membership_id=actor_membership_id,
            action=action,
            resource_type="team_member",
            resource_id=member.id,
            details=details,
        )
    )


def _enforce_account_managed_personal_data(
    member: TeamMember,
    payload: TeamMemberUpdateRequest,
) -> None:
    if member.membership_id is None:
        return
    if payload.display_name != member.display_name or payload.email != member.email:
        raise AppError(
            status_code=403,
            code="team_member_personal_data_self_managed",
            message="A linked user manages their personal data in their own account",
            headers=NO_STORE_HEADERS,
        )


def _enforce_account_managed_signature(
    member: TeamMember,
) -> None:
    if member.membership_id is not None:
        raise AppError(
            status_code=403,
            code="team_member_signature_self_managed",
            message="A linked user manages their signature in their own account",
            headers=NO_STORE_HEADERS,
        )


@router.get("/{slug}/team", response_model=TeamMemberListResponse)
async def list_team_members(
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> TeamMemberListResponse:
    enforce_roles(access, TEAM_READ_ROLES)
    _set_private_no_store(response)
    members = (
        await session.scalars(
            select(TeamMember)
            .where(TeamMember.tenant_id == access.tenant.id)
            .order_by(
                TeamMember.is_owner.desc(),
                TeamMember.is_active.desc(),
                TeamMember.display_name.asc(),
                TeamMember.id.asc(),
            )
            .limit(250)
        )
    ).all()
    return TeamMemberListResponse(
        items=[_serialize_member(member) for member in members],
        can_manage=access.role in TEAM_MANAGE_ROLES,
    )


@router.post(
    "/{slug}/team",
    response_model=TeamMemberResponse,
    status_code=201,
)
async def create_team_member(
    payload: TeamMemberCreateRequest,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> TeamMemberResponse:
    enforce_roles(access, TEAM_MANAGE_ROLES)
    _set_private_no_store(response)
    treatment_codes = await _validated_treatment_codes(
        session=session,
        tenant_id=access.tenant.id,
        all_treatments=payload.all_treatments,
        treatment_codes=payload.treatment_codes,
    )
    member = TeamMember(
        tenant_id=access.tenant.id,
        display_name=payload.display_name,
        email=payload.email,
        job_title=payload.job_title,
        is_owner=False,
        performs_treatments=payload.performs_treatments,
        all_treatments=payload.all_treatments,
        treatment_codes=treatment_codes,
        is_active=True,
    )
    session.add(member)
    await session.flush()
    await _audit(
        session=session,
        access=access,
        action="team_member.created",
        member=member,
        details={"performsTreatments": member.performs_treatments},
    )
    return _serialize_member(member)


def _qr_code_data_url(value: str) -> str:
    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_Q,
        box_size=12,
        border=4,
    )
    qr.add_data(value)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


@router.post(
    "/{slug}/team/invitations",
    response_model=StaffInvitationCreatedResponse,
    status_code=201,
)
async def invite_staff_member(
    payload: StaffInvitationCreateRequest,
    request: Request,
    _origin: TrustedOriginDep,
    settings: SettingsDep,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> StaffInvitationCreatedResponse:
    enforce_roles(access, TEAM_MANAGE_ROLES)
    _set_private_no_store(response)
    now = datetime.now(UTC)
    normalized_email = normalize_email(payload.email)
    if (
        await session.scalar(select(User.id).where(User.email_normalized == normalized_email))
        is not None
    ):
        raise AppError(
            status_code=409,
            code="staff_email_registered",
            message="This e-mail already belongs to a BeautyDocs account",
            headers=NO_STORE_HEADERS,
        )

    actor_membership_id = await _actor_membership_id(session, access)
    if actor_membership_id is None:
        raise AppError(
            status_code=403,
            code="active_membership_required",
            message="An active salon membership is required",
            headers=NO_STORE_HEADERS,
        )

    # A newly issued invitation invalidates every earlier unused link for the
    # same salon/e-mail pair, so only the newest QR or e-mail can be claimed.
    await session.execute(
        update(StaffInvitation)
        .where(
            StaffInvitation.tenant_id == access.tenant.id,
            StaffInvitation.email_normalized == normalized_email,
            StaffInvitation.accepted_at.is_(None),
            StaffInvitation.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )

    token = generate_session_token()
    invitation = StaffInvitation(
        tenant_id=access.tenant.id,
        invited_by_membership_id=actor_membership_id,
        email=normalized_email,
        email_normalized=normalized_email,
        job_title=None,
        performs_treatments=True,
        token_digest=session_token_digest(token),
        expires_at=now + timedelta(seconds=STAFF_INVITATION_TTL_SECONDS),
    )
    session.add(invitation)
    await session.flush()

    origin = settings.public_web_url or request.headers["origin"].rstrip("/")
    activation_url = f"{origin}/beautydocs-zaproszenie?" + urlencode({"token": token})
    try:
        await send_staff_invitation_email(
            recipient_email=normalized_email,
            salon_name=access.tenant.display_name,
            activation_url=activation_url,
            expires_in_seconds=STAFF_INVITATION_TTL_SECONDS,
            settings=settings,
        )
    except StaffInvitationEmailDeliveryError as exc:
        raise AppError(
            status_code=503,
            code="staff_invitation_email_unavailable",
            message="Staff invitation e-mail could not be sent",
            headers=NO_STORE_HEADERS,
        ) from exc

    session.add(
        AuditEvent(
            tenant_id=access.tenant.id,
            actor_membership_id=actor_membership_id,
            action="staff_invitation.created",
            resource_type="staff_invitation",
            resource_id=invitation.id,
            details={"email": normalized_email},
        )
    )
    return StaffInvitationCreatedResponse(
        id=invitation.id,
        email=invitation.email,
        salon_name=access.tenant.display_name,
        expires_at=invitation.expires_at,
        activation_url=activation_url,
        qr_code_data_url=_qr_code_data_url(activation_url),
    )


@router.get(
    "/{slug}/team/{member_id}",
    response_model=TeamMemberResponse,
)
async def get_team_member(
    member_id: TeamMemberIdPath,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> TeamMemberResponse:
    enforce_roles(access, TEAM_READ_ROLES)
    _set_private_no_store(response)
    member = await session.scalar(
        select(TeamMember).where(
            TeamMember.tenant_id == access.tenant.id,
            TeamMember.id == member_id,
        )
    )
    if member is None:
        raise _member_not_found()
    return _serialize_member(member)


@router.put(
    "/{slug}/team/{member_id}",
    response_model=TeamMemberResponse,
)
async def update_team_member(
    member_id: TeamMemberIdPath,
    payload: TeamMemberUpdateRequest,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> TeamMemberResponse:
    enforce_roles(access, TEAM_MANAGE_ROLES)
    _set_private_no_store(response)
    member = await _member_for_update(session, access.tenant.id, member_id)
    if member.is_owner and not payload.is_active:
        raise AppError(
            status_code=422,
            code="owner_profile_must_remain_active",
            message="The owner profile cannot be deactivated",
            headers=NO_STORE_HEADERS,
        )
    _enforce_account_managed_personal_data(member, payload)
    if member.membership_id is None:
        member.display_name = payload.display_name
        member.email = payload.email
    member.job_title = payload.job_title
    member.performs_treatments = payload.performs_treatments
    member.all_treatments = payload.all_treatments
    member.treatment_codes = await _validated_treatment_codes(
        session=session,
        tenant_id=access.tenant.id,
        all_treatments=payload.all_treatments,
        treatment_codes=payload.treatment_codes,
    )
    member.is_active = payload.is_active
    await _audit(
        session=session,
        access=access,
        action="team_member.updated",
        member=member,
        details={
            "performsTreatments": member.performs_treatments,
            "allTreatments": member.all_treatments,
            "treatmentCodes": member.treatment_codes,
            "isActive": member.is_active,
        },
    )
    await session.flush()
    await session.refresh(member)
    return _serialize_member(member)


@router.put(
    "/{slug}/team/{member_id}/signature",
    response_model=TeamMemberResponse,
)
async def set_team_member_signature(
    member_id: TeamMemberIdPath,
    payload: TeamMemberSignatureRequest,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> TeamMemberResponse:
    enforce_roles(access, TEAM_MANAGE_ROLES)
    _set_private_no_store(response)
    _decode_signature(payload.signature)
    member = await _member_for_update(session, access.tenant.id, member_id)
    _enforce_account_managed_signature(member)
    actor_membership_id = await _actor_membership_id(session, access)
    member.signature_data_url = payload.signature
    member.signature_updated_at = datetime.now(UTC)
    await _audit(
        session=session,
        access=access,
        action="team_member.signature_updated",
        member=member,
        details={"signatureConfigured": True},
        actor_membership_id=actor_membership_id,
    )
    await session.flush()
    await session.refresh(member)
    return _serialize_member(member)


@router.delete(
    "/{slug}/team/{member_id}/signature",
    status_code=204,
)
async def delete_team_member_signature(
    member_id: TeamMemberIdPath,
    access: TenantAccessDep,
    session: DbSessionDep,
    response: Response,
) -> Response:
    enforce_roles(access, TEAM_MANAGE_ROLES)
    member = await _member_for_update(session, access.tenant.id, member_id)
    _enforce_account_managed_signature(member)
    actor_membership_id = await _actor_membership_id(session, access)
    member.signature_data_url = None
    member.signature_updated_at = None
    await _audit(
        session=session,
        access=access,
        action="team_member.signature_removed",
        member=member,
        details={"signatureConfigured": False},
        actor_membership_id=actor_membership_id,
    )
    await session.flush()
    response.status_code = 204
    _set_private_no_store(response)
    return response


@router.get("/{slug}/team/{member_id}/signature")
async def get_team_member_signature(
    member_id: TeamMemberIdPath,
    access: TenantAccessDep,
    session: DbSessionDep,
) -> Response:
    enforce_roles(access, TEAM_READ_ROLES)
    signature = await session.scalar(
        select(TeamMember.signature_data_url).where(
            TeamMember.tenant_id == access.tenant.id,
            TeamMember.id == member_id,
        )
    )
    if not isinstance(signature, str):
        raise _member_not_found()
    try:
        payload = _decode_signature(signature)
    except AppError:
        raise _member_not_found() from None
    return Response(
        content=payload,
        media_type="image/png",
        headers={
            **NO_STORE_HEADERS,
            "Content-Disposition": 'inline; filename="signature.png"',
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )
