from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db_session, require_consumer
from app.core.auth_context import AuthenticatedConsumer
from app.core.config import Settings
from app.core.security import PasswordCheck
from app.main import create_app
from app.models.domain import (
    ConsumerAccount,
    ConsumerMfaChallenge,
    MfaChallengePurpose,
    MfaMethod,
    VerificationStatus,
)
from app.services.account_mfa import (
    decrypt_totp_secret,
    encrypt_totp_secret,
    totp_code,
)
from app.services.consumer_mfa import verify_consumer_mfa_challenge

ORIGIN = "http://localhost:3000"


def _mfa_account(method: MfaMethod = MfaMethod.SMS) -> ConsumerAccount:
    return ConsumerAccount(
        id=uuid4(),
        full_name="Klientka Testowa",
        email="klientka@example.test",
        email_normalized="klientka@example.test",
        password_hash="$argon2id$placeholder",
        email_verified_at=datetime.now(UTC),
        mfa_method=method.value,
        mfa_phone_normalized="+48500600700" if method == MfaMethod.SMS else None,
        mfa_totp_secret_encrypted=None,
        mfa_enabled_at=datetime.now(UTC),
    )


def _principal(account: ConsumerAccount) -> AuthenticatedConsumer:
    return AuthenticatedConsumer(
        consumer_account_id=account.id,
        phone_normalized=account.phone_normalized,
        full_name=account.full_name,
    )


def test_password_login_returns_an_mfa_challenge_without_opening_a_session() -> None:
    account = _mfa_account()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[account, None])
    session.execute = AsyncMock(return_value=MagicMock())
    session.flush = AsyncMock()

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    with (
        patch(
            "app.api.routes.consumer.verify_password",
            return_value=PasswordCheck(valid=True),
        ),
        TestClient(app) as client,
    ):
        response = client.post(
            "/api/v1/consumer/auth/password",
            headers={"Origin": ORIGIN},
            json={"email": account.email, "password": "secret"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["mfaRequired"] is True
    assert body["method"] == "SMS"
    assert body["destinationMasked"].endswith("700")
    assert len(body["devCode"]) == 6
    assert "beautydocs_consumer_session" not in response.cookies
    assert any(isinstance(item, ConsumerMfaChallenge) for item in _added_objects(session))


def test_client_can_enroll_an_authenticator_app_after_code_confirmation() -> None:
    settings = Settings(_env_file=None)
    account = _mfa_account()
    account.mfa_method = None
    account.mfa_phone_normalized = None
    account.mfa_enabled_at = None
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[account, None])
    session.execute = AsyncMock(return_value=MagicMock())
    session.flush = AsyncMock()

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(settings)
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_consumer] = lambda: _principal(account)
    with TestClient(app) as client:
        started = client.post(
            "/api/v1/consumer/mfa/enrollment",
            headers={"Origin": ORIGIN},
            json={"method": "TOTP"},
        )

    assert started.status_code == 200
    assert started.json()["method"] == "TOTP"
    assert started.json()["secret"]
    assert started.json()["qrCodeDataUrl"].startswith("data:image/png;base64,")
    challenge = next(
        item for item in _added_objects(session) if isinstance(item, ConsumerMfaChallenge)
    )
    assert challenge.totp_secret_encrypted is not None
    secret = decrypt_totp_secret(challenge.totp_secret_encrypted, settings)
    code = totp_code(secret)

    confirming_session = MagicMock(spec=AsyncSession)
    confirming_session.scalar = AsyncMock(side_effect=[account, challenge])
    confirming_session.flush = AsyncMock()

    async def override_confirming_session() -> AsyncIterator[AsyncSession]:
        yield confirming_session

    confirmation_app = create_app(settings)
    confirmation_app.dependency_overrides[get_db_session] = override_confirming_session
    confirmation_app.dependency_overrides[require_consumer] = lambda: _principal(account)
    with TestClient(confirmation_app) as client:
        confirmed = client.post(
            "/api/v1/consumer/mfa/enrollment/confirm",
            headers={"Origin": ORIGIN},
            json={"challengeId": str(challenge.id), "code": code},
        )

    assert confirmed.status_code == 200
    assert confirmed.json()["enabled"] is True
    assert confirmed.json()["method"] == "TOTP"
    assert account.mfa_totp_secret_encrypted == challenge.totp_secret_encrypted


def test_disabling_mfa_requires_a_confirmed_code_then_clears_it() -> None:
    settings = Settings(_env_file=None)
    account = _mfa_account()
    starting_session = MagicMock(spec=AsyncSession)
    starting_session.scalar = AsyncMock(side_effect=[account, None])
    starting_session.execute = AsyncMock(return_value=MagicMock())
    starting_session.flush = AsyncMock()

    async def override_starting_session() -> AsyncIterator[AsyncSession]:
        yield starting_session

    app = create_app(settings)
    app.dependency_overrides[get_db_session] = override_starting_session
    app.dependency_overrides[require_consumer] = lambda: _principal(account)
    with TestClient(app) as client:
        started = client.post(
            "/api/v1/consumer/mfa/disable-challenge",
            headers={"Origin": ORIGIN},
        )

    assert started.status_code == 200
    assert started.json()["purpose"] == "DISABLE"
    challenge = next(
        item for item in _added_objects(starting_session) if isinstance(item, ConsumerMfaChallenge)
    )

    confirming_session = MagicMock(spec=AsyncSession)
    confirming_session.scalar = AsyncMock(side_effect=[account, challenge])
    confirming_session.flush = AsyncMock()

    async def override_confirming_session() -> AsyncIterator[AsyncSession]:
        yield confirming_session

    confirm_app = create_app(settings)
    confirm_app.dependency_overrides[get_db_session] = override_confirming_session
    confirm_app.dependency_overrides[require_consumer] = lambda: _principal(account)
    with TestClient(confirm_app) as client:
        confirmed = client.post(
            "/api/v1/consumer/mfa/disable/confirm",
            headers={"Origin": ORIGIN},
            json={"challengeId": str(challenge.id), "code": started.json()["devCode"]},
        )

    assert confirmed.status_code == 204
    assert account.mfa_method is None
    assert account.mfa_phone_normalized is None
    assert account.mfa_enabled_at is None


@pytest.mark.asyncio
async def test_totp_challenge_is_one_time_and_rejects_replay() -> None:
    settings = Settings(_env_file=None)
    secret = "JBSWY3DPEHPK3PXP"
    account = _mfa_account(MfaMethod.TOTP)
    account.mfa_totp_secret_encrypted = encrypt_totp_secret(secret, settings)
    now = datetime.now(UTC)
    code = totp_code(secret, timestamp=int(now.timestamp()))
    challenge = _totp_login_challenge(account, now)

    assert await verify_consumer_mfa_challenge(
        challenge=challenge,
        account=account,
        code=code,
        settings=settings,
        now=now,
    )
    replay = _totp_login_challenge(account, now)
    assert not await verify_consumer_mfa_challenge(
        challenge=replay,
        account=account,
        code=code,
        settings=settings,
        now=now,
    )


def _totp_login_challenge(account: ConsumerAccount, now: datetime) -> ConsumerMfaChallenge:
    return ConsumerMfaChallenge(
        id=uuid4(),
        consumer_account_id=account.id,
        purpose=MfaChallengePurpose.LOGIN.value,
        method=MfaMethod.TOTP.value,
        status=VerificationStatus.PENDING.value,
        attempt_count=0,
        created_at=now,
        expires_at=now + timedelta(minutes=5),
    )


def _added_objects(session: MagicMock) -> list[object]:
    return [call.args[0] for call in session.add.call_args_list]
