from __future__ import annotations

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db_session, require_trusted_origin
from app.core.config import Settings
from app.main import create_app
from app.services.google_identity import VerifiedGoogleIdentity

GOOGLE_CLIENT_ID = "123456789-beautydocstest.apps.googleusercontent.com"
CREDENTIAL = "x" * 120


def _verified() -> VerifiedGoogleIdentity:
    return VerifiedGoogleIdentity(
        subject="google-subject-123",
        email="ola@gmail.com",
        email_normalized="ola@gmail.com",
        full_name="Ola Google",
        hosted_domain=None,
        email_is_authoritative=True,
    )


def _client(session: AsyncSession, *, google: bool = True) -> TestClient:
    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(
        Settings(
            _env_file=None,
            google_client_id=GOOGLE_CLIENT_ID if google else None,
        )
    )
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    return TestClient(app)


def _resolve(scalar_results: list[object | None]) -> tuple[int, dict]:
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=scalar_results)
    with (
        patch(
            "app.api.routes.auth.resolve_google_identity",
            return_value=_verified(),
        ),
        _client(session) as client,
    ):
        response = client.post(
            "/api/v1/auth/google/resolve",
            json={"credential": CREDENTIAL},
        )
    return response.status_code, response.json()


def test_resolve_maps_existing_staff_identity_to_staff() -> None:
    status, body = _resolve([uuid4()])
    assert status == 200
    assert body["target"] == "staff"


def test_resolve_maps_existing_consumer_identity_to_consumer() -> None:
    status, body = _resolve([None, uuid4()])
    assert status == 200
    assert body["target"] == "consumer"


def test_resolve_prefers_consumer_account_by_email() -> None:
    # No linked identities; consumer account exists for the e-mail (client-first).
    status, body = _resolve([None, None, uuid4()])
    assert status == 200
    assert body["target"] == "consumer"


def test_resolve_falls_back_to_staff_user_by_email() -> None:
    status, body = _resolve([None, None, None, uuid4()])
    assert status == 200
    assert body["target"] == "staff"


def test_resolve_reports_none_for_brand_new_google_user() -> None:
    status, body = _resolve([None, None, None, None])
    assert status == 200
    assert body["target"] == "none"


def test_resolve_requires_google_configured() -> None:
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=None)
    with _client(session, google=False) as client:
        response = client.post(
            "/api/v1/auth/google/resolve",
            json={"credential": CREDENTIAL},
        )
    assert response.status_code == 503


def test_resolve_rejects_invalid_credential() -> None:
    from app.services.google_identity import GoogleIdentityVerificationError

    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=None)
    with (
        patch(
            "app.api.routes.auth.resolve_google_identity",
            side_effect=GoogleIdentityVerificationError("bad"),
        ),
        _client(session) as client,
    ):
        response = client.post(
            "/api/v1/auth/google/resolve",
            json={"credential": CREDENTIAL},
        )
    assert response.status_code == 401
