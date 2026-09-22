from __future__ import annotations

import logging
import re
import secrets
import unicodedata
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID

from anyio import to_thread
from fastapi import APIRouter, Path, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    CurrentUserDep,
    DbSessionDep,
    SettingsDep,
    TrustedOriginDep,
)
from app.api.routes.auth import (
    AuthStateResponse,
    MfaLoginChallengeResponse,
    _load_memberships,
)
from app.core.errors import AppError, error_response
from app.core.security import (
    generate_session_token,
    generate_verification_code,
    hash_password,
    is_valid_session_token,
    normalize_email,
    session_token_digest,
    verification_code_digest,
)
from app.db.tenant_context import (
    set_tenant_context,
    set_user_context,
)
from app.models.domain import (
    AuditEvent,
    AuthSession,
    MembershipRole,
    MfaChallengePurpose,
    MfaMethod,
    OwnerRegistration,
    StaffInvitation,
    TeamMember,
    Tenant,
    TenantMembership,
    TenantStatus,
    User,
    UserGoogleIdentity,
)
from app.services.account_email import (
    VerificationEmailDeliveryError,
    send_account_verification_email,
)
from app.services.account_mfa import clear_mfa, issue_mfa_challenge, mfa_enabled
from app.services.google_identity import (
    GoogleIdentityVerificationError,
    VerifiedGoogleIdentity,
    resolve_google_identity,
)
from app.services.polish_nip import is_valid_polish_nip, normalize_polish_nip
from app.services.regon_registry import (
    RegonRegistryNotConfiguredError,
    RegonRegistryNotFoundError,
    RegonRegistryUnavailableError,
    lookup_company_by_nip,
)
from app.services.signature_image import (
    SIGNATURE_MAX_CHARS,
    InvalidSignatureImageError,
    decode_signature_png_data_url,
)
from app.services.signature_sms import normalize_phone
from app.services.staff_sessions import open_staff_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

VERIFICATION_TTL_SECONDS = 15 * 60
VERIFICATION_MAX_ATTEMPTS = 6
# How long the verified e-mail can be finalized (name/password/company step)
# before the one-time completion token expires.
REGISTRATION_COMPLETION_TTL_SECONDS = 30 * 60

_POLISH = str.maketrans(
    {
        "ą": "a",
        "ć": "c",
        "ę": "e",
        "ł": "l",
        "ń": "n",
        "ó": "o",
        "ś": "s",
        "ż": "z",
        "ź": "z",
    }
)


class RegistrationModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RegisterRequest(RegistrationModel):
    """E-mail-first sign-up start.

    Only the e-mail is captured here; name, password and company data are
    collected on the finalize step after the e-mail has been verified.
    """

    email: str = Field(min_length=3, max_length=320)


class RegisterResponse(RegistrationModel):
    email: str = Field(max_length=320)
    expires_in_seconds: int
    # Only populated outside staging/production so the flow is testable without
    # a real SMS/e-mail provider. Never returned in production.
    dev_code: str | None = None


class GoogleLoginConfigResponse(RegistrationModel):
    enabled: bool
    client_id: str | None


class GoogleStaffRegistrationRequest(RegistrationModel):
    credential: str | None = Field(default=None, min_length=20, max_length=8_192)
    access_token: str | None = Field(default=None, min_length=20, max_length=8_192)


class GoogleOwnerRegistrationRequest(RegistrationModel):
    credential: str | None = Field(default=None, min_length=20, max_length=8_192)
    access_token: str | None = Field(default=None, min_length=20, max_length=8_192)
    salon_name: str = Field(min_length=1, max_length=200)
    # Optional override for the name Google reports; falls back to the verified
    # Google profile name when omitted.
    full_name: str | None = Field(default=None, max_length=200)


class StaffInvitationResponse(RegistrationModel):
    email: str = Field(max_length=320)
    salon_name: str = Field(max_length=200)
    expires_at: datetime


class StaffInvitationAcceptRequest(RegistrationModel):
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=8, max_length=1024)

    @field_validator("full_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = " ".join(value.strip().split())
        if len(normalized) < 2:
            raise ValueError("Full name is required")
        return normalized


class VerifyRequest(RegistrationModel):
    email: str = Field(min_length=3, max_length=320)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class VerifyResponse(RegistrationModel):
    email: str = Field(max_length=320)
    # One-time token that authorizes the finalize (complete) step. The browser
    # holds it between verification and account creation; it is never a session.
    registration_token: str = Field(max_length=128)


class CompleteRequest(RegistrationModel):
    """Finalize an e-mail-verified sign-up.

    Personal data, password and company data are captured together on the
    post-verification card, then the account, salon and owner membership are
    created and the owner is logged in.
    """

    registration_token: str = Field(min_length=16, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    salon_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=1024)
    nip: str = Field(min_length=10, max_length=20)
    regon: str | None = Field(default=None, max_length=14)
    krs: str | None = Field(default=None, max_length=10)
    company_name: str = Field(min_length=1, max_length=250)
    street: str = Field(min_length=1, max_length=250)
    postal_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{2}-\d{3}$")
    city: str = Field(min_length=1, max_length=120)

    @field_validator("full_name", "salon_name")
    @classmethod
    def strip_required_identity_text(cls, value: str) -> str:
        normalized = " ".join(value.strip().split())
        if not normalized:
            raise ValueError("Field cannot be empty")
        return normalized

    @field_validator("nip")
    @classmethod
    def validate_nip(cls, value: str) -> str:
        normalized = normalize_polish_nip(value)
        if not is_valid_polish_nip(normalized):
            raise ValueError("NIP must contain 10 digits and have a valid checksum")
        return normalized

    @field_validator("regon")
    @classmethod
    def validate_regon(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = re.sub(r"\D", "", value)
        if len(normalized) not in {9, 14}:
            raise ValueError("REGON must contain 9 or 14 digits")
        return normalized

    @field_validator("krs")
    @classmethod
    def validate_krs(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = re.sub(r"\D", "", value)
        if len(normalized) != 10:
            raise ValueError("KRS must contain 10 digits")
        return normalized

    @field_validator("company_name", "street", "city")
    @classmethod
    def strip_required_company_text(cls, value: str) -> str:
        normalized = " ".join(value.strip().split())
        if not normalized:
            raise ValueError("Field cannot be empty")
        return normalized


class ConfigureRequest(RegistrationModel):
    """Company data update for an authenticated owner.

    Used by the Google sign-up path, where ``google/register-owner`` already
    created the account and salon and the owner then fills in company data.
    The e-mail path captures the same fields inside :class:`CompleteRequest`.
    """

    nip: str = Field(min_length=10, max_length=20)
    regon: str | None = Field(default=None, max_length=14)
    krs: str | None = Field(default=None, max_length=10)
    company_name: str = Field(min_length=1, max_length=250)
    street: str = Field(min_length=1, max_length=250)
    postal_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{2}-\d{3}$")
    city: str = Field(min_length=1, max_length=120)

    @field_validator("nip")
    @classmethod
    def validate_nip(cls, value: str) -> str:
        normalized = normalize_polish_nip(value)
        if not is_valid_polish_nip(normalized):
            raise ValueError("NIP must contain 10 digits and have a valid checksum")
        return normalized

    @field_validator("regon")
    @classmethod
    def validate_regon(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = re.sub(r"\D", "", value)
        if len(normalized) not in {9, 14}:
            raise ValueError("REGON must contain 9 or 14 digits")
        return normalized

    @field_validator("krs")
    @classmethod
    def validate_krs(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = re.sub(r"\D", "", value)
        if len(normalized) != 10:
            raise ValueError("KRS must contain 10 digits")
        return normalized

    @field_validator("company_name", "street", "city")
    @classmethod
    def strip_required_company_text(cls, value: str) -> str:
        normalized = " ".join(value.strip().split())
        if not normalized:
            raise ValueError("Field cannot be empty")
        return normalized


class CreateSalonRequest(RegistrationModel):
    """Add a second (or third, ...) salon under an already-authenticated owner.

    Mirrors the salon + company fields captured by :class:`CompleteRequest`,
    minus the identity fields (name, password) the owner already has.
    """

    salon_name: str = Field(min_length=1, max_length=200)
    nip: str = Field(min_length=10, max_length=20)
    regon: str | None = Field(default=None, max_length=14)
    krs: str | None = Field(default=None, max_length=10)
    company_name: str = Field(min_length=1, max_length=250)
    street: str = Field(min_length=1, max_length=250)
    postal_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{2}-\d{3}$")
    city: str = Field(min_length=1, max_length=120)

    @field_validator("salon_name")
    @classmethod
    def strip_salon_name(cls, value: str) -> str:
        normalized = " ".join(value.strip().split())
        if not normalized:
            raise ValueError("Field cannot be empty")
        return normalized

    @field_validator("nip")
    @classmethod
    def validate_nip(cls, value: str) -> str:
        normalized = normalize_polish_nip(value)
        if not is_valid_polish_nip(normalized):
            raise ValueError("NIP must contain 10 digits and have a valid checksum")
        return normalized

    @field_validator("regon")
    @classmethod
    def validate_regon(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = re.sub(r"\D", "", value)
        if len(normalized) not in {9, 14}:
            raise ValueError("REGON must contain 9 or 14 digits")
        return normalized

    @field_validator("krs")
    @classmethod
    def validate_krs(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = re.sub(r"\D", "", value)
        if len(normalized) != 10:
            raise ValueError("KRS must contain 10 digits")
        return normalized

    @field_validator("company_name", "street", "city")
    @classmethod
    def strip_required_company_text(cls, value: str) -> str:
        normalized = " ".join(value.strip().split())
        if not normalized:
            raise ValueError("Field cannot be empty")
        return normalized


class CreateSalonResponse(RegistrationModel):
    tenant_slug: str = Field(max_length=200)
    tenant_display_name: str = Field(max_length=200)


class CompanyLookupRequest(RegistrationModel):
    nip: str = Field(min_length=10, max_length=20)

    @field_validator("nip")
    @classmethod
    def validate_nip(cls, value: str) -> str:
        normalized = normalize_polish_nip(value)
        if not is_valid_polish_nip(normalized):
            raise ValueError("NIP must contain 10 digits and have a valid checksum")
        return normalized


class CompanyLookupResponse(RegistrationModel):
    nip: str = Field(min_length=10, max_length=10)
    regon: str = Field(max_length=14)
    krs: str | None = Field(default=None, max_length=10)
    company_name: str = Field(max_length=250)
    street: str = Field(max_length=250)
    postal_code: str = Field(max_length=20)
    city: str = Field(max_length=120)
    status_nip: str | None = Field(default=None, max_length=120)
    activity_ended_at: str | None = Field(default=None, max_length=32)


class UserProfileResponse(RegistrationModel):
    display_name: str = Field(max_length=200)
    email: str = Field(max_length=320)
    phone: str | None = Field(default=None, max_length=32)
    email_verified_at: datetime | None
    created_at: datetime
    last_login_at: datetime | None
    signature_configured: bool
    signature_updated_at: datetime | None


class UserProfileUpdateRequest(RegistrationModel):
    display_name: str = Field(min_length=2, max_length=200)
    phone: str | None = Field(default=None, max_length=32)


class ChangeUserPasswordRequest(RegistrationModel):
    new_password: str = Field(min_length=8, max_length=1024)


class DeleteUserAccountRequest(RegistrationModel):
    confirmation: Literal["USUŃ KONTO"]


class UserSignatureRequest(RegistrationModel):
    signature: str = Field(min_length=1, max_length=SIGNATURE_MAX_CHARS)


def _slugify(name: str) -> str:
    # Map Polish letters that do not decompose (ł, etc.), then strip the
    # remaining accents via Unicode normalization (é, è, ñ …).
    base = name.strip().lower().translate(_POLISH)
    base = unicodedata.normalize("NFKD", base)
    base = "".join(ch for ch in base if not unicodedata.combining(ch))
    base = re.sub(r"[^a-z0-9]+", "-", base)
    base = re.sub(r"-{2,}", "-", base).strip("-")[:50].strip("-")
    return base or "salon"


async def _unique_slug(session: AsyncSession, name: str) -> str:
    base = _slugify(name)
    candidate = base
    suffix = 1
    while await session.scalar(select(Tenant.id).where(Tenant.slug == candidate)) is not None:
        suffix += 1
        candidate = f"{base[:50].rstrip('-')}-{suffix}"
    return candidate


@router.post(
    "/register",
    response_model=RegisterResponse,
    responses={409: {"description": "Email already registered"}},
)
async def register(
    payload: RegisterRequest,
    request: Request,
    _origin: TrustedOriginDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> RegisterResponse | JSONResponse:
    now = datetime.now(UTC)
    normalized_email = normalize_email(payload.email)

    existing = await session.scalar(
        select(User.id).where(User.email_normalized == normalized_email)
    )
    if existing is not None:
        return error_response(
            request,
            status_code=409,
            code="email_taken",
            message="This email address is already registered",
            headers={"Cache-Control": "no-store"},
        )

    code = generate_verification_code()
    expires_at = now + timedelta(seconds=VERIFICATION_TTL_SECONDS)

    # The account, salon and company data do not exist yet — only a pending
    # e-mail verification. Re-requesting a code restarts a pending sign-up.
    pending = await session.scalar(
        select(OwnerRegistration)
        .where(OwnerRegistration.email_normalized == normalized_email)
        .with_for_update()
    )
    if pending is None:
        pending = OwnerRegistration(
            email=payload.email,
            email_normalized=normalized_email,
        )
        session.add(pending)
    pending.email = payload.email
    pending.verification_code_hash = verification_code_digest(code)
    pending.verification_code_expires_at = expires_at
    pending.verification_attempts = 0
    pending.email_verified_at = None
    pending.registration_token_hash = None
    pending.registration_token_expires_at = None
    await session.flush()

    try:
        await send_account_verification_email(
            recipient_email=payload.email.strip(),
            recipient_name=payload.email.strip(),
            code=code,
            expires_in_seconds=VERIFICATION_TTL_SECONDS,
            settings=settings,
        )
    except VerificationEmailDeliveryError as exc:
        raise AppError(
            status_code=503,
            code="verification_email_unavailable",
            message="Account verification e-mail could not be sent",
            headers={"Cache-Control": "no-store"},
        ) from exc

    logger.info("Issued account verification code for a new registration")
    dev_code = code if settings.environment in {"local", "test"} else None
    return RegisterResponse(
        email=payload.email,
        expires_in_seconds=VERIFICATION_TTL_SECONDS,
        dev_code=dev_code,
    )


def _invalid_staff_invitation() -> AppError:
    return AppError(
        status_code=404,
        code="staff_invitation_invalid",
        message="Staff invitation is invalid, expired or has already been used",
        headers={"Cache-Control": "no-store"},
    )


def _invitation_digest(token: str) -> str:
    try:
        return session_token_digest(token)
    except ValueError:
        raise _invalid_staff_invitation() from None


@router.get(
    "/staff-invitations/{token}",
    response_model=StaffInvitationResponse,
)
async def get_staff_invitation(
    token: Annotated[str, Path(min_length=43, max_length=43)],
    session: DbSessionDep,
    response: Response,
) -> StaffInvitationResponse:
    now = datetime.now(UTC)
    row = (
        await session.execute(
            select(StaffInvitation, Tenant)
            .join(Tenant, Tenant.id == StaffInvitation.tenant_id)
            .where(
                StaffInvitation.token_digest == _invitation_digest(token),
                StaffInvitation.accepted_at.is_(None),
                StaffInvitation.revoked_at.is_(None),
                StaffInvitation.expires_at > now,
                Tenant.status == TenantStatus.ACTIVE.value,
            )
        )
    ).first()
    if row is None:
        raise _invalid_staff_invitation()
    invitation, tenant = row
    response.headers["Cache-Control"] = "no-store"
    return StaffInvitationResponse(
        email=invitation.email,
        salon_name=tenant.display_name,
        expires_at=invitation.expires_at,
    )


@router.post(
    "/staff-invitations/{token}/accept",
    response_model=AuthStateResponse,
)
async def accept_staff_invitation(
    token: Annotated[str, Path(min_length=43, max_length=43)],
    payload: StaffInvitationAcceptRequest,
    response: Response,
    _origin: TrustedOriginDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> AuthStateResponse:
    now = datetime.now(UTC)
    invitation = await session.scalar(
        select(StaffInvitation)
        .where(StaffInvitation.token_digest == _invitation_digest(token))
        .with_for_update()
    )
    if (
        invitation is None
        or invitation.accepted_at is not None
        or invitation.revoked_at is not None
        or invitation.expires_at <= now
    ):
        raise _invalid_staff_invitation()
    tenant = await session.get(Tenant, invitation.tenant_id)
    if tenant is None or tenant.status != TenantStatus.ACTIVE.value:
        raise _invalid_staff_invitation()
    if await session.scalar(
        select(User.id).where(User.email_normalized == invitation.email_normalized)
    ) is not None:
        raise AppError(
            status_code=409,
            code="staff_email_registered",
            message="This e-mail already belongs to a BeautyDocs account",
            headers={"Cache-Control": "no-store"},
        )

    password_hash = await to_thread.run_sync(hash_password, payload.password)
    user = User(
        email=invitation.email,
        email_normalized=invitation.email_normalized,
        password_hash=password_hash,
        display_name=payload.full_name,
        is_active=True,
        email_verified_at=now,
        verification_code_hash=None,
        verification_code_expires_at=None,
        verification_attempts=0,
        last_login_at=now,
    )
    session.add(user)
    await session.flush()

    await set_tenant_context(session, tenant.id)
    membership = TenantMembership(
        tenant_id=tenant.id,
        user_id=user.id,
        role=MembershipRole.STAFF.value,
        is_active=True,
    )
    session.add(membership)
    await session.flush()
    session.add(
        TeamMember(
            tenant_id=tenant.id,
            membership_id=membership.id,
            display_name=user.display_name,
            email=user.email,
            job_title=invitation.job_title,
            is_owner=False,
            performs_treatments=invitation.performs_treatments,
            is_active=True,
        )
    )
    invitation.accepted_at = now
    await session.flush()
    response.headers["Cache-Control"] = "no-store"
    return await _open_user_session(
        session,
        settings=settings,
        response=response,
        user=user,
        now=now,
    )


def _invalid_code(request: Request) -> JSONResponse:
    return error_response(
        request,
        status_code=400,
        code="invalid_code",
        message="The verification code is invalid or has expired",
        headers={"Cache-Control": "no-store"},
    )


def _invalid_registration_token(request: Request) -> JSONResponse:
    return error_response(
        request,
        status_code=400,
        code="invalid_registration",
        message="The registration session is invalid or has expired",
        headers={"Cache-Control": "no-store"},
    )


@router.post(
    "/register/verify",
    response_model=VerifyResponse,
    responses={400: {"description": "Invalid or expired code"}},
)
async def verify_registration(
    payload: VerifyRequest,
    request: Request,
    _origin: TrustedOriginDep,
    session: DbSessionDep,
) -> VerifyResponse | JSONResponse:
    now = datetime.now(UTC)
    normalized_email = normalize_email(payload.email)
    pending = await session.scalar(
        select(OwnerRegistration)
        .where(OwnerRegistration.email_normalized == normalized_email)
        .with_for_update()
    )

    if (
        pending is None
        or pending.verification_code_hash is None
        or pending.email_verified_at is not None
        or pending.verification_code_expires_at is None
        or pending.verification_code_expires_at <= now
        or pending.verification_attempts >= VERIFICATION_MAX_ATTEMPTS
    ):
        return _invalid_code(request)

    if verification_code_digest(payload.code) != pending.verification_code_hash:
        pending.verification_attempts += 1
        return _invalid_code(request)

    # Verified: clear the code and mint a one-time token authorizing the
    # finalize step. No session is opened — the account does not exist yet.
    registration_token = generate_session_token()
    pending.email_verified_at = now
    pending.verification_code_hash = None
    pending.verification_code_expires_at = None
    pending.verification_attempts = 0
    pending.registration_token_hash = session_token_digest(registration_token)
    pending.registration_token_expires_at = now + timedelta(
        seconds=REGISTRATION_COMPLETION_TTL_SECONDS
    )

    return VerifyResponse(email=pending.email, registration_token=registration_token)


async def _open_user_session(
    session: DbSessionDep,
    *,
    settings: SettingsDep,
    response: Response,
    user: User,
    now: datetime,
) -> AuthStateResponse:
    await open_staff_session(
        session=session,
        settings=settings,
        response=response,
        user=user,
        now=now,
    )

    await set_user_context(session, user.id)
    auth_state = await _load_memberships(
        session,
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )
    return auth_state


async def _provision_owner_account(
    session: AsyncSession,
    *,
    now: datetime,
    email: str,
    full_name: str,
    salon_name: str,
    password_hash: str,
    company: CompleteRequest,
) -> User:
    """Create the owner account, salon and company data for a finalized sign-up."""
    user = User(
        email=email,
        email_normalized=normalize_email(email),
        password_hash=password_hash,
        display_name=full_name,
        is_active=True,
        email_verified_at=now,
        last_login_at=now,
    )
    session.add(user)
    await session.flush()

    slug = await _unique_slug(session, salon_name)
    tenant = Tenant(
        slug=slug,
        display_name=salon_name,
        legal_name=company.company_name,
        nip=company.nip,
        regon=company.regon,
        krs=company.krs,
        email=email,
        privacy_contact_email=email,
        address_line1=company.street,
        postal_code=company.postal_code,
        city=company.city,
        directory_visible=True,
        status=TenantStatus.ACTIVE.value,
    )
    session.add(tenant)
    await session.flush()

    # tenant_memberships is RLS-protected: set the new salon's context first.
    await set_tenant_context(session, tenant.id)
    membership = TenantMembership(
        tenant_id=tenant.id,
        user_id=user.id,
        role=MembershipRole.OWNER.value,
        is_active=True,
    )
    session.add(membership)
    await session.flush()
    session.add(
        TeamMember(
            tenant_id=tenant.id,
            membership_id=membership.id,
            display_name=user.display_name,
            email=user.email,
            job_title="Właściciel salonu",
            is_owner=True,
            performs_treatments=True,
            is_active=True,
        )
    )
    await session.flush()
    return user


@router.post(
    "/register/complete",
    response_model=AuthStateResponse,
    responses={
        400: {"description": "Invalid or expired registration"},
        409: {"description": "Email already registered"},
    },
)
async def complete_registration(
    payload: CompleteRequest,
    request: Request,
    response: Response,
    _origin: TrustedOriginDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> AuthStateResponse | JSONResponse:
    now = datetime.now(UTC)
    try:
        token_digest = session_token_digest(payload.registration_token)
    except ValueError:
        return _invalid_registration_token(request)

    pending = await session.scalar(
        select(OwnerRegistration)
        .where(OwnerRegistration.registration_token_hash == token_digest)
        .with_for_update()
    )
    if (
        pending is None
        or pending.email_verified_at is None
        or pending.registration_token_expires_at is None
        or pending.registration_token_expires_at <= now
    ):
        return _invalid_registration_token(request)

    # Guard the race where the same e-mail was completed via another session.
    existing = await session.scalar(
        select(User.id).where(User.email_normalized == pending.email_normalized)
    )
    if existing is not None:
        return error_response(
            request,
            status_code=409,
            code="email_taken",
            message="This email address is already registered",
            headers={"Cache-Control": "no-store"},
        )

    password_hash = await to_thread.run_sync(hash_password, payload.password)
    user = await _provision_owner_account(
        session,
        now=now,
        email=pending.email,
        full_name=payload.full_name,
        salon_name=payload.salon_name,
        password_hash=password_hash,
        company=payload,
    )

    # The pending registration has served its purpose.
    await session.execute(
        delete(OwnerRegistration).where(OwnerRegistration.id == pending.id)
    )

    logger.info("Completed a self-service salon owner registration")
    return await _open_user_session(
        session,
        settings=settings,
        response=response,
        user=user,
        now=now,
    )


@router.get("/google/config", response_model=GoogleLoginConfigResponse)
async def google_login_config(settings: SettingsDep) -> GoogleLoginConfigResponse:
    return GoogleLoginConfigResponse(
        enabled=settings.google_client_id is not None,
        client_id=settings.google_client_id,
    )


@router.post(
    "/google/staff",
    response_model=AuthStateResponse | MfaLoginChallengeResponse,
)
async def register_or_login_staff_with_google(
    payload: GoogleStaffRegistrationRequest,
    request: Request,
    response: Response,
    _origin: TrustedOriginDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> AuthStateResponse | MfaLoginChallengeResponse:
    if settings.google_client_id is None:
        raise AppError(
            status_code=503,
            code="google_auth_not_configured",
            message="Google sign-in is not configured",
            headers={"Cache-Control": "no-store"},
        )
    try:
        verified = await resolve_google_identity(
            client_id=settings.google_client_id,
            credential=payload.credential,
            access_token=payload.access_token,
        )
    except GoogleIdentityVerificationError:
        raise AppError(
            status_code=401,
            code="invalid_google_credential",
            message="Google credential is invalid",
            headers={"Cache-Control": "no-store"},
        ) from None

    now = datetime.now(UTC)
    identity = await session.scalar(
        select(UserGoogleIdentity)
        .where(UserGoogleIdentity.google_subject == verified.subject)
        .with_for_update()
    )
    user = await _resolve_google_staff_account(
        session=session,
        identity=identity,
        verified=verified,
        now=now,
    )
    await set_user_context(session, user.id)
    if await session.scalar(
        select(TenantMembership.id).where(
            TenantMembership.user_id == user.id,
            TenantMembership.is_active.is_(True),
        )
    ) is None:
        raise AppError(
            status_code=403,
            code="staff_invitation_required",
            message="A salon invitation is required before staff can sign in",
            headers={"Cache-Control": "no-store"},
        )
    user.is_active = True
    user.email_verified_at = user.email_verified_at or now
    user.verification_code_hash = None
    user.verification_code_expires_at = None
    user.verification_attempts = 0
    user.failed_login_attempts = 0
    user.locked_until = None
    if mfa_enabled(user):
        assert user.mfa_method is not None
        method = MfaMethod(user.mfa_method)
        challenge, dev_code = await issue_mfa_challenge(
            session=session,
            request=request,
            settings=settings,
            user=user,
            purpose=MfaChallengePurpose.LOGIN,
            method=method,
            phone_normalized=(
                user.mfa_phone_normalized if method == MfaMethod.SMS else None
            ),
        )
        await session.flush()
        response.headers["Cache-Control"] = "no-store"
        return MfaLoginChallengeResponse(
            challenge_id=challenge.id,
            method=method,
            destination_masked=challenge.destination_masked,
            expires_in_seconds=settings.auth_mfa_challenge_ttl_seconds,
            dev_code=dev_code,
        )
    user.last_login_at = now
    await session.flush()
    return await _open_user_session(
        session,
        settings=settings,
        response=response,
        user=user,
        now=now,
    )


async def _resolve_google_staff_account(
    *,
    session: DbSessionDep,
    identity: UserGoogleIdentity | None,
    verified: VerifiedGoogleIdentity,
    now: datetime,
) -> User:
    if identity is not None:
        user = await session.get(User, identity.user_id)
        if user is None:
            raise AppError(
                status_code=404,
                code="google_account_not_found",
                message="Google account is not linked to an active user",
                headers={"Cache-Control": "no-store"},
            )
    else:
        user = await session.scalar(
            select(User).where(User.email_normalized == verified.email_normalized).with_for_update()
        )
        if user is not None and not verified.email_is_authoritative:
            raise _google_staff_conflict()
        if user is None:
            raise AppError(
                status_code=403,
                code="staff_invitation_required",
                message="A salon invitation is required before staff can sign in",
                headers={"Cache-Control": "no-store"},
            )
        existing_identity = await session.scalar(
            select(UserGoogleIdentity.id).where(UserGoogleIdentity.user_id == user.id)
        )
        if existing_identity is not None:
            raise _google_staff_conflict()
        identity = UserGoogleIdentity(
            user_id=user.id,
            google_subject=verified.subject,
            email=verified.email,
            email_normalized=verified.email_normalized,
            hosted_domain=verified.hosted_domain,
            email_verified_at=now,
            created_at=now,
            last_login_at=now,
        )
        session.add(identity)

    identity.email = verified.email
    identity.email_normalized = verified.email_normalized
    identity.hosted_domain = verified.hosted_domain
    identity.email_verified_at = now
    identity.last_login_at = now
    return user


def _google_staff_conflict() -> AppError:
    return AppError(
        status_code=409,
        code="google_account_conflict",
        message="Google identity is already linked to another account",
        headers={"Cache-Control": "no-store"},
    )


def _google_owner_already_registered() -> AppError:
    return AppError(
        status_code=409,
        code="google_account_exists",
        message="This Google account already has a BeautyDocs account. Sign in instead.",
        headers={"Cache-Control": "no-store"},
    )


@router.post(
    "/google/register-owner",
    response_model=AuthStateResponse,
    responses={409: {"description": "Email or Google account already registered"}},
)
async def register_owner_with_google(
    payload: GoogleOwnerRegistrationRequest,
    request: Request,
    response: Response,
    _origin: TrustedOriginDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> AuthStateResponse | JSONResponse:
    """Create a new salon owner from a Google credential.

    Mirrors :func:`register`, but Google verifies the identity and e-mail, so the
    account is created active (no e-mail code) and the caller is logged in
    immediately. The owner still supplies the salon name; company details are
    completed later in the configuration step.
    """
    if settings.google_client_id is None:
        raise AppError(
            status_code=503,
            code="google_auth_not_configured",
            message="Google sign-in is not configured",
            headers={"Cache-Control": "no-store"},
        )
    try:
        verified = await resolve_google_identity(
            client_id=settings.google_client_id,
            credential=payload.credential,
            access_token=payload.access_token,
        )
    except GoogleIdentityVerificationError:
        raise AppError(
            status_code=401,
            code="invalid_google_credential",
            message="Google credential is invalid",
            headers={"Cache-Control": "no-store"},
        ) from None

    if not verified.email_is_authoritative:
        raise AppError(
            status_code=400,
            code="google_email_unverified",
            message="Google account e-mail is not verified",
            headers={"Cache-Control": "no-store"},
        )

    now = datetime.now(UTC)

    existing_identity = await session.scalar(
        select(UserGoogleIdentity.id).where(
            UserGoogleIdentity.google_subject == verified.subject
        )
    )
    if existing_identity is not None:
        raise _google_owner_already_registered()

    existing_user = await session.scalar(
        select(User.id).where(User.email_normalized == verified.email_normalized)
    )
    if existing_user is not None:
        return error_response(
            request,
            status_code=409,
            code="email_taken",
            message="This email address is already registered",
            headers={"Cache-Control": "no-store"},
        )

    display_name = (payload.full_name or verified.full_name or verified.email).strip()[
        :200
    ]
    # Google is the authentication method; store a random, unusable password so
    # the not-null column is satisfied without a guessable value.
    password_hash = await to_thread.run_sync(
        hash_password, secrets.token_urlsafe(32)
    )
    user = User(
        email=verified.email,
        email_normalized=verified.email_normalized,
        password_hash=password_hash,
        display_name=display_name,
        is_active=True,
        email_verified_at=now,
        verification_attempts=0,
    )
    session.add(user)
    await session.flush()

    session.add(
        UserGoogleIdentity(
            user_id=user.id,
            google_subject=verified.subject,
            email=verified.email,
            email_normalized=verified.email_normalized,
            hosted_domain=verified.hosted_domain,
            email_verified_at=now,
            created_at=now,
            last_login_at=now,
        )
    )
    await session.flush()

    slug = await _unique_slug(session, payload.salon_name)
    tenant = Tenant(
        slug=slug,
        display_name=payload.salon_name,
        legal_name=payload.salon_name,
        email=verified.email,
        privacy_contact_email=verified.email,
        directory_visible=True,
        status=TenantStatus.ACTIVE.value,
    )
    session.add(tenant)
    await session.flush()

    # tenant_memberships is RLS-protected: set the new salon's context first.
    await set_tenant_context(session, tenant.id)
    membership = TenantMembership(
        tenant_id=tenant.id,
        user_id=user.id,
        role=MembershipRole.OWNER.value,
        is_active=True,
    )
    session.add(membership)
    await session.flush()
    session.add(
        TeamMember(
            tenant_id=tenant.id,
            membership_id=membership.id,
            display_name=user.display_name,
            email=user.email,
            job_title="Właściciel salonu",
            is_owner=True,
            performs_treatments=True,
            is_active=True,
        )
    )
    await session.flush()

    user.last_login_at = now
    await session.flush()

    logger.info("Registered a new salon owner via Google")
    return await _open_user_session(
        session,
        settings=settings,
        response=response,
        user=user,
        now=now,
    )


async def _current_user_for_update(
    principal: CurrentUserDep,
    session: DbSessionDep,
) -> User:
    user = await session.scalar(select(User).where(User.id == principal.user_id).with_for_update())
    if user is None or not user.is_active or user.deleted_at is not None:
        raise AppError(
            status_code=404,
            code="user_not_found",
            message="User was not found",
            headers={"Cache-Control": "private, no-store"},
        )
    return user


def _user_profile(user: User) -> UserProfileResponse:
    return UserProfileResponse(
        display_name=user.display_name,
        email=user.email,
        phone=user.phone_normalized,
        email_verified_at=user.email_verified_at,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        signature_configured=bool(user.signature_data_url),
        signature_updated_at=user.signature_updated_at,
    )


async def _linked_team_profiles(
    session: AsyncSession,
    user_id: UUID,
) -> list[tuple[UUID, UUID]]:
    """Return tenant/membership pairs for team profiles owned by this user."""

    result = await session.execute(
        select(TenantMembership.tenant_id, TenantMembership.id).where(
            TenantMembership.user_id == user_id,
            TenantMembership.is_active.is_(True),
        )
    )
    return [(row[0], row[1]) for row in result.all()]


async def _sync_linked_team_profiles(
    session: AsyncSession,
    memberships: list[tuple[UUID, UUID]],
    **values: object,
) -> None:
    """Keep a user's tenant-scoped employee profiles aligned with self-service data."""

    for tenant_id, membership_id in memberships:
        await set_tenant_context(session, tenant_id)
        await session.execute(
            update(TeamMember)
            .where(
                TeamMember.tenant_id == tenant_id,
                TeamMember.membership_id == membership_id,
            )
            .values(**values)
        )


@router.get("/profile", response_model=UserProfileResponse)
async def get_user_profile(
    principal: CurrentUserDep,
    session: DbSessionDep,
    response: Response,
) -> UserProfileResponse:
    user = await _current_user_for_update(principal, session)
    response.headers["Cache-Control"] = "private, no-store"
    return _user_profile(user)


@router.put("/profile", response_model=UserProfileResponse)
async def update_user_profile(
    payload: UserProfileUpdateRequest,
    _origin: TrustedOriginDep,
    principal: CurrentUserDep,
    session: DbSessionDep,
    response: Response,
) -> UserProfileResponse:
    user = await _current_user_for_update(principal, session)
    memberships = await _linked_team_profiles(session, principal.user_id)
    user.display_name = " ".join(payload.display_name.strip().split())
    user.phone_normalized = normalize_phone(payload.phone) if payload.phone else None
    await _sync_linked_team_profiles(
        session,
        memberships,
        display_name=user.display_name,
        phone=user.phone_normalized,
        phone_normalized=user.phone_normalized,
    )
    await session.flush()
    response.headers["Cache-Control"] = "private, no-store"
    return _user_profile(user)


@router.put("/profile/password", status_code=204, response_class=Response)
async def change_user_password(
    payload: ChangeUserPasswordRequest,
    request: Request,
    _origin: TrustedOriginDep,
    principal: CurrentUserDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> Response:
    """Set a new staff password and revoke every other active login session."""

    user = await _current_user_for_update(principal, session)
    user.password_hash = await to_thread.run_sync(hash_password, payload.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None

    raw_token = request.cookies.get(settings.auth_session_cookie_name)
    if is_valid_session_token(raw_token):
        assert raw_token is not None
        current_digest = session_token_digest(raw_token)
        await session.execute(
            update(AuthSession)
            .where(
                AuthSession.user_id == user.id,
                AuthSession.revoked_at.is_(None),
                AuthSession.token_digest != current_digest,
            )
            .values(revoked_at=datetime.now(UTC))
        )
    await session.flush()
    return Response(status_code=204, headers={"Cache-Control": "private, no-store"})


@router.get("/profile/signature")
async def get_user_signature(
    principal: CurrentUserDep,
    session: DbSessionDep,
) -> Response:
    user = await _current_user_for_update(principal, session)
    if not user.signature_data_url:
        raise AppError(
            status_code=404,
            code="user_signature_not_found",
            message="Signature was not found",
            headers={"Cache-Control": "private, no-store"},
        )
    try:
        payload = decode_signature_png_data_url(user.signature_data_url)
    except InvalidSignatureImageError:
        raise AppError(
            status_code=404,
            code="user_signature_not_found",
            message="Signature was not found",
            headers={"Cache-Control": "private, no-store"},
        ) from None
    return Response(
        content=payload,
        media_type="image/png",
        headers={
            "Cache-Control": "private, no-store",
            "Content-Disposition": 'inline; filename="signature.png"',
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.put("/profile/signature", status_code=204, response_class=Response)
async def set_user_signature(
    payload: UserSignatureRequest,
    _origin: TrustedOriginDep,
    principal: CurrentUserDep,
    session: DbSessionDep,
) -> Response:
    """Let an authenticated owner or employee manage their own reusable signature."""

    try:
        decode_signature_png_data_url(payload.signature)
    except InvalidSignatureImageError:
        raise AppError(
            status_code=422,
            code="invalid_user_signature",
            message="Signature must be a valid PNG image",
            headers={"Cache-Control": "private, no-store"},
        ) from None

    user = await _current_user_for_update(principal, session)
    memberships = await _linked_team_profiles(session, principal.user_id)

    user.signature_data_url = payload.signature
    user.signature_updated_at = datetime.now(UTC)
    await _sync_linked_team_profiles(
        session,
        memberships,
        signature_data_url=payload.signature,
        signature_updated_at=user.signature_updated_at,
    )
    await session.flush()
    return Response(
        status_code=204,
        headers={"Cache-Control": "private, no-store"},
    )


@router.delete("/profile", status_code=204, response_class=Response)
async def delete_user_account(
    payload: DeleteUserAccountRequest,
    _origin: TrustedOriginDep,
    principal: CurrentUserDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> Response:
    """Remove the login identity while retaining tenant records when required."""

    del payload  # Literal validation above is the destructive-action confirmation.
    user = await _current_user_for_update(principal, session)
    owned_active_tenant = await session.scalar(
        select(Tenant.id)
        .join(TenantMembership, TenantMembership.tenant_id == Tenant.id)
        .where(
            TenantMembership.user_id == principal.user_id,
            TenantMembership.role == MembershipRole.OWNER.value,
            TenantMembership.is_active.is_(True),
            Tenant.status == TenantStatus.ACTIVE.value,
        )
        .limit(1)
    )
    if owned_active_tenant is not None:
        raise AppError(
            status_code=409,
            code="owned_tenants_exist",
            message="Owned salons must be closed or transferred first",
            headers={"Cache-Control": "private, no-store"},
        )

    memberships = await _linked_team_profiles(session, principal.user_id)
    now = datetime.now(UTC)
    tombstone_email = f"deleted-{user.id}@deleted.invalid"
    user.email = tombstone_email
    user.email_normalized = tombstone_email
    user.display_name = "Usunięte konto"
    user.phone_normalized = None
    user.password_hash = await to_thread.run_sync(hash_password, generate_session_token())
    user.is_active = False
    user.signature_data_url = None
    user.signature_updated_at = None
    clear_mfa(user)
    user.verification_code_hash = None
    user.verification_code_expires_at = None
    user.deleted_at = now
    await _sync_linked_team_profiles(
        session,
        memberships,
        signature_data_url=None,
        signature_updated_at=None,
        phone=None,
        phone_normalized=None,
        is_active=False,
    )
    await session.execute(delete(UserGoogleIdentity).where(UserGoogleIdentity.user_id == user.id))
    await session.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    await session.flush()

    response = Response(status_code=204, headers={"Cache-Control": "no-store"})
    response.delete_cookie(
        key=settings.auth_session_cookie_name,
        path="/",
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite="lax",
    )
    return response


@router.post("/company-lookup", response_model=CompanyLookupResponse)
async def company_lookup(
    payload: CompanyLookupRequest,
    _origin: TrustedOriginDep,
    _principal: CurrentUserDep,
    settings: SettingsDep,
    response: Response,
) -> CompanyLookupResponse:
    try:
        company = await lookup_company_by_nip(payload.nip, settings)
    except RegonRegistryNotConfiguredError:
        raise AppError(
            status_code=503,
            code="regon_not_configured",
            message="REGON registry integration is not configured",
            headers={"Cache-Control": "private, no-store"},
        ) from None
    except RegonRegistryNotFoundError:
        raise AppError(
            status_code=404,
            code="company_not_found",
            message="No company was found for this NIP",
            headers={"Cache-Control": "private, no-store"},
        ) from None
    except RegonRegistryUnavailableError:
        raise AppError(
            status_code=503,
            code="regon_unavailable",
            message="REGON registry is temporarily unavailable",
            headers={"Cache-Control": "private, no-store"},
        ) from None

    response.headers.update({"Cache-Control": "private, no-store"})
    return CompanyLookupResponse(
        nip=company.nip,
        regon=company.regon,
        krs=company.krs,
        company_name=company.name,
        street=company.street,
        postal_code=company.postal_code,
        city=company.city,
        status_nip=company.status_nip,
        activity_ended_at=company.activity_ended_at,
    )


@router.post("/configure", status_code=204, response_class=Response)
async def configure_salon(
    payload: ConfigureRequest,
    _origin: TrustedOriginDep,
    principal: CurrentUserDep,
    session: DbSessionDep,
) -> Response:
    # CurrentUserDep already set the user context, so the membership
    # self-select policy exposes this user's own rows.
    membership = await session.scalar(
        select(TenantMembership).where(
            TenantMembership.user_id == principal.user_id,
            TenantMembership.role == MembershipRole.OWNER.value,
            TenantMembership.is_active.is_(True),
        )
    )
    if membership is None:
        return Response(status_code=204, headers={"Cache-Control": "no-store"})

    await set_tenant_context(session, membership.tenant_id)
    tenant = await session.get(Tenant, membership.tenant_id)
    if tenant is not None:
        tenant.legal_name = payload.company_name
        tenant.nip = payload.nip
        tenant.regon = payload.regon
        tenant.krs = payload.krs
        tenant.address_line1 = payload.street
        tenant.postal_code = payload.postal_code
        tenant.city = payload.city

    return Response(status_code=204, headers={"Cache-Control": "no-store"})


@router.post(
    "/salons",
    response_model=CreateSalonResponse,
    status_code=201,
    responses={422: {"description": "Invalid salon or company data"}},
)
async def create_salon(
    payload: CreateSalonRequest,
    _origin: TrustedOriginDep,
    principal: CurrentUserDep,
    session: DbSessionDep,
) -> CreateSalonResponse:
    """Add another salon under the current, already-authenticated owner.

    Unlike :func:`register` / :func:`complete_registration`, this never
    creates a ``User`` — the owner is already signed in — it only adds a new
    ``Tenant``, an ``OWNER`` membership, and a matching team-member row.
    """
    user = await _current_user_for_update(principal, session)
    now = datetime.now(UTC)

    slug = await _unique_slug(session, payload.salon_name)
    tenant = Tenant(
        slug=slug,
        display_name=payload.salon_name,
        legal_name=payload.company_name,
        nip=payload.nip,
        regon=payload.regon,
        krs=payload.krs,
        email=user.email,
        privacy_contact_email=user.email,
        address_line1=payload.street,
        postal_code=payload.postal_code,
        city=payload.city,
        directory_visible=True,
        status=TenantStatus.ACTIVE.value,
    )
    session.add(tenant)
    await session.flush()

    # tenant_memberships is RLS-protected: set the new salon's context first.
    await set_tenant_context(session, tenant.id)
    membership = TenantMembership(
        tenant_id=tenant.id,
        user_id=user.id,
        role=MembershipRole.OWNER.value,
        is_active=True,
    )
    session.add(membership)
    await session.flush()
    session.add(
        TeamMember(
            tenant_id=tenant.id,
            membership_id=membership.id,
            display_name=user.display_name,
            email=user.email,
            job_title="Właściciel salonu",
            is_owner=True,
            performs_treatments=True,
            is_active=True,
        )
    )
    await session.flush()

    session.add(
        AuditEvent(
            tenant_id=tenant.id,
            actor_membership_id=membership.id,
            action="tenant.created",
            resource_type="tenant",
            resource_id=tenant.id,
            details={"createdFromExistingAccount": True},
            occurred_at=now,
        )
    )
    await session.flush()

    return CreateSalonResponse(
        tenant_slug=tenant.slug,
        tenant_display_name=tenant.display_name,
    )
