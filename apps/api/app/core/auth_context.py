from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.models.domain import MembershipRole, Tenant


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    user_id: UUID
    email: str
    display_name: str


@dataclass(frozen=True, slots=True)
class AuthenticatedConsumer:
    consumer_account_id: UUID
    phone_normalized: str | None
    full_name: str


@dataclass(frozen=True, slots=True)
class TenantAccess:
    principal: AuthenticatedUser
    tenant: Tenant
    role: MembershipRole
