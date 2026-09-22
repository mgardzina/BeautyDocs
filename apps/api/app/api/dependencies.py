from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import Annotated, cast

from fastapi import Depends, Path, Request
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_context import AuthenticatedConsumer, AuthenticatedUser, TenantAccess
from app.core.config import Settings
from app.core.context import RequestContext
from app.core.errors import AppError
from app.core.security import (
    is_valid_session_token,
    session_token_digest,
)
from app.core.tenant import build_request_context
from app.db.session import Database
from app.db.tenant_context import (
    set_session_digest_context,
    set_tenant_context,
    set_user_context,
)
from app.models.domain import (
    AuthSession,
    ConsumerAccount,
    ConsumerSession,
    MembershipRole,
    Tenant,
    TenantMembership,
    TenantStatus,
    User,
)

logger = logging.getLogger(__name__)


def get_runtime_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


SettingsDep = Annotated[Settings, Depends(get_runtime_settings)]


def get_request_context(request: Request, settings: SettingsDep) -> RequestContext:
    return build_request_context(request, settings)


RequestContextDep = Annotated[RequestContext, Depends(get_request_context)]


def get_database(request: Request) -> Database:
    return cast(Database, request.app.state.database)


DatabaseDep = Annotated[Database, Depends(get_database)]


async def get_db_session(database: DatabaseDep) -> AsyncIterator[AsyncSession]:
    if not database.configured:
        raise AppError(
            status_code=503,
            code="database_unavailable",
            message="Service is temporarily unavailable",
        )

    try:
        async with database.session() as session:
            yield session
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        logger.warning("Database request failed", exc_info=True)
        raise AppError(
            status_code=503,
            code="database_unavailable",
            message="Service is temporarily unavailable",
        ) from exc


DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]


def require_trusted_origin(request: Request, settings: SettingsDep) -> None:
    origin = request.headers.get("origin")
    if origin is None or origin not in settings.auth_allowed_origins:
        raise AppError(
            status_code=403,
            code="origin_not_allowed",
            message="Request origin is not allowed",
        )


TrustedOriginDep = Annotated[None, Depends(require_trusted_origin)]


def authentication_required_error() -> AppError:
    return AppError(
        status_code=401,
        code="authentication_required",
        message="Authentication is required",
        headers={
            "WWW-Authenticate": "Session",
            "Cache-Control": "no-store",
        },
    )


async def get_current_user(
    request: Request,
    settings: SettingsDep,
    session: DbSessionDep,
) -> AuthenticatedUser:
    raw_token = request.cookies.get(settings.auth_session_cookie_name)
    if not is_valid_session_token(raw_token):
        raise authentication_required_error()

    assert raw_token is not None
    digest = session_token_digest(raw_token)
    await set_session_digest_context(session, digest)
    row = (
        await session.execute(
            select(User.id, User.email, User.display_name)
            .join(AuthSession, AuthSession.user_id == User.id)
            .where(
                AuthSession.token_digest == digest,
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > func.now(),
                User.is_active.is_(True),
                User.deleted_at.is_(None),
            )
        )
    ).one_or_none()
    if row is None:
        raise authentication_required_error()

    principal = AuthenticatedUser(
        user_id=row.id,
        email=row.email,
        display_name=row.display_name,
    )
    await set_user_context(session, principal.user_id)
    return principal


CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]


async def get_optional_consumer(
    request: Request,
    settings: SettingsDep,
    session: DbSessionDep,
) -> AuthenticatedConsumer | None:
    raw_token = request.cookies.get(settings.consumer_session_cookie_name)
    if not is_valid_session_token(raw_token):
        return None
    assert raw_token is not None
    digest = session_token_digest(raw_token)
    row = (
        await session.execute(
            select(
                ConsumerAccount.id,
                ConsumerAccount.phone_normalized,
                ConsumerAccount.full_name,
            )
            .join(
                ConsumerSession,
                ConsumerSession.consumer_account_id == ConsumerAccount.id,
            )
            .where(
                ConsumerSession.token_digest == digest,
                ConsumerSession.revoked_at.is_(None),
                ConsumerSession.expires_at > func.now(),
                ConsumerAccount.deleted_at.is_(None),
            )
        )
    ).one_or_none()
    if row is None:
        return None
    return AuthenticatedConsumer(
        consumer_account_id=row.id,
        phone_normalized=row.phone_normalized,
        full_name=row.full_name,
    )


OptionalConsumerDep = Annotated[AuthenticatedConsumer | None, Depends(get_optional_consumer)]


async def require_consumer(
    principal: OptionalConsumerDep,
) -> AuthenticatedConsumer:
    if principal is None:
        raise authentication_required_error()
    return principal


CurrentConsumerDep = Annotated[AuthenticatedConsumer, Depends(require_consumer)]
TenantSlugPath = Annotated[
    str,
    Path(
        min_length=1,
        max_length=63,
        pattern=r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$",
    ),
]


async def require_tenant_membership(
    slug: TenantSlugPath,
    principal: CurrentUserDep,
    session: DbSessionDep,
) -> TenantAccess:
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

    await set_tenant_context(session, tenant.id)
    role_value = await session.scalar(
        select(TenantMembership.role).where(
            TenantMembership.tenant_id == tenant.id,
            TenantMembership.user_id == principal.user_id,
            TenantMembership.is_active.is_(True),
            TenantMembership.role.in_([role.value for role in MembershipRole]),
        )
    )
    if role_value is None:
        raise AppError(
            status_code=403,
            code="tenant_access_denied",
            message="Access to this tenant is denied",
        )

    return TenantAccess(
        principal=principal,
        tenant=tenant,
        role=MembershipRole(role_value),
    )


TenantAccessDep = Annotated[TenantAccess, Depends(require_tenant_membership)]


def enforce_roles(access: TenantAccess, allowed_roles: frozenset[MembershipRole]) -> None:
    if access.role not in allowed_roles:
        raise AppError(
            status_code=403,
            code="insufficient_role",
            message="Your role does not allow this operation",
        )
