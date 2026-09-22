"""Issue opaque server-side sessions for staff and owner accounts."""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security import generate_session_token, session_token_digest
from app.db.tenant_context import set_session_digest_context
from app.models.domain import AuthSession, User


async def open_staff_session(
    *,
    session: AsyncSession,
    settings: Settings,
    response: Response,
    user: User,
    now: datetime,
) -> None:
    raw_token = generate_session_token()
    token_digest = session_token_digest(raw_token)
    expires_at = now + timedelta(seconds=settings.auth_session_ttl_seconds)
    await set_session_digest_context(session, token_digest)
    session.add(
        AuthSession(
            user_id=user.id,
            token_digest=token_digest,
            expires_at=expires_at,
        )
    )
    await session.flush()
    response.headers["Cache-Control"] = "no-store"
    response.set_cookie(
        key=settings.auth_session_cookie_name,
        value=raw_token,
        max_age=settings.auth_session_ttl_seconds,
        expires=expires_at,
        path="/",
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite="lax",
    )
