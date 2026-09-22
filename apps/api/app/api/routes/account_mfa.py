"""Optional multi-factor authentication for owner and staff accounts."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import select

from app.api.dependencies import (
    CurrentUserDep,
    DbSessionDep,
    SettingsDep,
    TrustedOriginDep,
)
from app.api.routes.auth import AuthStateResponse, _load_memberships
from app.core.errors import AppError
from app.db.tenant_context import set_mfa_challenge_context, set_user_context
from app.models.domain import (
    MfaChallengePurpose,
    MfaMethod,
    User,
    UserMfaChallenge,
    VerificationStatus,
)
from app.services.account_mfa import (
    clear_mfa,
    encrypt_totp_secret,
    generate_totp_secret,
    issue_mfa_challenge,
    mfa_enabled,
    qr_code_data_url,
    totp_provisioning_uri,
    verify_mfa_challenge,
)
from app.services.signature_sms import mask_phone, normalize_phone
from app.services.staff_sessions import open_staff_session

router = APIRouter(prefix="/auth/mfa", tags=["account-mfa"])
NO_STORE = {"Cache-Control": "private, no-store"}


class MfaResponseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class MfaStateResponse(MfaResponseModel):
    enabled: bool
    method: MfaMethod | None
    destination_masked: str | None = Field(default=None, max_length=64)
    enabled_at: datetime | None


class MfaEnrollmentRequest(MfaResponseModel):
    method: MfaMethod
    phone: str | None = Field(default=None, max_length=32)
    change_challenge_id: UUID | None = None


class MfaChallengeResponse(MfaResponseModel):
    challenge_id: UUID
    purpose: MfaChallengePurpose
    method: MfaMethod
    destination_masked: str | None = Field(default=None, max_length=64)
    expires_in_seconds: int = Field(ge=120, le=900)
    dev_code: str | None = Field(default=None, min_length=6, max_length=6)
    secret: str | None = Field(default=None, min_length=16, max_length=128)
    qr_code_data_url: str | None = Field(default=None, max_length=100_000)


class MfaChallengeConfirmation(MfaResponseModel):
    challenge_id: UUID
    code: str = Field(pattern=r"^\d{6}$")


class MfaChangeAuthorizationResponse(MfaResponseModel):
    change_challenge_id: UUID
    expires_in_seconds: int = Field(ge=1, le=900)


async def _current_user(principal: CurrentUserDep, session: DbSessionDep) -> User:
    user = await session.scalar(select(User).where(User.id == principal.user_id).with_for_update())
    if user is None or not user.is_active or user.deleted_at is not None:
        raise AppError(
            status_code=404,
            code="user_not_found",
            message="User was not found",
            headers=NO_STORE,
        )
    return user


def _state(user: User) -> MfaStateResponse:
    enabled = mfa_enabled(user)
    return MfaStateResponse(
        enabled=enabled,
        method=MfaMethod(user.mfa_method) if enabled else None,
        destination_masked=(
            mask_phone(user.mfa_phone_normalized) if enabled and user.mfa_phone_normalized else None
        ),
        enabled_at=user.mfa_enabled_at if enabled else None,
    )


def _invalid_code() -> AppError:
    return AppError(
        status_code=400,
        code="invalid_mfa_code",
        message="The verification code is invalid or has expired",
        headers=NO_STORE,
    )


@router.get("", response_model=MfaStateResponse)
async def get_mfa_state(
    principal: CurrentUserDep,
    session: DbSessionDep,
    response: Response,
) -> MfaStateResponse:
    user = await _current_user(principal, session)
    response.headers.update(NO_STORE)
    return _state(user)


@router.post("/enrollment", response_model=MfaChallengeResponse)
async def start_mfa_enrollment(
    payload: MfaEnrollmentRequest,
    request: Request,
    _origin: TrustedOriginDep,
    principal: CurrentUserDep,
    settings: SettingsDep,
    session: DbSessionDep,
    response: Response,
) -> MfaChallengeResponse:
    user = await _current_user(principal, session)
    if mfa_enabled(user):
        if payload.change_challenge_id is None:
            raise AppError(
                status_code=409,
                code="mfa_already_enabled",
                message="Multi-factor authentication is already enabled",
                headers=NO_STORE,
            )
        now = datetime.now(UTC)
        authorization = await session.scalar(
            select(UserMfaChallenge)
            .where(
                UserMfaChallenge.id == payload.change_challenge_id,
                UserMfaChallenge.user_id == user.id,
                UserMfaChallenge.purpose == MfaChallengePurpose.CHANGE.value,
                UserMfaChallenge.method == user.mfa_method,
                UserMfaChallenge.status == VerificationStatus.VERIFIED.value,
                UserMfaChallenge.expires_at > now,
            )
            .with_for_update()
        )
        if authorization is None:
            raise _invalid_code()
        # A proof authorizes exactly one replacement attempt. The old factor
        # remains active until the new enrollment is successfully confirmed.
        authorization.status = VerificationStatus.EXPIRED.value
    elif payload.change_challenge_id is not None:
        raise AppError(
            status_code=422,
            code="unexpected_change_challenge",
            message="A change authorization is not needed when MFA is disabled",
            headers=NO_STORE,
        )
    phone: str | None = None
    secret: str | None = None
    encrypted_secret: str | None = None
    provisioning_uri: str | None = None
    if payload.method == MfaMethod.SMS:
        phone = normalize_phone(payload.phone)
    else:
        if payload.phone is not None:
            raise AppError(
                status_code=422,
                code="unexpected_phone",
                message="A phone number is not used for authenticator apps",
                headers=NO_STORE,
            )
        secret = generate_totp_secret()
        encrypted_secret = encrypt_totp_secret(secret, settings)
        provisioning_uri = totp_provisioning_uri(
            secret=secret,
            account_email=user.email,
        )

    challenge, dev_code = await issue_mfa_challenge(
        session=session,
        request=request,
        settings=settings,
        user=user,
        purpose=MfaChallengePurpose.ENROLLMENT,
        method=payload.method,
        phone_normalized=phone,
        totp_secret_encrypted=encrypted_secret,
    )
    await session.flush()
    response.headers.update(NO_STORE)
    return MfaChallengeResponse(
        challenge_id=challenge.id,
        purpose=MfaChallengePurpose.ENROLLMENT,
        method=payload.method,
        destination_masked=challenge.destination_masked,
        expires_in_seconds=settings.auth_mfa_challenge_ttl_seconds,
        dev_code=dev_code,
        secret=secret,
        qr_code_data_url=(qr_code_data_url(provisioning_uri) if provisioning_uri else None),
    )


@router.post("/enrollment/confirm", response_model=MfaStateResponse)
async def confirm_mfa_enrollment(
    payload: MfaChallengeConfirmation,
    _origin: TrustedOriginDep,
    principal: CurrentUserDep,
    settings: SettingsDep,
    session: DbSessionDep,
    response: Response,
) -> MfaStateResponse:
    user = await _current_user(principal, session)
    challenge = await session.scalar(
        select(UserMfaChallenge)
        .where(
            UserMfaChallenge.id == payload.challenge_id,
            UserMfaChallenge.user_id == user.id,
            UserMfaChallenge.purpose == MfaChallengePurpose.ENROLLMENT.value,
        )
        .with_for_update()
    )
    if challenge is None or not await verify_mfa_challenge(
        challenge=challenge,
        user=user,
        code=payload.code,
        settings=settings,
    ):
        raise _invalid_code()

    now = datetime.now(UTC)
    method = MfaMethod(challenge.method)
    user.mfa_method = method.value
    user.mfa_enabled_at = now
    if method == MfaMethod.SMS:
        user.mfa_phone_normalized = challenge.phone_normalized
        user.mfa_totp_secret_encrypted = None
        user.mfa_last_used_counter = None
    else:
        user.mfa_phone_normalized = None
        user.mfa_totp_secret_encrypted = challenge.totp_secret_encrypted
        user.mfa_last_used_counter = None
    await session.flush()
    response.headers.update(NO_STORE)
    return _state(user)


@router.post("/change-challenge", response_model=MfaChallengeResponse)
async def start_mfa_change_challenge(
    request: Request,
    _origin: TrustedOriginDep,
    principal: CurrentUserDep,
    settings: SettingsDep,
    session: DbSessionDep,
    response: Response,
) -> MfaChallengeResponse:
    user = await _current_user(principal, session)
    if not mfa_enabled(user):
        raise AppError(
            status_code=409,
            code="mfa_not_enabled",
            message="Multi-factor authentication is not enabled",
            headers=NO_STORE,
        )
    method = MfaMethod(user.mfa_method)
    challenge, dev_code = await issue_mfa_challenge(
        session=session,
        request=request,
        settings=settings,
        user=user,
        purpose=MfaChallengePurpose.CHANGE,
        method=method,
        phone_normalized=(user.mfa_phone_normalized if method == MfaMethod.SMS else None),
    )
    await session.flush()
    response.headers.update(NO_STORE)
    return MfaChallengeResponse(
        challenge_id=challenge.id,
        purpose=MfaChallengePurpose.CHANGE,
        method=method,
        destination_masked=challenge.destination_masked,
        expires_in_seconds=settings.auth_mfa_challenge_ttl_seconds,
        dev_code=dev_code,
    )


@router.post("/change/confirm", response_model=MfaChangeAuthorizationResponse)
async def confirm_mfa_change(
    payload: MfaChallengeConfirmation,
    _origin: TrustedOriginDep,
    principal: CurrentUserDep,
    settings: SettingsDep,
    session: DbSessionDep,
    response: Response,
) -> MfaChangeAuthorizationResponse:
    user = await _current_user(principal, session)
    challenge = await session.scalar(
        select(UserMfaChallenge)
        .where(
            UserMfaChallenge.id == payload.challenge_id,
            UserMfaChallenge.user_id == user.id,
            UserMfaChallenge.purpose == MfaChallengePurpose.CHANGE.value,
            UserMfaChallenge.method == user.mfa_method,
        )
        .with_for_update()
    )
    if challenge is None or not await verify_mfa_challenge(
        challenge=challenge,
        user=user,
        code=payload.code,
        settings=settings,
    ):
        raise _invalid_code()
    remaining = max(1, int((challenge.expires_at - datetime.now(UTC)).total_seconds()))
    await session.flush()
    response.headers.update(NO_STORE)
    return MfaChangeAuthorizationResponse(
        change_challenge_id=challenge.id,
        expires_in_seconds=remaining,
    )


@router.post("/disable-challenge", response_model=MfaChallengeResponse)
async def start_mfa_disable_challenge(
    request: Request,
    _origin: TrustedOriginDep,
    principal: CurrentUserDep,
    settings: SettingsDep,
    session: DbSessionDep,
    response: Response,
) -> MfaChallengeResponse:
    user = await _current_user(principal, session)
    if not mfa_enabled(user):
        raise AppError(
            status_code=409,
            code="mfa_not_enabled",
            message="Multi-factor authentication is not enabled",
            headers=NO_STORE,
        )
    method = MfaMethod(user.mfa_method)
    challenge, dev_code = await issue_mfa_challenge(
        session=session,
        request=request,
        settings=settings,
        user=user,
        purpose=MfaChallengePurpose.DISABLE,
        method=method,
        phone_normalized=(user.mfa_phone_normalized if method == MfaMethod.SMS else None),
    )
    await session.flush()
    response.headers.update(NO_STORE)
    return MfaChallengeResponse(
        challenge_id=challenge.id,
        purpose=MfaChallengePurpose.DISABLE,
        method=method,
        destination_masked=challenge.destination_masked,
        expires_in_seconds=settings.auth_mfa_challenge_ttl_seconds,
        dev_code=dev_code,
    )


@router.post("/disable/confirm", status_code=204, response_class=Response)
async def confirm_mfa_disable(
    payload: MfaChallengeConfirmation,
    _origin: TrustedOriginDep,
    principal: CurrentUserDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> Response:
    user = await _current_user(principal, session)
    challenge = await session.scalar(
        select(UserMfaChallenge)
        .where(
            UserMfaChallenge.id == payload.challenge_id,
            UserMfaChallenge.user_id == user.id,
            UserMfaChallenge.purpose == MfaChallengePurpose.DISABLE.value,
            UserMfaChallenge.method == user.mfa_method,
        )
        .with_for_update()
    )
    if challenge is None or not await verify_mfa_challenge(
        challenge=challenge,
        user=user,
        code=payload.code,
        settings=settings,
    ):
        raise _invalid_code()
    clear_mfa(user)
    await session.flush()
    return Response(status_code=204, headers=NO_STORE)


@router.post("/login/confirm", response_model=AuthStateResponse)
async def confirm_mfa_login(
    payload: MfaChallengeConfirmation,
    _request: Request,
    response: Response,
    _origin: TrustedOriginDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> AuthStateResponse:
    await set_mfa_challenge_context(session, payload.challenge_id)
    challenge = await session.scalar(
        select(UserMfaChallenge)
        .where(
            UserMfaChallenge.id == payload.challenge_id,
            UserMfaChallenge.purpose == MfaChallengePurpose.LOGIN.value,
        )
        .with_for_update()
    )
    if challenge is None:
        raise _invalid_code()
    user = await session.scalar(select(User).where(User.id == challenge.user_id).with_for_update())
    if (
        user is None
        or not user.is_active
        or user.deleted_at is not None
        or not mfa_enabled(user)
        or user.mfa_method != challenge.method
        or not await verify_mfa_challenge(
            challenge=challenge,
            user=user,
            code=payload.code,
            settings=settings,
        )
    ):
        raise _invalid_code()

    now = datetime.now(UTC)
    user.last_login_at = now
    user.failed_login_attempts = 0
    user.locked_until = None
    await open_staff_session(
        session=session,
        settings=settings,
        response=response,
        user=user,
        now=now,
    )
    await set_user_context(session, user.id)
    return await _load_memberships(
        session,
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )
