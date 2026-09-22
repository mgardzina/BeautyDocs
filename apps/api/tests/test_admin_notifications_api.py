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
from app.models.domain import (
    MembershipRole,
    SalonNotification,
    SalonNotificationKind,
    SalonNotificationSeverity,
    Tenant,
    TenantStatus,
)

NOW = datetime(2026, 8, 9, 12, 0, tzinfo=UTC)


def _tenant() -> Tenant:
    return Tenant(
        id=uuid4(),
        slug="salon-a",
        display_name="Salon A",
        legal_name="Salon A",
        email="salon@example.test",
        privacy_contact_email="privacy@example.test",
        status=TenantStatus.ACTIVE.value,
    )


def _notification(tenant: Tenant) -> SalonNotification:
    client_id = uuid4()
    submission_id = uuid4()
    return SalonNotification(
        id=uuid4(),
        tenant_id=tenant.id,
        kind=SalonNotificationKind.PRACTITIONER_SIGNATURE_REQUIRED.value,
        severity=SalonNotificationSeverity.ACTION_REQUIRED.value,
        resource_type="form_submission",
        resource_id=submission_id,
        title="Formularz wymaga podpisu",
        body="Anna Nowak zakończyła formularz.",
        action_label="Otwórz formularz",
        details={
            "clientId": str(client_id),
            "submissionId": str(submission_id),
            "clientName": "Anna Nowak",
            "formName": "Makijaż permanentny",
            "practitionerName": "Ewa Testowa",
        },
        read_at=None,
        resolved_at=None,
        archived_at=None,
        created_at=NOW,
        updated_at=NOW,
    )


def _app(session: MagicMock, tenant: Tenant) -> FastAPI:
    access = TenantAccess(
        principal=AuthenticatedUser(
            user_id=uuid4(),
            email="user@example.test",
            display_name="User",
        ),
        tenant=tenant,
        role=MembershipRole.STAFF,
    )

    async def override_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_session
    app.dependency_overrides[require_tenant_membership] = lambda: access
    app.dependency_overrides[require_trusted_origin] = lambda: None
    return app


def test_staff_can_read_the_shared_salon_inbox() -> None:
    tenant = _tenant()
    notification = _notification(tenant)
    result = MagicMock()
    result.all.return_value = [notification]
    session = MagicMock(spec=AsyncSession)
    session.scalars = AsyncMock(return_value=result)
    session.scalar = AsyncMock(return_value=1)

    with TestClient(_app(session, tenant)) as client:
        response = client.get("/api/v1/admin/tenants/salon-a/notifications")

    assert response.status_code == 200
    assert response.json()["unreadCount"] == 1
    item = response.json()["items"][0]
    assert item["title"] == "Formularz wymaga podpisu"
    assert item["clientName"] == "Anna Nowak"
    assert item["submissionId"] == str(notification.resource_id)


def test_staff_can_mark_a_notification_as_read_and_archive_it() -> None:
    tenant = _tenant()
    notification = _notification(tenant)
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=notification)
    session.flush = AsyncMock()

    with TestClient(_app(session, tenant)) as client:
        response = client.patch(
            f"/api/v1/admin/tenants/salon-a/notifications/{notification.id}",
            json={"read": True, "archived": True},
        )

    assert response.status_code == 200
    assert response.json()["readAt"] is not None
    assert response.json()["archivedAt"] is not None
    session.flush.assert_awaited_once()
