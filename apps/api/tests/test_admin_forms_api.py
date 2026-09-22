from __future__ import annotations

from collections.abc import AsyncIterator
from types import SimpleNamespace
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
    FormTemplate,
    MembershipRole,
    TemplateStatus,
    Tenant,
    TenantFormTemplate,
    TenantStatus,
)


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


def _test_app(session: MagicMock, tenant: Tenant) -> FastAPI:
    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    async def override_access() -> TenantAccess:
        return TenantAccess(
            principal=AuthenticatedUser(
                user_id=uuid4(),
                email="owner@example.test",
                display_name="Owner",
            ),
            tenant=tenant,
            role=MembershipRole.OWNER,
        )

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_tenant_membership] = override_access
    return app


def test_form_catalog_returns_treatment_duration() -> None:
    tenant = _tenant()
    form_id = uuid4()
    versions = MagicMock()
    versions.all.return_value = [(form_id, 2, {"sections": []})]
    forms = MagicMock()
    forms.all.return_value = [
        SimpleNamespace(
            id=form_id,
            code="brows",
            name="Brwi",
            description=None,
            enabled=True,
            display_order=0,
            duration_minutes=90,
        )
    ]
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(side_effect=[versions, forms])

    with TestClient(_test_app(session, tenant)) as client:
        response = client.get("/api/v1/admin/tenants/salon-a/forms")

    assert response.status_code == 200
    assert response.json()["forms"][0]["durationMinutes"] == 90


def test_owner_can_preview_a_form_regardless_of_enabled_state() -> None:
    tenant = _tenant()
    practitioner_id = uuid4()
    form_result = MagicMock()
    form_result.first.return_value = SimpleNamespace(
        code="brows",
        name="Brwi",
        description="Henna i regulacja",
        version_number=3,
        schema_definition={"sections": []},
        legal_content={"consents": []},
    )
    practitioners_result = MagicMock()
    practitioners_result.all.return_value = [
        SimpleNamespace(
            id=practitioner_id,
            display_name="Anna Kowalska",
            job_title="Kosmetolog",
            all_treatments=True,
            treatment_codes=[],
        ),
    ]
    set_context_result = MagicMock()
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(
        side_effect=[form_result, set_context_result, practitioners_result]
    )

    with TestClient(_test_app(session, tenant)) as client:
        response = client.get("/api/v1/admin/tenants/salon-a/forms/brows/preview")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Brwi"
    assert body["version"] == 3
    assert body["practitioners"][0]["displayName"] == "Anna Kowalska"


def test_preview_returns_not_found_when_form_has_no_published_version() -> None:
    tenant = _tenant()
    form_result = MagicMock()
    form_result.first.return_value = None
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=form_result)

    with TestClient(_test_app(session, tenant)) as client:
        response = client.get("/api/v1/admin/tenants/salon-a/forms/unknown/preview")

    assert response.status_code == 404


def test_owner_can_change_form_treatment_duration() -> None:
    tenant = _tenant()
    form = FormTemplate(
        id=uuid4(),
        code="brows",
        name="Brwi",
        status=TemplateStatus.ACTIVE.value,
    )
    link = TenantFormTemplate(
        tenant_id=tenant.id,
        form_template_id=form.id,
        enabled=True,
        display_order=0,
        duration_minutes=60,
    )
    versions = MagicMock()
    versions.all.return_value = []
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[form, link])
    session.execute = AsyncMock(return_value=versions)
    session.flush = AsyncMock()

    with TestClient(_test_app(session, tenant)) as client:
        response = client.put(
            "/api/v1/admin/tenants/salon-a/forms/brows",
            headers={"Origin": "http://localhost:3000"},
            json={"enabled": True, "durationMinutes": 90},
        )

    assert response.status_code == 200
    assert response.json()["durationMinutes"] == 90
    assert link.duration_minutes == 90
    session.flush.assert_awaited_once()
