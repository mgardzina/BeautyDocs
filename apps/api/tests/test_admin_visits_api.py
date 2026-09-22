from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db_session, require_tenant_membership
from app.core.auth_context import AuthenticatedUser, TenantAccess
from app.core.config import Settings
from app.main import create_app
from app.models.domain import (
    Client,
    FormTemplate,
    MembershipRole,
    TemplateStatus,
    Tenant,
    TenantStatus,
    Visit,
)

NOW = datetime(2026, 8, 8, 10, 0, tzinfo=UTC)


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
            email="staff@example.test",
            display_name="Staff",
        ),
        tenant=tenant,
        role=role,
    )


def _test_app(session: MagicMock, access: TenantAccess) -> FastAPI:
    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    async def override_access() -> TenantAccess:
        return access

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_tenant_membership] = override_access
    return app


def test_staff_can_create_a_manual_visit() -> None:
    tenant = _tenant()
    client_row = Client(
        id=uuid4(),
        tenant_id=tenant.id,
        first_name="Anna",
        last_name="Testowa",
        first_name_normalized="anna",
        last_name_normalized="testowa",
        phone="+48 111 222 333",
        phone_normalized="48111222333",
        archived_at=None,
        created_at=NOW,
        updated_at=NOW,
    )
    form = FormTemplate(
        id=uuid4(),
        code="makijaz-permanentny",
        name="Makijaż permanentny",
        status=TemplateStatus.ACTIVE.value,
        created_at=NOW,
        updated_at=NOW,
    )
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[tenant, client_row, None, None])
    form_result = MagicMock()
    form_result.first.return_value = (form, 90)
    session.execute = AsyncMock(return_value=form_result)

    async def flush() -> None:
        added = session.add.call_args.args[0]
        if isinstance(added, Visit):
            added.id = uuid4()

    session.flush = AsyncMock(side_effect=flush)
    app = _test_app(session, _access(tenant, MembershipRole.STAFF))

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/tenants/salon-a/visits",
            headers={"Origin": "http://localhost:3000"},
            json={
                "clientId": str(client_row.id),
                "formCode": form.code,
                "startsAt": "2030-09-02T10:00:00Z",
            },
        )

    assert response.status_code == 201
    assert response.json()["clientName"] == "Anna Testowa"
    assert response.json()["formCode"] == form.code
    assert response.json()["startsAt"] == "2030-09-02T10:00:00Z"
    added = session.add.call_args.args[0]
    assert isinstance(added, Visit)
    assert added.client_id == client_row.id
    assert added.form_template_id == form.id
    assert added.ends_at == datetime(2030, 9, 2, 11, 30, tzinfo=UTC)


def test_staff_can_create_a_visit_for_a_client_without_an_app_account() -> None:
    tenant = _tenant()
    form = FormTemplate(
        id=uuid4(),
        code="makijaz-permanentny",
        name="Makijaż permanentny",
        status=TemplateStatus.ACTIVE.value,
        created_at=NOW,
        updated_at=NOW,
    )
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[tenant, None, None, None])
    form_result = MagicMock()
    form_result.first.return_value = (form, 60)
    session.execute = AsyncMock(return_value=form_result)

    async def flush() -> None:
        added = session.add.call_args.args[0]
        if isinstance(added, (Client, Visit)):
            added.id = uuid4()

    session.flush = AsyncMock(side_effect=flush)
    app = _test_app(session, _access(tenant, MembershipRole.OWNER))

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/tenants/salon-a/visits",
            headers={"Origin": "http://localhost:3000"},
            json={
                "clientId": None,
                "newClient": {
                    "fullName": "Ewa Bez Konta",
                    "phone": "+48 600 123 456",
                    "email": None,
                },
                "formCode": form.code,
                "startsAt": "2030-09-03T09:00:00Z",
            },
        )

    assert response.status_code == 201
    assert response.json()["clientName"] == "Ewa Bez Konta"
    assert response.json()["clientPhone"] == "+48 600 123 456"
    added_client = next(
        call.args[0] for call in session.add.call_args_list if isinstance(call.args[0], Client)
    )
    assert added_client.first_name == "Ewa"
    assert added_client.last_name == "Bez Konta"
    assert added_client.phone_normalized == "+48600123456"


def test_staff_can_drag_a_planned_visit_to_a_new_time() -> None:
    tenant = _tenant()
    client_row = Client(
        id=uuid4(),
        tenant_id=tenant.id,
        first_name="Anna",
        last_name="Testowa",
        first_name_normalized="anna",
        last_name_normalized="testowa",
        phone=None,
        phone_normalized=None,
        archived_at=None,
        created_at=NOW,
        updated_at=NOW,
    )
    form = FormTemplate(
        id=uuid4(),
        code="makijaz-permanentny",
        name="Makijaż permanentny",
        status=TemplateStatus.ACTIVE.value,
        created_at=NOW,
        updated_at=NOW,
    )
    visit = Visit(
        id=uuid4(),
        tenant_id=tenant.id,
        client_id=client_row.id,
        form_template_id=form.id,
        treatment_name=form.name,
        starts_at=datetime(2030, 9, 2, 10, 0, tzinfo=UTC),
        ends_at=datetime(2030, 9, 2, 11, 0, tzinfo=UTC),
        status="PLANNED",
    )
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[tenant, visit, None, client_row, form])
    session.flush = AsyncMock()
    app = _test_app(session, _access(tenant, MembershipRole.STAFF))

    with TestClient(app) as client:
        response = client.patch(
            f"/api/v1/admin/tenants/salon-a/visits/{visit.id}",
            headers={"Origin": "http://localhost:3000"},
            json={"startsAt": "2030-09-03T12:00:00Z"},
        )

    assert response.status_code == 200
    assert response.json()["startsAt"] == "2030-09-03T12:00:00Z"
    assert response.json()["endsAt"] == "2030-09-03T13:00:00Z"
    assert visit.starts_at == datetime(2030, 9, 3, 12, 0, tzinfo=UTC)
    assert visit.ends_at == datetime(2030, 9, 3, 13, 0, tzinfo=UTC)
    session.flush.assert_awaited_once()


def test_salon_cannot_create_a_visit_in_the_past() -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    app = _test_app(session, _access(tenant, MembershipRole.OWNER))
    yesterday = datetime.now(UTC) - timedelta(days=1)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/tenants/salon-a/visits",
            headers={"Origin": "http://localhost:3000"},
            json={
                "clientId": str(uuid4()),
                "newClient": None,
                "formCode": "makijaz-permanentny",
                "startsAt": yesterday.isoformat(),
            },
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_visit_time"
    session.scalar.assert_not_awaited()
    session.add.assert_not_called()


def test_salon_cannot_create_a_visit_outside_configured_working_hours() -> None:
    tenant = _tenant()
    tenant.booking_schedule = {
        "slotIntervalMinutes": 30,
        "days": [
            {
                "weekday": weekday,
                "enabled": weekday == 0,
                "opensAt": "08:00",
                "closesAt": "12:00",
            }
            for weekday in range(7)
        ],
    }
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=tenant)
    form = FormTemplate(
        id=uuid4(),
        code="makijaz-permanentny",
        name="Makijaż permanentny",
        status=TemplateStatus.ACTIVE.value,
        created_at=NOW,
        updated_at=NOW,
    )
    form_result = MagicMock()
    form_result.first.return_value = (form, 90)
    session.execute = AsyncMock(return_value=form_result)
    app = _test_app(session, _access(tenant, MembershipRole.OWNER))

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/tenants/salon-a/visits",
            headers={"Origin": "http://localhost:3000"},
            json={
                "clientId": str(uuid4()),
                "newClient": None,
                "formCode": "makijaz-permanentny",
                "startsAt": "2030-09-02T05:00:00Z",
            },
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "visit_outside_booking_schedule"
    session.add.assert_not_called()


def test_read_only_member_cannot_create_a_manual_visit() -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    app = _test_app(session, _access(tenant, MembershipRole.READ_ONLY))

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/tenants/salon-a/visits",
            headers={"Origin": "http://localhost:3000"},
            json={
                "clientId": str(uuid4()),
                "formCode": "makijaz-permanentny",
                "startsAt": "2030-09-02T10:00:00Z",
            },
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "insufficient_role"
    session.add.assert_not_called()
