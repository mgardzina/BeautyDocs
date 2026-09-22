from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AuthenticatedUser, get_current_user, get_db_session
from app.core.config import Settings
from app.core.security import PasswordCheck
from app.main import create_app
from app.models.domain import (
    MfaChallengePurpose,
    MfaMethod,
    User,
    UserMfaChallenge,
    VerificationStatus,
)
from app.services.account_mfa import (
    decrypt_totp_secret,
    encrypt_totp_secret,
    matching_totp_counter,
    qr_code_data_url,
    totp_code,
    totp_provisioning_uri,
    verify_mfa_challenge,
)

ORIGIN = "http://localhost:3000"


def _mfa_user(method: MfaMethod = MfaMethod.SMS) -> User:
    return User(
        id=uuid4(),
        email="owner@example.test",
        email_normalized="owner@example.test",
        password_hash="$argon2id$placeholder",
        display_name="Owner One",
        is_active=True,
        failed_login_attempts=0,
        mfa_method=method.value,
        mfa_phone_normalized="+48500600700" if method == MfaMethod.SMS else None,
        mfa_totp_secret_encrypted=None,
        mfa_enabled_at=datetime.now(UTC),
    )


def test_totp_matches_the_rfc_6238_sha1_vector_and_builds_a_local_qr() -> None:
    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"

    assert totp_code(secret, timestamp=59) == "287082"
    assert matching_totp_counter(secret, "287082", timestamp=59, window=0) == 1
    uri = totp_provisioning_uri(secret=secret, account_email="owner@example.test")
    assert uri.startswith("otpauth://totp/BeautyDocs%3Aowner%40example.test?")
    assert qr_code_data_url(uri).startswith("data:image/png;base64,")


def test_totp_secret_is_encrypted_at_rest() -> None:
    settings = Settings(_env_file=None)
    secret = "JBSWY3DPEHPK3PXP"

    encrypted = encrypt_totp_secret(secret, settings)

    assert secret not in encrypted
    assert decrypt_totp_secret(encrypted, settings) == secret


def test_password_login_returns_an_mfa_challenge_without_opening_a_session() -> None:
    user = _mfa_user()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[user, None])
    session.execute = AsyncMock(return_value=MagicMock())
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
            headers={"Origin": ORIGIN},
            json={"email": user.email, "password": "secret"},
        )

    assert response.status_code == 200
    assert response.json()["mfaRequired"] is True
    assert response.json()["method"] == "SMS"
    assert response.json()["destinationMasked"].endswith("700")
    assert len(response.json()["devCode"]) == 6
    assert "beautydocs_session" not in response.cookies
    assert any(isinstance(item, UserMfaChallenge) for item in _added_objects(session))


def test_authenticated_user_can_enroll_an_authenticator_app_after_code_confirmation() -> None:
    settings = Settings(_env_file=None)
    user = _mfa_user()
    user.mfa_method = None
    user.mfa_phone_normalized = None
    user.mfa_enabled_at = None
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[user, None])
    session.execute = AsyncMock(return_value=MagicMock())
    session.flush = AsyncMock()

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(settings)
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )
    with TestClient(app) as client:
        started = client.post(
            "/api/v1/auth/mfa/enrollment",
            headers={"Origin": ORIGIN},
            json={"method": "TOTP"},
        )

    assert started.status_code == 200
    assert started.json()["method"] == "TOTP"
    assert started.json()["secret"]
    assert started.json()["qrCodeDataUrl"].startswith("data:image/png;base64,")
    challenge = next(item for item in _added_objects(session) if isinstance(item, UserMfaChallenge))
    assert challenge.totp_secret_encrypted is not None
    secret = decrypt_totp_secret(challenge.totp_secret_encrypted, settings)
    code = totp_code(secret)

    confirming_session = MagicMock(spec=AsyncSession)
    confirming_session.scalar = AsyncMock(side_effect=[user, challenge])
    confirming_session.flush = AsyncMock()

    async def override_confirming_session() -> AsyncIterator[AsyncSession]:
        yield confirming_session

    confirmation_app = create_app(settings)
    confirmation_app.dependency_overrides[get_db_session] = override_confirming_session
    confirmation_app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )
    with TestClient(confirmation_app) as client:
        confirmed = client.post(
            "/api/v1/auth/mfa/enrollment/confirm",
            headers={"Origin": ORIGIN},
            json={"challengeId": str(challenge.id), "code": code},
        )

    assert confirmed.status_code == 200
    assert confirmed.json()["enabled"] is True
    assert confirmed.json()["method"] == "TOTP"
    assert user.mfa_totp_secret_encrypted == challenge.totp_secret_encrypted


def test_enabled_sms_factor_can_be_replaced_only_after_current_code_confirmation() -> None:
    settings = Settings(_env_file=None)
    user = _mfa_user()
    starting_session = MagicMock(spec=AsyncSession)
    starting_session.scalar = AsyncMock(side_effect=[user, None])
    starting_session.execute = AsyncMock(return_value=MagicMock())
    starting_session.flush = AsyncMock()

    async def override_starting_session() -> AsyncIterator[AsyncSession]:
        yield starting_session

    app = create_app(settings)
    app.dependency_overrides[get_db_session] = override_starting_session
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )
    with TestClient(app) as client:
        started = client.post(
            "/api/v1/auth/mfa/change-challenge",
            headers={"Origin": ORIGIN},
        )

    assert started.status_code == 200
    assert started.json()["purpose"] == "CHANGE"
    change_challenge = next(
        item for item in _added_objects(starting_session) if isinstance(item, UserMfaChallenge)
    )

    confirming_session = MagicMock(spec=AsyncSession)
    confirming_session.scalar = AsyncMock(side_effect=[user, change_challenge])
    confirming_session.flush = AsyncMock()

    async def override_confirming_session() -> AsyncIterator[AsyncSession]:
        yield confirming_session

    confirm_app = create_app(settings)
    confirm_app.dependency_overrides[get_db_session] = override_confirming_session
    confirm_app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )
    with TestClient(confirm_app) as client:
        confirmed = client.post(
            "/api/v1/auth/mfa/change/confirm",
            headers={"Origin": ORIGIN},
            json={
                "challengeId": str(change_challenge.id),
                "code": started.json()["devCode"],
            },
        )

    assert confirmed.status_code == 200
    assert confirmed.json()["changeChallengeId"] == str(change_challenge.id)
    assert change_challenge.status == VerificationStatus.VERIFIED.value

    replacement_session = MagicMock(spec=AsyncSession)
    replacement_session.scalar = AsyncMock(side_effect=[user, change_challenge, None])
    replacement_session.execute = AsyncMock(return_value=MagicMock())
    replacement_session.flush = AsyncMock()

    async def override_replacement_session() -> AsyncIterator[AsyncSession]:
        yield replacement_session

    replacement_app = create_app(settings)
    replacement_app.dependency_overrides[get_db_session] = override_replacement_session
    replacement_app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )
    with TestClient(replacement_app) as client:
        replacement = client.post(
            "/api/v1/auth/mfa/enrollment",
            headers={"Origin": ORIGIN},
            json={
                "method": "SMS",
                "phone": "+48 700 800 900",
                "changeChallengeId": str(change_challenge.id),
            },
        )

    assert replacement.status_code == 200
    assert user.mfa_phone_normalized == "+48500600700"
    assert change_challenge.status == VerificationStatus.EXPIRED.value
    replacement_challenge = next(
        item for item in _added_objects(replacement_session) if isinstance(item, UserMfaChallenge)
    )

    finishing_session = MagicMock(spec=AsyncSession)
    finishing_session.scalar = AsyncMock(side_effect=[user, replacement_challenge])
    finishing_session.flush = AsyncMock()

    async def override_finishing_session() -> AsyncIterator[AsyncSession]:
        yield finishing_session

    finishing_app = create_app(settings)
    finishing_app.dependency_overrides[get_db_session] = override_finishing_session
    finishing_app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )
    with TestClient(finishing_app) as client:
        finished = client.post(
            "/api/v1/auth/mfa/enrollment/confirm",
            headers={"Origin": ORIGIN},
            json={
                "challengeId": str(replacement_challenge.id),
                "code": replacement.json()["devCode"],
            },
        )

    assert finished.status_code == 200
    assert finished.json()["destinationMasked"].endswith("900")
    assert user.mfa_phone_normalized == "+48700800900"


@pytest.mark.asyncio
async def test_totp_challenge_is_one_time_and_rejects_replay() -> None:
    settings = Settings(_env_file=None)
    secret = "JBSWY3DPEHPK3PXP"
    user = _mfa_user(MfaMethod.TOTP)
    user.mfa_totp_secret_encrypted = encrypt_totp_secret(secret, settings)
    now = datetime.now(UTC)
    code = totp_code(secret, timestamp=int(now.timestamp()))
    challenge = _totp_login_challenge(user, now)

    assert await verify_mfa_challenge(
        challenge=challenge,
        user=user,
        code=code,
        settings=settings,
        now=now,
    )
    replay = _totp_login_challenge(user, now)
    assert not await verify_mfa_challenge(
        challenge=replay,
        user=user,
        code=code,
        settings=settings,
        now=now,
    )


def _totp_login_challenge(user: User, now: datetime) -> UserMfaChallenge:
    return UserMfaChallenge(
        id=uuid4(),
        user_id=user.id,
        purpose=MfaChallengePurpose.LOGIN.value,
        method=MfaMethod.TOTP.value,
        status=VerificationStatus.PENDING.value,
        attempt_count=0,
        created_at=now,
        expires_at=now + timedelta(minutes=5),
    )


def _added_objects(session: MagicMock) -> list[object]:
    return [call.args[0] for call in session.add.call_args_list]
