from __future__ import annotations

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db_session
from app.api.routes.public_tenant import TenantPublicConfigResponse
from app.core.config import Settings
from app.main import create_app
from app.models.domain import TemplateStatus, Tenant, TenantStatus


def _active_tenant() -> Tenant:
    return Tenant(
        id=uuid4(),
        slug="powderbrows",
        display_name="PowderBrows Academy",
        legal_name="PowderBrows Academy sp. z o.o.",
        nip="1234567890",
        email="kontakt@powderbrows.example",
        privacy_contact_email="privacy@powderbrows.example",
        phone="+48123456789",
        website_url="https://powderbrows.example",
        address_line1="ul. Piękna 1",
        address_line2="lok. 2",
        postal_code="00-001",
        city="Warszawa",
        country_code="PL",
        status=TenantStatus.ACTIVE.value,
    )


def test_public_tenant_returns_exact_camel_case_contract_and_sets_rls_first() -> None:
    tenant = _active_tenant()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=tenant)
    rls_result = MagicMock()
    forms_result = MagicMock()
    forms_result.all.return_value = [
        ("botox", "Toksyna botulinowa", 1),
        ("permanent-makeup", "Makijaż permanentny", 2),
    ]
    session.execute = AsyncMock(side_effect=[rls_result, forms_result])

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/public/tenant",
            headers={"Host": "powderbrows.beautydocs.pl"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "slug": "powderbrows",
        "displayName": "PowderBrows Academy",
        "legalName": "PowderBrows Academy sp. z o.o.",
        "legal": {
            "nip": "1234567890",
            "address": {
                "street": "ul. Piękna 1\nlok. 2",
                "postalCode": "00-001",
                "city": "Warszawa",
                "countryCode": "PL",
            },
            "privacyContactEmail": "privacy@powderbrows.example",
        },
        "contact": {
            "phone": "+48123456789",
            "email": "kontakt@powderbrows.example",
            "websiteUrl": "https://powderbrows.example",
        },
        "activeForms": [
            {
                "code": "botox",
                "displayName": "Toksyna botulinowa",
                "displayOrder": 1,
            },
            {
                "code": "permanent-makeup",
                "displayName": "Makijaż permanentny",
                "displayOrder": 2,
            },
        ],
    }
    assert session.execute.await_count == 2
    tenant_statement = session.scalar.await_args.args[0]
    assert TenantStatus.ACTIVE.value in tenant_statement.compile().params.values()
    rls_call, forms_call = session.execute.await_args_list
    assert "set_config" in str(rls_call.args[0])
    assert rls_call.args[1]["tenant_id"] == str(tenant.id)
    forms_statement = forms_call.args[0]
    assert TemplateStatus.ACTIVE.value in forms_statement.compile().params.values()
    assert "tenant_form_templates.enabled IS true" in str(forms_statement)
    assert "ORDER BY tenant_form_templates.display_order, form_templates.code" in str(
        forms_statement
    )


def test_public_tenant_path_contract_works_on_shared_forms_host() -> None:
    tenant = _active_tenant()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=tenant)
    rls_result = MagicMock()
    forms_result = MagicMock()
    forms_result.all.return_value = []
    session.execute = AsyncMock(side_effect=[rls_result, forms_result])

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/public/tenants/powderbrows",
            headers={"Host": "forms.beautydocs.pl"},
        )

    assert response.status_code == 200
    assert response.json()["slug"] == "powderbrows"
    tenant_statement = session.scalar.await_args.args[0]
    assert "powderbrows" in tenant_statement.compile().params.values()
    assert session.execute.await_count == 2


def test_public_tenant_path_rejects_reserved_platform_slug() -> None:
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock()
    session.execute = AsyncMock()

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/public/tenants/forms",
            headers={"Host": "forms.beautydocs.pl"},
        )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "tenant_not_found"
    session.scalar.assert_not_awaited()
    session.execute.assert_not_awaited()


def test_public_tenant_schema_caps_enabled_form_count() -> None:
    schema = TenantPublicConfigResponse.model_json_schema(by_alias=True)

    assert schema["properties"]["activeForms"]["maxItems"] == 100


def test_public_tenant_hides_inactive_or_unknown_tenant() -> None:
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=None)
    session.execute = AsyncMock()

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/public/tenant",
            headers={"Host": "suspended.beautydocs.pl"},
        )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "tenant_not_found"
    session.execute.assert_not_awaited()


def test_public_tenant_returns_controlled_error_when_database_is_missing() -> None:
    app = create_app(Settings(_env_file=None))
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/public/tenant",
            headers={"Host": "powderbrows.beautydocs.pl"},
        )

    assert response.status_code == 503
    assert response.json()["error"] == {
        "code": "database_unavailable",
        "message": "Service is temporarily unavailable",
        "request_id": response.headers["X-Request-ID"],
    }


def test_platform_stats_aggregates_counts_and_respects_tenant_isolation() -> None:
    tenant_a = uuid4()
    tenant_b = uuid4()

    session = MagicMock(spec=AsyncSession)
    # scalar order: salon count, available form count, then submissions per tenant.
    session.scalar = AsyncMock(side_effect=[2, 8, 5, 3])
    tenant_ids_result = MagicMock()
    tenant_ids_result.all.return_value = [tenant_a, tenant_b]
    session.scalars = AsyncMock(return_value=tenant_ids_result)
    session.execute = AsyncMock(return_value=MagicMock())

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    with TestClient(app) as client:
        response = client.get("/api/v1/public/platform-stats")

    assert response.status_code == 200
    assert response.json() == {
        "companyCount": 2,
        "signedFormCount": 8,
        "availableFormCount": 8,
    }
    # One set_tenant_context per active salon — isolation is set, never bypassed.
    assert session.execute.await_count == 2
    first_ctx, second_ctx = session.execute.await_args_list
    assert "set_config" in str(first_ctx.args[0])
    assert {first_ctx.args[1]["tenant_id"], second_ctx.args[1]["tenant_id"]} == {
        str(tenant_a),
        str(tenant_b),
    }


    # Exercise the emitted count queries against records: duplicate locations,
    # inactive businesses, unsigned submissions, and another tenant must not inflate totals.
    import re
    from sqlalchemy import create_engine, text

    engine = create_engine("sqlite://")
    with engine.connect() as connection:
        connection.connection.create_function(
            "regexp_replace", 4,
            lambda value, pattern, replacement, flags: re.sub(pattern, replacement, value) if value else None,
        )
        connection.execute(text("CREATE TABLE tenants (id TEXT, nip TEXT, status TEXT)"))
        connection.execute(text("INSERT INTO tenants VALUES ('a', '123-456-78-90', 'ACTIVE'), ('b', '1234567890', 'ACTIVE'), ('c', '9876543210', 'ACTIVE'), ('d', '1111111111', 'ARCHIVED'), ('e', NULL, 'ACTIVE')"))
        assert connection.scalar(session.scalar.await_args_list[0].args[0]) == 2
        connection.execute(text("CREATE TABLE form_submissions (tenant_id TEXT, status TEXT, signed_at TEXT)"))
        connection.execute(text("INSERT INTO form_submissions VALUES (:a, 'SIGNED', '2026-09-12'), (:a, 'SUBMITTED', NULL), (:a, 'DRAFT', NULL), (:a, 'SIGNED', NULL), (:a, 'VOID', '2026-09-12'), (:b, 'SIGNED', '2026-09-12')"), {"a": tenant_a.hex, "b": tenant_b.hex})
        assert connection.scalar(session.scalar.await_args_list[2].args[0]) == 1
        assert connection.scalar(session.scalar.await_args_list[3].args[0]) == 1
    engine.dispose()


def test_database_url_is_secret_and_requires_async_postgresql() -> None:
    settings = Settings(
        _env_file=None,
        database_url=SecretStr("postgresql+asyncpg://api:password@db/beautydocs"),
    )

    assert "password" not in repr(settings)
    assert settings.sqlalchemy_database_url == ("postgresql+asyncpg://api:password@db/beautydocs")

    with pytest.raises(ValidationError, match=r"postgresql\+asyncpg"):
        Settings(
            _env_file=None,
            database_url=SecretStr("postgresql://api:password@db/beautydocs"),
        )
