from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    get_db_session,
    require_tenant_membership,
    require_trusted_origin,
)
from app.core.auth_context import AuthenticatedUser, TenantAccess
from app.core.config import Settings
from app.main import create_app
from app.models.domain import AuditEvent, MembershipRole, Tenant, TenantStatus


def _tenant() -> Tenant:
    now = datetime(2026, 8, 1, 12, 0, tzinfo=UTC)
    return Tenant(
        id=uuid4(),
        slug="salon-a",
        display_name="Salon A",
        legal_name="Salon A sp. z o.o.",
        nip="8652314272",
        email="kontakt@example.test",
        privacy_contact_email="rodo@example.test",
        phone="+48600700800",
        address_line1="Kwiatowa 1",
        postal_code="00-001",
        city="Warszawa",
        country_code="PL",
        status=TenantStatus.ACTIVE.value,
        created_at=now,
        updated_at=now,
    )


def _app(session: MagicMock, tenant: Tenant, role: MembershipRole) -> FastAPI:
    access = TenantAccess(
        principal=AuthenticatedUser(
            user_id=uuid4(),
            email="user@example.test",
            display_name="User",
        ),
        tenant=tenant,
        role=role,
    )

    async def override_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_session
    app.dependency_overrides[require_tenant_membership] = lambda: access
    app.dependency_overrides[require_trusted_origin] = lambda: None
    return app


def test_staff_can_view_but_not_edit_tenant_settings() -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    app = _app(session, tenant, MembershipRole.STAFF)

    with TestClient(app) as client:
        get_response = client.get("/api/v1/admin/tenants/salon-a/settings")
        put_response = client.put(
            "/api/v1/admin/tenants/salon-a/settings",
            json={
                "displayName": "Nowa nazwa",
                "legalName": "Nowa nazwa sp. z o.o.",
                "email": "kontakt@example.test",
                "privacyContactEmail": "rodo@example.test",
            },
        )

    assert get_response.status_code == 200
    assert get_response.json()["canEdit"] is False
    assert get_response.json()["canDelete"] is False
    assert put_response.status_code == 403
    assert tenant.display_name == "Salon A"


def test_owner_can_update_tenant_settings() -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    session.flush = AsyncMock()
    app = _app(session, tenant, MembershipRole.OWNER)

    with TestClient(app) as client:
        response = client.put(
            "/api/v1/admin/tenants/salon-a/settings",
            json={
                "displayName": "  Salon Nova  ",
                "legalName": "Salon Nova sp. z o.o.",
                "email": "NOWY@example.test",
                "privacyContactEmail": "RODO@example.test",
                "city": "Kraków",
            },
        )

    assert response.status_code == 200
    assert response.json()["displayName"] == "Salon Nova"
    assert response.json()["email"] == "nowy@example.test"
    assert response.json()["canDelete"] is True
    assert tenant.city == "Kraków"
    assert tenant.directory_visible is True


def test_owner_cannot_change_nip_regon_or_krs_once_set() -> None:
    tenant = _tenant()
    tenant.regon = "123456785"
    tenant.krs = "0000123456"
    session = MagicMock(spec=AsyncSession)
    session.flush = AsyncMock()
    app = _app(session, tenant, MembershipRole.OWNER)

    with TestClient(app) as client:
        response = client.put(
            "/api/v1/admin/tenants/salon-a/settings",
            json={
                "displayName": "Salon A",
                "legalName": "Salon A sp. z o.o.",
                "nip": "5252445767",
                "regon": "987654321",
                "krs": "0000999999",
                "email": "kontakt@example.test",
                "privacyContactEmail": "rodo@example.test",
            },
        )

    assert response.status_code == 200
    assert response.json()["nip"] == "8652314272"
    assert response.json()["regon"] == "123456785"
    assert response.json()["krs"] == "0000123456"
    assert tenant.nip == "8652314272"
    assert tenant.regon == "123456785"
    assert tenant.krs == "0000123456"


def test_owner_cannot_change_legal_name_once_set() -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    session.flush = AsyncMock()
    app = _app(session, tenant, MembershipRole.OWNER)

    with TestClient(app) as client:
        response = client.put(
            "/api/v1/admin/tenants/salon-a/settings",
            json={
                "displayName": "Salon Nova",
                "legalName": "Inna Firma sp. z o.o.",
                "email": "kontakt@example.test",
                "privacyContactEmail": "rodo@example.test",
            },
        )

    assert response.status_code == 200
    assert response.json()["displayName"] == "Salon Nova"
    assert response.json()["legalName"] == "Salon A sp. z o.o."
    assert tenant.legal_name == "Salon A sp. z o.o."


def test_owner_can_set_nip_regon_and_krs_once_when_missing() -> None:
    tenant = _tenant()
    tenant.nip = None
    session = MagicMock(spec=AsyncSession)
    session.flush = AsyncMock()
    app = _app(session, tenant, MembershipRole.OWNER)

    with TestClient(app) as client:
        response = client.put(
            "/api/v1/admin/tenants/salon-a/settings",
            json={
                "displayName": "Salon A",
                "legalName": "Salon A sp. z o.o.",
                "nip": "5252445767",
                "regon": "123456785",
                "krs": "0000123456",
                "email": "kontakt@example.test",
                "privacyContactEmail": "rodo@example.test",
            },
        )

    assert response.status_code == 200
    assert response.json()["nip"] == "5252445767"
    assert response.json()["regon"] == "123456785"
    assert response.json()["krs"] == "0000123456"


def test_owner_can_enable_salon_directory_visibility() -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    session.flush = AsyncMock()
    app = _app(session, tenant, MembershipRole.OWNER)

    with TestClient(app) as client:
        response = client.put(
            "/api/v1/admin/tenants/salon-a/settings",
            json={
                "displayName": "Salon A",
                "legalName": "Salon A sp. z o.o.",
                "email": "kontakt@example.test",
                "privacyContactEmail": "rodo@example.test",
                "directoryVisible": True,
            },
        )

    assert response.status_code == 200
    assert response.json()["directoryVisible"] is True
    assert tenant.directory_visible is True


def test_owner_can_update_calendar_working_hours() -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    session.flush = AsyncMock()
    app = _app(session, tenant, MembershipRole.OWNER)
    schedule = {
        "slotIntervalMinutes": 30,
        "days": [
            {
                "weekday": weekday,
                "enabled": weekday < 6,
                "opensAt": "07:00" if weekday < 5 else "09:00",
                "closesAt": "15:00" if weekday < 5 else "13:00",
            }
            for weekday in range(7)
        ],
    }

    with TestClient(app) as client:
        response = client.put(
            "/api/v1/admin/tenants/salon-a/settings",
            json={
                "displayName": "Salon A",
                "legalName": "Salon A sp. z o.o.",
                "email": "kontakt@example.test",
                "privacyContactEmail": "rodo@example.test",
                "bookingSchedule": schedule,
            },
        )

    assert response.status_code == 200
    assert response.json()["bookingSchedule"] == schedule
    assert tenant.booking_schedule == schedule


def test_owner_can_close_salon_with_audited_retention_request() -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=uuid4())
    session.flush = AsyncMock()
    app = _app(session, tenant, MembershipRole.OWNER)

    with TestClient(app) as client:
        response = client.request(
            "DELETE",
            "/api/v1/admin/tenants/salon-a",
            json={"confirmation": "USUŃ SALON"},
        )

    assert response.status_code == 204
    assert tenant.status == TenantStatus.ARCHIVED.value
    assert tenant.deletion_requested_at is not None
    audit = session.add.call_args.args[0]
    assert isinstance(audit, AuditEvent)
    assert audit.action == "tenant.deletion_requested"
    assert audit.details == {"retentionReviewRequired": True}
