"""Helpers for PostgreSQL Row-Level Security tenant context.

The tenant identifier is deliberately transaction-local. Reused pooled
connections therefore cannot retain a previous request's salon context.
Call this after opening the transaction and before any tenant-owned query.
"""

from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

TENANT_SETTING = "app.tenant_id"
USER_SETTING = "app.user_id"
SESSION_DIGEST_SETTING = "app.session_digest"
MFA_CHALLENGE_SETTING = "app.mfa_challenge_id"
SHA256_HEX_PATTERN = re.compile(r"^[0-9a-f]{64}$")


async def set_tenant_context(session: AsyncSession, tenant_id: UUID) -> None:
    """Set the tenant visible to RLS for the current database transaction."""

    if not isinstance(tenant_id, UUID):
        raise TypeError("tenant_id must be a UUID")

    await session.execute(
        text("SELECT set_config(:setting_name, :tenant_id, true)"),
        {"setting_name": TENANT_SETTING, "tenant_id": str(tenant_id)},
    )


async def set_user_context(session: AsyncSession, user_id: UUID) -> None:
    """Set the authenticated user visible to membership RLS."""

    if not isinstance(user_id, UUID):
        raise TypeError("user_id must be a UUID")
    await session.execute(
        text("SELECT set_config(:setting_name, :user_id, true)"),
        {"setting_name": USER_SETTING, "user_id": str(user_id)},
    )


async def set_session_digest_context(session: AsyncSession, digest: str) -> None:
    """Scope auth-session RLS to one opaque token digest."""

    if not SHA256_HEX_PATTERN.fullmatch(digest):
        raise ValueError("session digest must be a lowercase SHA-256 hex digest")
    await session.execute(
        text("SELECT set_config(:setting_name, :digest, true)"),
        {"setting_name": SESSION_DIGEST_SETTING, "digest": digest},
    )


async def set_mfa_challenge_context(session: AsyncSession, challenge_id: UUID) -> None:
    """Scope MFA challenge RLS to one unguessable challenge identifier."""

    if not isinstance(challenge_id, UUID):
        raise TypeError("challenge_id must be a UUID")
    await session.execute(
        text("SELECT set_config(:setting_name, :challenge_id, true)"),
        {"setting_name": MFA_CHALLENGE_SETTING, "challenge_id": str(challenge_id)},
    )
