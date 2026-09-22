from __future__ import annotations

import re
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db_session, require_tenant_membership
from app.core.auth_context import AuthenticatedUser, TenantAccess
from app.core.config import Settings
from app.core.security import PasswordCheck, generate_session_token
from app.main import create_app
from app.models.domain import AuthSession, MembershipRole, Tenant, TenantStatus, User

ORIGIN = "http://localhost:3000"


def _user(*, failed_attempts: int = 0) -> User:
    return User(
        id=uuid4(),
        email="owner@example.test",
        email_normalized="owner@example.test",
        password_hash="$argon2id$placeholder",
        display_name="Owner One",
        is_active=True,
        failed_login_attempts=failed_attempts,
        locked_until=None,
    )


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
    )


def test_login_sets_opaque_host_only_cookie_and_returns_no_token_or_ids() -> None:
    user = _user()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=user)
    membership_result = MagicMock()
    membership_result.all.return_value = [("salon-a", "Salon A", "OWNER")]
    session.execute = AsyncMock(side_effect=[MagicMock(), MagicMock(), membership_result])
    session.flush = AsyncMock()

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    with (
        patch(
            "app.api.routes.auth.verify_password",
            return_value=PasswordCheck(valid=True),
        ),
        TestClient(app) as client,
    ):
        response = client.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN, "Host": "app.beautydocs.pl"},
            json={"email": " OWNER@example.test ", "password": "secret"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "user": {"email": "owner@example.test", "displayName": "Owner One"},
        "memberships": [
            {
                "tenantSlug": "salon-a",
                "tenantDisplayName": "Salon A",
                "role": "OWNER",
            }
        ],
    }
    assert "token" not in response.text.lower()
    set_cookie = response.headers["set-cookie"]
    assert re_search_cookie(set_cookie)
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert "Path=/" in set_cookie
    assert "Domain=" not in set_cookie
    assert "Secure" not in set_cookie
    assert response.headers["Cache-Control"] == "no-store"

    persisted_session = session.add.call_args.args[0]
    assert isinstance(persisted_session, AuthSession)
    raw_cookie = response.cookies["beautydocs_session"]
    assert len(raw_cookie) == 43
    assert persisted_session.token_digest != raw_cookie
    assert len(persisted_session.token_digest) == 64


def re_search_cookie(header: str) -> bool:
    return re.search(r"(?:^|; )beautydocs_session=[A-Za-z0-9_-]{43}(?:;|$)", header) is not None


def test_unknown_and_wrong_password_share_generic_response_and_lockout_progresses() -> None:
    unknown_session = MagicMock(spec=AsyncSession)
    unknown_session.scalar = AsyncMock(return_value=None)
    unknown_session.execute = AsyncMock()

    existing_user = _user(failed_attempts=4)
    wrong_session = MagicMock(spec=AsyncSession)
    wrong_session.scalar = AsyncMock(return_value=existing_user)
    wrong_session.execute = AsyncMock()

    async def unknown_override() -> AsyncIterator[AsyncSession]:
        yield unknown_session

    async def wrong_override() -> AsyncIterator[AsyncSession]:
        yield wrong_session

    unknown_app = create_app(Settings(_env_file=None))
    unknown_app.dependency_overrides[get_db_session] = unknown_override
    with (
        patch("app.api.routes.auth.verify_dummy_password") as dummy_verify,
        TestClient(unknown_app) as client,
    ):
        unknown = client.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={"email": "missing@example.test", "password": "wrong"},
        )
    dummy_verify.assert_called_once_with("wrong")

    wrong_app = create_app(Settings(_env_file=None))
    wrong_app.dependency_overrides[get_db_session] = wrong_override
    with (
        patch(
            "app.api.routes.auth.verify_password",
            return_value=PasswordCheck(valid=False),
        ),
        TestClient(wrong_app) as client,
    ):
        wrong = client.post(
            "/api/v1/auth/login",
            headers={"Origin": ORIGIN},
            json={"email": "owner@example.test", "password": "wrong"},
        )

    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["error"]["code"] == "invalid_credentials"
    assert wrong.json()["error"]["code"] == "invalid_credentials"
    assert unknown.json()["error"]["message"] == wrong.json()["error"]["message"]
    assert existing_user.failed_login_attempts == 5
    assert existing_user.locked_until is not None
    assert existing_user.locked_until > datetime.now(UTC)


def test_login_rejects_missing_origin_before_issuing_cookie() -> None:
    session = MagicMock(spec=AsyncSession)

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "owner@example.test", "password": "secret"},
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "origin_not_allowed"
    assert "beautydocs_session" not in response.cookies


def test_auth_cookie_is_always_secure_outside_local_and_test() -> None:
    settings = Settings(
        _env_file=None,
        environment="staging",
        allow_localhost_tenants=False,
        auth_allowed_origins=["https://app.staging.beautydocs.pl"],
    )

    assert settings.auth_cookie_secure is True


def test_me_loads_db_backed_session_and_own_memberships() -> None:
    user_id = uuid4()
    token = generate_session_token()
    session = MagicMock(spec=AsyncSession)
    authenticated_row = MagicMock()
    authenticated_row.one_or_none.return_value = SimpleNamespace(
        id=user_id,
        email="owner@example.test",
        display_name="Owner One",
    )
    memberships = MagicMock()
    memberships.all.return_value = [("salon-a", "Salon A", "OWNER")]
    session.execute = AsyncMock(
        side_effect=[MagicMock(), authenticated_row, MagicMock(), memberships]
    )

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/auth/me",
            cookies={"beautydocs_session": token},
        )

    assert response.status_code == 200
    assert response.json()["memberships"][0]["tenantSlug"] == "salon-a"
    assert session.execute.await_count == 4
    assert "set_config" in str(session.execute.await_args_list[0].args[0])
    assert "auth_sessions" in str(session.execute.await_args_list[1].args[0])
    assert "set_config" in str(session.execute.await_args_list[2].args[0])
    assert "tenant_memberships" in str(session.execute.await_args_list[3].args[0])


def test_logout_revokes_session_and_clears_cookie_with_security_attributes() -> None:
    token = generate_session_token()
    auth_session = AuthSession(
        id=uuid4(),
        user_id=uuid4(),
        token_digest="a" * 64,
        expires_at=datetime.now(UTC),
        revoked_at=None,
    )
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=MagicMock())
    session.scalar = AsyncMock(return_value=auth_session)

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/logout",
            headers={"Origin": ORIGIN},
            cookies={"beautydocs_session": token},
        )

    assert response.status_code == 204
    assert response.content == b""
    assert auth_session.revoked_at is not None
    set_cookie = response.headers["set-cookie"]
    assert "beautydocs_session=" in set_cookie
    assert "Max-Age=0" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert "Path=/" in set_cookie


@pytest.mark.parametrize(
    ("role", "expected"),
    [
        ("OWNER", (True, True, True, True)),
        ("ADMIN", (True, True, True, True)),
        ("STAFF", (True, True, False, False)),
        ("READ_ONLY", (True, False, False, False)),
    ],
)
def test_overview_contract_and_capability_matrix(
    role: str, expected: tuple[bool, bool, bool, bool]
) -> None:
    tenant = _tenant()
    access = TenantAccess(
        principal=AuthenticatedUser(user_id=uuid4(), email="a@example.test", display_name="A"),
        tenant=tenant,
        role=MembershipRole(role),
    )
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[4, 3, 2, 2])

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    async def override_access() -> TenantAccess:
        return access

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_tenant_membership] = override_access
    with TestClient(app) as client:
        response = client.get("/api/v1/admin/tenants/salon-a/overview")

    assert response.status_code == 200
    payload = response.json()
    assert payload["tenant"] == {
        "slug": "salon-a",
        "displayName": "Salon A",
        "legalName": "Salon A sp. z o.o.",
    }
    assert payload["membership"] == {"role": role}
    assert payload["stats"] == {
        "clientsCount": 4,
        "activeFormsCount": 2,
        "formSubmissionsCount": 3,
        "signedFormSubmissionsCount": 2,
    }
    assert tuple(payload["capabilities"].values()) == expected
