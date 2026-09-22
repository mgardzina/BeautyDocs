from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from anyio import to_thread
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import select

from app.api.dependencies import (
    CurrentUserDep,
    DbSessionDep,
    SettingsDep,
    TrustedOriginDep,
)
from app.core.errors import AppError, error_response
from app.core.security import (
    is_valid_session_token,
    normalize_email,
    session_token_digest,
    verify_dummy_password,
    verify_password,
)
from app.db.tenant_context import (
    set_session_digest_context,
    set_user_context,
)
from app.models.domain import (
    AuthSession,
    ConsumerAccount,
    ConsumerGoogleIdentity,
    MembershipRole,
    MfaChallengePurpose,
    MfaMethod,
    Tenant,
    TenantMembership,
    TenantStatus,
    User,
    UserGoogleIdentity,
)
from app.services.account_mfa import issue_mfa_challenge, mfa_enabled
from app.services.google_identity import (
    GoogleIdentityVerificationError,
    resolve_google_identity,
)
from app.services.staff_sessions import open_staff_session

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthResponseModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)


class AuthUserResponse(AuthResponseModel):
    email: str = Field(max_length=320)
    display_name: str = Field(max_length=200)


class MembershipResponse(AuthResponseModel):
    tenant_slug: str = Field(max_length=63)
    tenant_display_name: str = Field(max_length=200)
    role: MembershipRole


class AuthStateResponse(AuthResponseModel):
    user: AuthUserResponse
    memberships: list[MembershipResponse] = Field(max_length=100)


class MfaLoginChallengeResponse(AuthResponseModel):
    mfa_required: Literal[True] = True
    challenge_id: UUID
    method: MfaMethod
    destination_masked: str | None = Field(default=None, max_length=64)
    expires_in_seconds: int = Field(ge=120, le=900)
    dev_code: str | None = Field(default=None, min_length=6, max_length=6)


class GoogleResolveRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    credential: str | None = Field(default=None, min_length=20, max_length=8_192)
    access_token: str | None = Field(default=None, min_length=20, max_length=8_192)


class GoogleResolveResponse(AuthResponseModel):
    target: Literal["staff", "consumer", "none"]


async def _load_memberships(
    session: DbSessionDep,
    *,
    user_id: UUID,
    email: str,
    display_name: str,
) -> AuthStateResponse:
    rows = (
        await session.execute(
            select(
                Tenant.slug,
                Tenant.display_name,
                TenantMembership.role,
            )
            .join(TenantMembership, TenantMembership.tenant_id == Tenant.id)
            .where(
                TenantMembership.user_id == user_id,
                TenantMembership.is_active.is_(True),
                Tenant.status == TenantStatus.ACTIVE.value,
            )
            .order_by(Tenant.display_name, Tenant.slug)
        )
    ).all()
    return AuthStateResponse(
        user=AuthUserResponse(email=email, display_name=display_name),
        memberships=[
            MembershipResponse(
                tenant_slug=tenant_slug,
                tenant_display_name=tenant_display_name,
                role=MembershipRole(role),
            )
            for tenant_slug, tenant_display_name, role in rows
        ],
    )


def _invalid_credentials(request: Request) -> JSONResponse:
    return error_response(
        request,
        status_code=401,
        code="invalid_credentials",
        message="Email or password is incorrect",
        headers={"Cache-Control": "no-store"},
    )


@router.post(
    "/login",
    response_model=AuthStateResponse | MfaLoginChallengeResponse,
    responses={401: {"description": "Invalid credentials"}},
)
async def login(
    credentials: LoginRequest,
    request: Request,
    response: Response,
    _origin: TrustedOriginDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> AuthStateResponse | MfaLoginChallengeResponse | JSONResponse:
    now = datetime.now(UTC)
    normalized_email = normalize_email(credentials.email)
    user = await session.scalar(
        select(User).where(User.email_normalized == normalized_email).with_for_update()
    )

    if user is None:
        await to_thread.run_sync(verify_dummy_password, credentials.password)
        return _invalid_credentials(request)

    password_check = await to_thread.run_sync(
        verify_password,
        credentials.password,
        user.password_hash,
    )
    currently_locked = user.locked_until is not None and user.locked_until > now
    if not password_check.valid or currently_locked or not user.is_active:
        if user.is_active and not currently_locked and not password_check.valid:
            previous_attempts = (
                0
                if user.locked_until is not None and user.locked_until <= now
                else user.failed_login_attempts
            )
            user.failed_login_attempts = previous_attempts + 1
            if user.failed_login_attempts >= settings.auth_login_max_attempts:
                user.locked_until = now + timedelta(seconds=settings.auth_lockout_seconds)
        return _invalid_credentials(request)

    if password_check.upgraded_hash is not None:
        user.password_hash = password_check.upgraded_hash
    user.failed_login_attempts = 0
    user.locked_until = None

    if mfa_enabled(user):
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


@router.post("/google/resolve", response_model=GoogleResolveResponse)
async def resolve_google_target(
    payload: GoogleResolveRequest,
    _origin: TrustedOriginDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> GoogleResolveResponse:
    """Report which account a Google credential maps to, without creating one.

    Lets the unified sign-in screen route an existing salon user to the salon
    panel and everyone else (including brand-new Google users) to the client
    panel, where the consumer flow provisions the account.
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

    staff_identity = await session.scalar(
        select(UserGoogleIdentity.id).where(
            UserGoogleIdentity.google_subject == verified.subject
        )
    )
    if staff_identity is not None:
        return GoogleResolveResponse(target="staff")

    consumer_identity = await session.scalar(
        select(ConsumerGoogleIdentity.id).where(
            ConsumerGoogleIdentity.google_subject == verified.subject
        )
    )
    if consumer_identity is not None:
        return GoogleResolveResponse(target="consumer")

    # No linked identity yet — match by e-mail, client-first per product choice.
    consumer_by_email = await session.scalar(
        select(ConsumerAccount.id).where(
            ConsumerAccount.email_normalized == verified.email_normalized,
            ConsumerAccount.deleted_at.is_(None),
        )
    )
    if consumer_by_email is not None:
        return GoogleResolveResponse(target="consumer")

    user_by_email = await session.scalar(
        select(User.id).where(User.email_normalized == verified.email_normalized)
    )
    if user_by_email is not None:
        return GoogleResolveResponse(target="staff")

    return GoogleResolveResponse(target="none")


@router.post("/logout", status_code=204, response_class=Response)
async def logout(
    request: Request,
    _origin: TrustedOriginDep,
    settings: SettingsDep,
    session: DbSessionDep,
) -> Response:
    raw_token = request.cookies.get(settings.auth_session_cookie_name)
    if is_valid_session_token(raw_token):
        assert raw_token is not None
        digest = session_token_digest(raw_token)
        await set_session_digest_context(session, digest)
        auth_session = await session.scalar(
            select(AuthSession).where(AuthSession.token_digest == digest)
        )
        if auth_session is not None and auth_session.revoked_at is None:
            auth_session.revoked_at = datetime.now(UTC)

    response = Response(status_code=204, headers={"Cache-Control": "no-store"})
    response.delete_cookie(
        key=settings.auth_session_cookie_name,
        path="/",
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite="lax",
    )
    return response


@router.get("/me", response_model=AuthStateResponse)
async def me(
    response: Response,
    principal: CurrentUserDep,
    session: DbSessionDep,
) -> AuthStateResponse:
    response.headers["Cache-Control"] = "no-store"
    return await _load_memberships(
        session,
        user_id=principal.user_id,
        email=principal.email,
        display_name=principal.display_name,
    )
