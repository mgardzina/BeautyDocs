"""Optional multi-factor authentication for client (consumer) accounts.

Mirrors ``app.api.routes.account_mfa`` for owner/staff accounts — same
enrollment / change / disable / login-confirm shape — but scoped to
``ConsumerAccount`` via ``CurrentConsumerDep`` instead of ``CurrentUserDep``.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import select

from app.api.dependencies import (
    CurrentConsumerDep,
    DbSessionDep,
    SettingsDep,
    TrustedOriginDep,
)
from app.api.routes.consumer import ConsumerStateResponse, _open_session, _state_response
from app.core.errors import AppError
from app.models.domain import (
    ConsumerAccount,
    ConsumerMfaChallenge,
    MfaChallengePurpose,
    MfaMethod,
    VerificationStatus,
)
from app.services.account_mfa import (
    encrypt_totp_secret,
    generate_totp_secret,
    qr_code_data_url,
    totp_provisioning_uri,
)
from app.services.consumer_mfa import (
    clear_consumer_mfa,
    consumer_mfa_enabled,
    issue_consumer_mfa_challenge,
    verify_consumer_mfa_challenge,
)
from app.services.signature_sms import mask_phone, normalize_phone

router = APIRouter(prefix="/consumer/mfa", tags=["consumer-mfa"])
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


async def _current_account(
    principal: CurrentConsumerDep, session: DbSessionDep
) -> ConsumerAccount:
    account = await session.scalar(
        select(ConsumerAccount)
        .where(ConsumerAccount.id == principal.consumer_account_id)
        .with_for_update()
    )
    if account is None or account.deleted_at is not None:
        raise AppError(
            status_code=404,
            code="account_not_found",
            message="Account was not found",
            headers=NO_STORE,
        )
    return account


def _state(account: ConsumerAccount) -> MfaStateResponse:
    enabled = consumer_mfa_enabled(account)
    return MfaStateResponse(
        enabled=enabled,
        method=MfaMethod(account.mfa_method) if enabled else None,
        destination_masked=(
            mask_phone(account.mfa_phone_normalized)
            if enabled and account.mfa_phone_normalized
            else None
        ),
        enabled_at=account.mfa_enabled_at if enabled else None,
    )


def _invalid_code() -> AppError:
    return AppError(
        status_code=400,
        code="invalid_mfa_code",
        message="The verification code is invalid or has expired",
        headers=NO_STORE,
    )


@router.get("", response_model=MfaStateResponse)
async def get_consumer_mfa_state(
    principal: CurrentConsumerDep,
    session: DbSessionDep,
    response: Response,
) -> MfaStateResponse:
    account = await _current_account(principal, session)
    response.headers.update(NO_STORE)
    return _state(account)


@router.post("/enrollment", response_model=MfaChallengeResponse)
async def start_consumer_mfa_enrollment(
    payload: MfaEnrollmentRequest,
    request: Request,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    settings: SettingsDep,
    session: DbSessionDep,
    response: Response,
) -> MfaChallengeResponse:
    account = await _current_account(principal, session)
    if consumer_mfa_enabled(account):
        if payload.change_challenge_id is None:
            raise AppError(
                status_code=409,
                code="mfa_already_enabled",
                message="Multi-factor authentication is already enabled",
                headers=NO_STORE,
            )
        now = datetime.now(UTC)
        authorization = await session.scalar(
            select(ConsumerMfaChallenge)
            .where(
                ConsumerMfaChallenge.id == payload.change_challenge_id,
                ConsumerMfaChallenge.consumer_account_id == account.id,
                ConsumerMfaChallenge.purpose == MfaChallengePurpose.CHANGE.value,
                ConsumerMfaChallenge.method == account.mfa_method,
                ConsumerMfaChallenge.status == VerificationStatus.VERIFIED.value,
                ConsumerMfaChallenge.expires_at > now,
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
            account_email=account.email or account.full_name,
        )

    challenge, dev_code = await issue_consumer_mfa_challenge(
        session=session,
        request=request,
        settings=settings,
        account=account,
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
async def confirm_consumer_mfa_enrollment(
    payload: MfaChallengeConfirmation,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    settings: SettingsDep,
    session: DbSessionDep,
    response: Response,
) -> MfaStateResponse:
    account = await _current_account(principal, session)
    challenge = await session.scalar(
        select(ConsumerMfaChallenge)
        .where(
            ConsumerMfaChallenge.id == payload.challenge_id,
            ConsumerMfaChallenge.consumer_account_id == account.id,
            ConsumerMfaChallenge.purpose == MfaChallengePurpose.ENROLLMENT.value,
        )
        .with_for_update()
    )
    if challenge is None or not await verify_consumer_mfa_challenge(
        challenge=challenge,
        account=account,
        code=payload.code,
        settings=settings,
    ):
        raise _invalid_code()

    now = datetime.now(UTC)
    method = MfaMethod(challenge.method)
    account.mfa_method = method.value
    account.mfa_enabled_at = now
    if method == MfaMethod.SMS:
        account.mfa_phone_normalized = challenge.phone_normalized
        account.mfa_totp_secret_encrypted = None
        account.mfa_last_used_counter = None
    else:
        account.mfa_phone_normalized = None
        account.mfa_totp_secret_encrypted = challenge.totp_secret_encrypted
        account.mfa_last_used_counter = None
    await session.flush()
    response.headers.update(NO_STORE)
    return _state(account)


@router.post("/change-challenge", response_model=MfaChallengeResponse)
async def start_consumer_mfa_change_challenge(
    request: Request,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    settings: SettingsDep,
    session: DbSessionDep,
    response: Response,
) -> MfaChallengeResponse:
    account = await _current_account(principal, session)
    if not consumer_mfa_enabled(account):
        raise AppError(
            status_code=409,
            code="mfa_not_enabled",
            message="Multi-factor authentication is not enabled",
            headers=NO_STORE,
        )
    method = MfaMethod(account.mfa_method)
    challenge, dev_code = await issue_consumer_mfa_challenge(
        session=session,
        request=request,
        settings=settings,
        account=account,
        purpose=MfaChallengePurpose.CHANGE,
        method=method,
        phone_normalized=(account.mfa_phone_normalized if method == MfaMethod.SMS else None),
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
async def confirm_consumer_mfa_change(
    payload: MfaChallengeConfirmation,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    settings: SettingsDep,
    session: DbSessionDep,
    response: Response,
) -> MfaChangeAuthorizationResponse:
    account = await _current_account(principal, session)
    challenge = await session.scalar(
        select(ConsumerMfaChallenge)
        .where(
            ConsumerMfaChallenge.id == payload.challenge_id,
            ConsumerMfaChallenge.consumer_account_id == account.id,
            ConsumerMfaChallenge.purpose == MfaChallengePurpose.CHANGE.value,
            ConsumerMfaChallenge.method == account.mfa_method,
        )
        .with_for_update()
    )
    if challenge is None or not await verify_consumer_mfa_challenge(
        challenge=challenge,
        account=account,
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
async def start_consumer_mfa_disable_challenge(
    request: Request,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    settings: SettingsDep,
    session: DbSessionDep,
    response: Response,
) -> MfaChallengeResponse:
    account = await _current_account(principal, session)
    if not consumer_mfa_enabled(account):
        raise AppError(
            status_code=409,
            code="mfa_not_enabled",
            message="Multi-factor authentication is not enabled",
            headers=NO_STORE,
        )
    method = MfaMethod(account.mfa_method)
    challenge, dev_code = await issue_consumer_mfa_challenge(
        session=session,
        request=request,
        settings=settings,
        account=account,
        purpose=MfaChallengePurpose.DISABLE,
        method=method,
        phone_normalized=(account.mfa_phone_normalized if method == MfaMethod.SMS else None),
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
async def confirm_consumer_mfa_disable(
    payload: MfaChallengeConfirmation,
    _origin: TrustedOriginDep,
    principal: CurrentConsumerDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> Response:
    account = await _current_account(principal, session)
    challenge = await session.scalar(
        select(ConsumerMfaChallenge)
        .where(
            ConsumerMfaChallenge.id == payload.challenge_id,
            ConsumerMfaChallenge.consumer_account_id == account.id,
            ConsumerMfaChallenge.purpose == MfaChallengePurpose.DISABLE.value,
            ConsumerMfaChallenge.method == account.mfa_method,
        )
        .with_for_update()
    )
    if challenge is None or not await verify_consumer_mfa_challenge(
        challenge=challenge,
        account=account,
        code=payload.code,
        settings=settings,
    ):
        raise _invalid_code()
    clear_consumer_mfa(account)
    await session.flush()
    return Response(status_code=204, headers=NO_STORE)


@router.post("/login/confirm", response_model=ConsumerStateResponse)
async def confirm_consumer_mfa_login(
    payload: MfaChallengeConfirmation,
    _request: Request,
    response: Response,
    _origin: TrustedOriginDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> ConsumerStateResponse:
    challenge = await session.scalar(
        select(ConsumerMfaChallenge)
        .where(
            ConsumerMfaChallenge.id == payload.challenge_id,
            ConsumerMfaChallenge.purpose == MfaChallengePurpose.LOGIN.value,
        )
        .with_for_update()
    )
    if challenge is None:
        raise _invalid_code()
    account = await session.scalar(
        select(ConsumerAccount)
        .where(ConsumerAccount.id == challenge.consumer_account_id)
        .with_for_update()
    )
    if (
        account is None
        or account.deleted_at is not None
        or not consumer_mfa_enabled(account)
        or account.mfa_method != challenge.method
        or not await verify_consumer_mfa_challenge(
            challenge=challenge,
            account=account,
            code=payload.code,
            settings=settings,
        )
    ):
        raise _invalid_code()

    await _open_session(
        session=session,
        settings=settings,
        response=response,
        account=account,
    )
    response.headers["Cache-Control"] = "no-store"
    return await _state_response(session, account)
