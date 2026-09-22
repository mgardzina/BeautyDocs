from __future__ import annotations

import base64
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db_session, require_tenant_membership
from app.core.auth_context import AuthenticatedUser, TenantAccess
from app.core.config import Settings
from app.main import create_app
from app.models.domain import (
    MembershipRole,
    StaffInvitation,
    TeamMember,
    Tenant,
    TenantStatus,
)

NOW = datetime(2026, 7, 28, 10, 0, tzinfo=UTC)
SIGNATURE_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
SIGNATURE_DATA_URL = f"data:image/png;base64,{SIGNATURE_PNG_BASE64}"
SIGNATURE_BYTES = base64.b64decode(SIGNATURE_PNG_BASE64)


def _tenant() -> Tenant:
    return Tenant(
        id=uuid4(),
        slug="salon-a",
        display_name="Salon A",
        legal_name="Salon A sp. z o.o.",
        email="contact@example.test",
        privacy_contact_email="privacy@example.test",
        country_code="PL",
        status=TenantStatus.ACTIVE.value,
        created_at=NOW,
        updated_at=NOW,
    )


def _access(tenant: Tenant, role: MembershipRole) -> TenantAccess:
    return TenantAccess(
        principal=AuthenticatedUser(
            user_id=uuid4(),
            email="owner@example.test",
            display_name="Owner",
        ),
        tenant=tenant,
        role=role,
    )


def _member(tenant: Tenant, *, is_owner: bool = False) -> TeamMember:
    return TeamMember(
        id=uuid4(),
        tenant_id=tenant.id,
        membership_id=uuid4() if is_owner else None,
        display_name="Anna Nowak",
        email="anna@example.test",
        job_title="Kosmetolog",
        is_owner=is_owner,
        performs_treatments=True,
        all_treatments=True,
        treatment_codes=[],
        is_active=True,
        signature_data_url=None,
        signature_updated_at=None,
        created_at=NOW,
        updated_at=NOW,
    )


def _rows(items: list[object]) -> MagicMock:
    result = MagicMock()
    result.all.return_value = items
    return result


def _test_app(
    session: MagicMock,
    access: TenantAccess,
    settings: Settings | None = None,
) -> FastAPI:
    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    async def override_access() -> TenantAccess:
        return access

    app = create_app(settings or Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_tenant_membership] = override_access
    return app


@pytest.mark.parametrize("role", list(MembershipRole))
def test_team_list_is_available_to_every_membership_role(
    role: MembershipRole,
) -> None:
    tenant = _tenant()
    member = _member(tenant)
    session = MagicMock(spec=AsyncSession)
    session.scalars = AsyncMock(return_value=_rows([member]))
    app = _test_app(session, _access(tenant, role))

    with TestClient(app) as client:
        response = client.get("/api/v1/admin/tenants/salon-a/team")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, no-store"
    assert response.json() == {
        "items": [
            {
                "id": str(member.id),
                "displayName": "Anna Nowak",
                "email": "anna@example.test",
                "phone": None,
                "jobTitle": "Kosmetolog",
                "isOwner": False,
                "performsTreatments": True,
                "allTreatments": True,
                "treatmentCodes": [],
                "isActive": True,
                "hasPanelAccess": False,
                "signatureConfigured": False,
                "smsSigningReady": False,
                "signatureUpdatedAt": None,
                "createdAt": "2026-07-28T10:00:00Z",
                "updatedAt": "2026-07-28T10:00:00Z",
            }
        ],
        "canManage": role in {MembershipRole.OWNER, MembershipRole.ADMIN},
    }
    assert "team_members.tenant_id" in str(session.scalars.await_args.args[0])


@pytest.mark.parametrize(
    "role",
    [MembershipRole.STAFF, MembershipRole.READ_ONLY],
)
def test_only_owner_and_admin_can_create_team_profiles(
    role: MembershipRole,
) -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    app = _test_app(session, _access(tenant, role))

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/tenants/salon-a/team",
            json={
                "displayName": "Anna Nowak",
                "email": "anna@example.test",
                "jobTitle": "Kosmetolog",
                "performsTreatments": True,
            },
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "insufficient_role"
    session.add.assert_not_called()


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        (
            "POST",
            "/api/v1/admin/tenants/salon-a/team",
            {
                "displayName": "Anna Nowak",
                "email": "anna@example.test",
                "phone": "+48500600700",
                "jobTitle": "Kosmetolog",
                "performsTreatments": True,
                "allTreatments": True,
                "treatmentCodes": [],
            },
        ),
        (
            "PUT",
            "/api/v1/admin/tenants/salon-a/team/55555555-5555-4555-8555-555555555555",
            {
                "displayName": "Anna Nowak",
                "email": "anna@example.test",
                "phone": "+48500600700",
                "jobTitle": "Kosmetolog",
                "performsTreatments": True,
                "allTreatments": True,
                "treatmentCodes": [],
                "isActive": True,
            },
        ),
    ],
)
def test_owner_cannot_set_team_member_phone_through_api(
    method: str,
    path: str,
    payload: dict[str, object],
) -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    app = _test_app(session, _access(tenant, MembershipRole.OWNER))

    with TestClient(app) as client:
        response = client.request(method, path, json=payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert response.json()["error"]["details"][0]["type"] == "extra_forbidden"
    session.add.assert_not_called()


def test_owner_can_invite_employee_with_one_time_link_and_qr() -> None:
    tenant = _tenant()
    actor_membership_id = uuid4()
    session = MagicMock(spec=AsyncSession)
    added: list[object] = []

    def add(value: object) -> None:
        added.append(value)
        if isinstance(value, StaffInvitation) and value.id is None:
            value.id = uuid4()

    session.add = MagicMock(side_effect=add)
    session.scalar = AsyncMock(side_effect=[None, actor_membership_id])
    session.execute = AsyncMock(return_value=MagicMock())
    session.flush = AsyncMock()
    app = _test_app(
        session,
        _access(tenant, MembershipRole.OWNER),
        Settings(
            _env_file=None,
            public_web_url="https://app.beautydocs.test",
        ),
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/tenants/salon-a/team/invitations",
            headers={"Origin": "http://localhost:3000"},
            json={
                "email": "anna@example.test",
            },
        )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "anna@example.test"
    assert body["salonName"] == "Salon A"
    assert body["activationUrl"].startswith(
        "https://app.beautydocs.test/beautydocs-zaproszenie?token="
    )
    assert body["qrCodeDataUrl"].startswith("data:image/png;base64,")
    invitation = next(value for value in added if isinstance(value, StaffInvitation))
    assert invitation.tenant_id == tenant.id
    assert invitation.invited_by_membership_id == actor_membership_id
    assert invitation.job_title is None
    assert invitation.performs_treatments is True
    assert invitation.token_digest not in body["activationUrl"]


def test_staff_invitation_accepts_only_email() -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    app = _test_app(session, _access(tenant, MembershipRole.OWNER))

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/tenants/salon-a/team/invitations",
            headers={"Origin": "http://localhost:3000"},
            json={
                "email": "anna@example.test",
                "performsTreatments": False,
            },
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert response.json()["error"]["details"][0]["type"] == "extra_forbidden"
    session.add.assert_not_called()


def test_owner_can_save_a_valid_reusable_signature() -> None:
    tenant = _tenant()
    member = _member(tenant)
    actor_membership_id = uuid4()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[member, actor_membership_id])
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    app = _test_app(session, _access(tenant, MembershipRole.OWNER))

    with TestClient(app) as client:
        response = client.put(
            f"/api/v1/admin/tenants/salon-a/team/{member.id}/signature",
            json={"signature": SIGNATURE_DATA_URL},
        )

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, no-store"
    assert response.json()["signatureConfigured"] is True
    assert response.json()["signatureUpdatedAt"] is not None
    assert member.signature_data_url == SIGNATURE_DATA_URL
    session.flush.assert_awaited_once()
    session.refresh.assert_awaited_once_with(member)


def test_admin_cannot_replace_signature_of_linked_employee() -> None:
    tenant = _tenant()
    member = _member(tenant)
    member.membership_id = uuid4()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[member, uuid4()])
    app = _test_app(session, _access(tenant, MembershipRole.ADMIN))

    with TestClient(app) as client:
        response = client.put(
            f"/api/v1/admin/tenants/salon-a/team/{member.id}/signature",
            json={"signature": SIGNATURE_DATA_URL},
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "team_member_signature_self_managed"
    assert member.signature_data_url is None


def test_owner_cannot_replace_own_signature_through_team_api() -> None:
    tenant = _tenant()
    member = _member(tenant, is_owner=True)
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=member)
    app = _test_app(session, _access(tenant, MembershipRole.OWNER))

    with TestClient(app) as client:
        response = client.put(
            f"/api/v1/admin/tenants/salon-a/team/{member.id}/signature",
            json={"signature": SIGNATURE_DATA_URL},
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "team_member_signature_self_managed"
    assert member.signature_data_url is None


def test_invalid_signature_is_rejected_before_database_access() -> None:
    tenant = _tenant()
    member_id = uuid4()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock()
    app = _test_app(session, _access(tenant, MembershipRole.ADMIN))

    with TestClient(app) as client:
        response = client.put(
            f"/api/v1/admin/tenants/salon-a/team/{member_id}/signature",
            json={"signature": "data:image/png;base64,bm90LWEtcG5n"},
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_team_member_signature"
    assert response.headers["Cache-Control"] == "private, no-store"
    session.scalar.assert_not_awaited()


def test_signature_image_is_returned_as_private_png() -> None:
    tenant = _tenant()
    member_id = uuid4()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=SIGNATURE_DATA_URL)
    app = _test_app(session, _access(tenant, MembershipRole.READ_ONLY))

    with TestClient(app) as client:
        response = client.get(f"/api/v1/admin/tenants/salon-a/team/{member_id}/signature")

    assert response.status_code == 200
    assert response.content == SIGNATURE_BYTES
    assert response.headers["content-type"] == "image/png"
    assert response.headers["Cache-Control"] == "private, no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "team_members.tenant_id" in str(session.scalar.await_args.args[0])


def test_owner_profile_cannot_be_deactivated() -> None:
    tenant = _tenant()
    member = _member(tenant, is_owner=True)
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=member)
    app = _test_app(session, _access(tenant, MembershipRole.OWNER))

    with TestClient(app) as client:
        response = client.put(
            f"/api/v1/admin/tenants/salon-a/team/{member.id}",
            json={
                "displayName": "Owner",
                "email": "owner@example.test",
                "jobTitle": "Właściciel salonu",
                "performsTreatments": True,
                "allTreatments": True,
                "treatmentCodes": [],
                "isActive": False,
            },
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "owner_profile_must_remain_active"


def test_linked_user_personal_data_cannot_be_changed_through_team_api() -> None:
    tenant = _tenant()
    member = _member(tenant, is_owner=True)
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=member)
    app = _test_app(session, _access(tenant, MembershipRole.OWNER))

    with TestClient(app) as client:
        response = client.put(
            f"/api/v1/admin/tenants/salon-a/team/{member.id}",
            json={
                "displayName": "Zmienione Imię",
                "email": "changed@example.test",
                "jobTitle": "Właściciel salonu",
                "performsTreatments": True,
                "allTreatments": True,
                "treatmentCodes": [],
                "isActive": True,
            },
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "team_member_personal_data_self_managed"
    assert member.display_name == "Anna Nowak"
    assert member.email == "anna@example.test"


def test_owner_can_update_only_salon_fields_of_a_linked_profile() -> None:
    tenant = _tenant()
    member = _member(tenant, is_owner=True)
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[member, member.membership_id])
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    app = _test_app(session, _access(tenant, MembershipRole.OWNER))

    with TestClient(app) as client:
        response = client.put(
            f"/api/v1/admin/tenants/salon-a/team/{member.id}",
            json={
                "displayName": member.display_name,
                "email": member.email,
                "jobTitle": "Linergistka",
                "performsTreatments": False,
                "allTreatments": True,
                "treatmentCodes": [],
                "isActive": True,
            },
        )

    assert response.status_code == 200
    assert member.display_name == "Anna Nowak"
    assert member.email == "anna@example.test"
    assert member.job_title == "Linergistka"
    assert member.performs_treatments is False
