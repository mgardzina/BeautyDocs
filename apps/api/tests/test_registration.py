from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import (
    AuthenticatedUser,
    get_current_user,
    get_db_session,
    require_trusted_origin,
)
from app.core.config import Settings
from app.core.security import (
    generate_session_token,
    session_token_digest,
    verification_code_digest,
)
from app.main import create_app
from app.models.domain import (
    AuthSession,
    MembershipRole,
    OwnerRegistration,
    TeamMember,
    Tenant,
    TenantMembership,
    TenantStatus,
    User,
    UserGoogleIdentity,
)
from app.services.google_identity import VerifiedGoogleIdentity
from app.services.regon_registry import RegonCompany

SIGNATURE_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
SIGNATURE_DATA_URL = f"data:image/png;base64,{SIGNATURE_PNG_BASE64}"


def _app_with_session(session: AsyncSession) -> TestClient:
    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    return TestClient(app)


def _pk_assigning_session() -> tuple[AsyncSession, list[object]]:
    """A mocked session whose flush() assigns primary keys, like the DB would."""
    session = MagicMock(spec=AsyncSession)
    added: list[object] = []
    session.add = MagicMock(side_effect=lambda obj: added.append(obj))
    session.execute = AsyncMock(return_value=MagicMock())

    async def _flush() -> None:
        for obj in added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid4()

    session.flush = AsyncMock(side_effect=_flush)
    return session, added


def test_register_starts_pending_and_returns_dev_code_in_local() -> None:
    session, added = _pk_assigning_session()
    # 1) email-exists check -> None, 2) existing-pending lookup -> None
    session.scalar = AsyncMock(side_effect=[None, None])

    with _app_with_session(session) as client:
        response = client.post(
            "/api/v1/auth/register",
            json={"email": "anna@example.com"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "anna@example.com"
    assert body["expiresInSeconds"] == 15 * 60
    assert isinstance(body["devCode"], str) and len(body["devCode"]) == 6

    # Only a pending registration is created — no account, salon or membership yet.
    kinds = {type(obj).__name__ for obj in added}
    assert kinds == {"OwnerRegistration"}
    pending = next(o for o in added if isinstance(o, OwnerRegistration))
    assert pending.verification_code_hash is not None
    assert pending.email_verified_at is None
    assert not any(isinstance(o, (User, Tenant, TenantMembership)) for o in added)


def test_register_rejects_existing_email() -> None:
    session, _ = _pk_assigning_session()
    session.scalar = AsyncMock(return_value=uuid4())  # email already exists

    with _app_with_session(session) as client:
        response = client.post(
            "/api/v1/auth/register",
            json={"email": "anna@example.com"},
        )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"


def test_google_cannot_create_an_uninvited_staff_account() -> None:
    session, added = _pk_assigning_session()
    session.scalar = AsyncMock(side_effect=[None, None, None])
    verified = VerifiedGoogleIdentity(
        subject="google-staff-subject",
        email="ola@gmail.com",
        email_normalized="ola@gmail.com",
        full_name="Ola Google",
        hosted_domain=None,
        email_is_authoritative=True,
    )
    google_client_id = "123456789-beautydocstest.apps.googleusercontent.com"

    app = create_app(Settings(_env_file=None, google_client_id=google_client_id))

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    with (
        patch(
            "app.api.routes.registration.verify_google_credential",
            return_value=verified,
        ),
        TestClient(app) as client,
    ):
        response = client.post(
            "/api/v1/auth/google/staff",
            json={"credential": "x" * 100},
        )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "staff_invitation_required"
    assert not any(isinstance(obj, User) for obj in added)
    assert not any(isinstance(obj, UserGoogleIdentity) for obj in added)
    assert not any(isinstance(obj, AuthSession) for obj in added)


def _pending_registration() -> OwnerRegistration:
    return OwnerRegistration(
        id=uuid4(),
        email="anna@example.com",
        email_normalized="anna@example.com",
        email_verified_at=None,
        verification_code_hash=verification_code_digest("123456"),
        verification_code_expires_at=datetime.now(UTC) + timedelta(minutes=10),
        verification_attempts=0,
    )


def _verified_pending() -> tuple[OwnerRegistration, str]:
    """A pending registration whose e-mail is verified, plus its raw token."""
    token = generate_session_token()
    pending = OwnerRegistration(
        id=uuid4(),
        email="anna@example.com",
        email_normalized="anna@example.com",
        email_verified_at=datetime.now(UTC),
        verification_code_hash=None,
        registration_token_hash=session_token_digest(token),
        registration_token_expires_at=datetime.now(UTC) + timedelta(minutes=20),
    )
    return pending, token


_COMPLETE_PAYLOAD = {
    "fullName": "Anna Kowalska",
    "salonName": "Studio Lumière",
    "password": "haslo12345",
    "nip": "865-231-42-72",
    "regon": "383931003",
    "krs": "0000123456",
    "companyName": "Studio Lumière sp. z o.o.",
    "street": "ul. Kwiatowa 12/3",
    "postalCode": "00-001",
    "city": "Warszawa",
}


def test_verify_returns_completion_token_without_a_session() -> None:
    session, _ = _pk_assigning_session()
    pending = _pending_registration()
    session.scalar = AsyncMock(return_value=pending)

    with _app_with_session(session) as client:
        response = client.post(
            "/api/v1/auth/register/verify",
            json={"email": "anna@example.com", "code": "123456"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "anna@example.com"
    assert isinstance(body["registrationToken"], str)
    assert len(body["registrationToken"]) >= 16
    assert pending.email_verified_at is not None
    assert pending.verification_code_hash is None
    assert pending.registration_token_hash is not None
    # Verification alone must not log anyone in — the account does not exist yet.
    assert "beautydocs_session" not in response.headers.get("set-cookie", "")


def test_verify_rejects_wrong_code_and_counts_attempt() -> None:
    session, _ = _pk_assigning_session()
    pending = _pending_registration()
    session.scalar = AsyncMock(return_value=pending)

    with _app_with_session(session) as client:
        response = client.post(
            "/api/v1/auth/register/verify",
            json={"email": "anna@example.com", "code": "000000"},
        )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_code"
    assert pending.verification_attempts == 1
    assert pending.email_verified_at is None


def test_complete_creates_salon_and_logs_owner_in() -> None:
    session, added = _pk_assigning_session()
    pending, token = _verified_pending()
    # 1) token lookup, 2) email-exists guard, 3) slug uniqueness
    session.scalar = AsyncMock(side_effect=[pending, None, None])
    memberships = MagicMock()
    memberships.all.return_value = [("studio-lumiere", "Studio Lumière", "OWNER")]
    session.execute = AsyncMock(return_value=memberships)

    with (
        patch(
            "app.api.routes.registration.hash_password",
            return_value="$argon2id$hash",
        ),
        _app_with_session(session) as client,
    ):
        response = client.post(
            "/api/v1/auth/register/complete",
            json={"registrationToken": token, **_COMPLETE_PAYLOAD},
        )

    assert response.status_code == 200
    assert "beautydocs_session" in response.headers.get("set-cookie", "")

    kinds = {type(obj).__name__ for obj in added}
    assert {"User", "Tenant", "TenantMembership", "TeamMember"} <= kinds
    user = next(o for o in added if isinstance(o, User))
    assert user.is_active is True
    assert user.display_name == "Anna Kowalska"
    assert user.password_hash == "$argon2id$hash"
    tenant = next(o for o in added if isinstance(o, Tenant))
    assert tenant.slug == "studio-lumiere"
    assert tenant.directory_visible is True
    assert tenant.legal_name == "Studio Lumière sp. z o.o."
    assert tenant.nip == "8652314272"
    assert tenant.regon == "383931003"
    assert tenant.address_line1 == "ul. Kwiatowa 12/3"
    assert tenant.postal_code == "00-001"
    assert tenant.city == "Warszawa"
    membership = next(o for o in added if isinstance(o, TenantMembership))
    assert membership.role == MembershipRole.OWNER.value
    # A set_tenant_context call must precede the RLS-protected membership insert.
    assert any(
        "set_config" in str(call.args[0]) for call in session.execute.await_args_list
    )


def test_complete_rejects_expired_registration_token() -> None:
    session, added = _pk_assigning_session()
    pending, token = _verified_pending()
    pending.registration_token_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    session.scalar = AsyncMock(return_value=pending)

    with _app_with_session(session) as client:
        response = client.post(
            "/api/v1/auth/register/complete",
            json={"registrationToken": token, **_COMPLETE_PAYLOAD},
        )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_registration"
    assert not any(isinstance(o, User) for o in added)
    assert not any(isinstance(o, Tenant) for o in added)


def test_complete_rejects_nip_with_invalid_checksum() -> None:
    session, added = _pk_assigning_session()
    _, token = _verified_pending()

    with _app_with_session(session) as client:
        response = client.post(
            "/api/v1/auth/register/complete",
            json={**_COMPLETE_PAYLOAD, "registrationToken": token, "nip": "8652314271"},
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert not any(isinstance(o, User) for o in added)


def test_configure_updates_owner_tenant() -> None:
    """The Google sign-up path fills company data on an existing salon."""
    session, _ = _pk_assigning_session()
    tenant_id = uuid4()
    membership = TenantMembership(
        id=uuid4(),
        tenant_id=tenant_id,
        user_id=uuid4(),
        role=MembershipRole.OWNER.value,
        is_active=True,
    )
    tenant = Tenant(
        id=tenant_id,
        slug="studio-lumiere",
        display_name="Studio Lumière",
        legal_name="Studio Lumière",
        email="anna@example.com",
        privacy_contact_email="anna@example.com",
    )
    session.scalar = AsyncMock(return_value=membership)
    session.get = AsyncMock(return_value=tenant)

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=membership.user_id,
        email="anna@example.com",
        display_name="Anna Kowalska",
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/configure",
            json={
                "nip": "865-231-42-72",
                "regon": "383931003",
                "krs": "0000123456",
                "companyName": "Studio Lumière sp. z o.o.",
                "street": "ul. Kwiatowa 12/3",
                "postalCode": "00-001",
                "city": "Warszawa",
            },
        )

    assert response.status_code == 204
    assert tenant.legal_name == "Studio Lumière sp. z o.o."
    assert tenant.nip == "8652314272"
    assert tenant.regon == "383931003"
    assert tenant.krs == "0000123456"
    assert tenant.address_line1 == "ul. Kwiatowa 12/3"
    assert tenant.postal_code == "00-001"
    assert tenant.city == "Warszawa"


def test_configure_rejects_nip_with_invalid_checksum() -> None:
    session, _ = _pk_assigning_session()
    app = create_app(Settings(_env_file=None))

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=uuid4(),
        email="anna@example.com",
        display_name="Anna Kowalska",
    )
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/configure",
            json={
                "nip": "8652314271",
                "companyName": "Studio Lumière",
                "street": "ul. Kwiatowa 1",
                "postalCode": "00-001",
                "city": "Warszawa",
            },
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


_CREATE_SALON_PAYLOAD = {
    "salonName": "Studio Aurora",
    "nip": "865-231-42-72",
    "regon": "383931003",
    "krs": "0000123456",
    "companyName": "Studio Aurora sp. z o.o.",
    "street": "ul. Słoneczna 5",
    "postalCode": "00-002",
    "city": "Kraków",
}


def test_create_salon_adds_tenant_and_owner_membership_without_a_new_user() -> None:
    """An already-authenticated owner can add a second salon."""
    session, added = _pk_assigning_session()
    user_id = uuid4()
    user = User(
        id=user_id,
        email="anna@example.com",
        email_normalized="anna@example.com",
        password_hash="hashed",
        display_name="Anna Kowalska",
        is_active=True,
    )
    # 1) _current_user_for_update -> the owner, 2) _unique_slug check -> free
    session.scalar = AsyncMock(side_effect=[user, None])

    app = create_app(Settings(_env_file=None))

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user_id,
        email="anna@example.com",
        display_name="Anna Kowalska",
    )

    with TestClient(app) as client:
        response = client.post("/api/v1/auth/salons", json=_CREATE_SALON_PAYLOAD)

    assert response.status_code == 201
    body = response.json()
    assert body["tenantSlug"] == "studio-aurora"
    assert body["tenantDisplayName"] == "Studio Aurora"

    # No new User is created — only a Tenant, an OWNER membership and a team member.
    assert not any(isinstance(o, User) for o in added)
    tenant = next(o for o in added if isinstance(o, Tenant))
    assert tenant.slug == "studio-aurora"
    assert tenant.legal_name == "Studio Aurora sp. z o.o."
    assert tenant.nip == "8652314272"
    assert tenant.status == TenantStatus.ACTIVE.value
    membership = next(o for o in added if isinstance(o, TenantMembership))
    assert membership.role == MembershipRole.OWNER.value
    assert membership.user_id == user_id
    assert membership.tenant_id == tenant.id
    team_member = next(o for o in added if isinstance(o, TeamMember))
    assert team_member.is_owner is True
    assert team_member.tenant_id == tenant.id


def test_create_salon_rejects_nip_with_invalid_checksum() -> None:
    session, added = _pk_assigning_session()
    app = create_app(Settings(_env_file=None))

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=uuid4(),
        email="anna@example.com",
        display_name="Anna Kowalska",
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/salons",
            json={**_CREATE_SALON_PAYLOAD, "nip": "8652314271"},
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert not any(isinstance(o, Tenant) for o in added)


def test_company_lookup_returns_gus_fields_for_valid_nip() -> None:
    session, _ = _pk_assigning_session()
    app = create_app(Settings(_env_file=None, regon_api_key="test-key"))

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=uuid4(),
        email="anna@example.com",
        display_name="Anna Kowalska",
    )
    company = RegonCompany(
        nip="8652314272",
        regon="383931003",
        krs=None,
        name="PowderBrows Academy Malwina Zięba",
        status_nip="Aktywny",
        street="Siedlanowskiego 3/12",
        postal_code="37-450",
        city="Stalowa Wola",
        activity_ended_at=None,
    )

    with (
        patch("app.api.routes.registration.lookup_company_by_nip", return_value=company),
        TestClient(app) as client,
    ):
        response = client.post(
            "/api/v1/auth/company-lookup",
            json={"nip": "865-231-42-72"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "nip": "8652314272",
        "regon": "383931003",
        "krs": None,
        "companyName": "PowderBrows Academy Malwina Zięba",
        "street": "Siedlanowskiego 3/12",
        "postalCode": "37-450",
        "city": "Stalowa Wola",
        "statusNip": "Aktywny",
        "activityEndedAt": None,
    }


def test_authenticated_user_can_save_their_own_signature() -> None:
    session, _ = _pk_assigning_session()
    user = User(
        id=uuid4(),
        email="ola@example.com",
        email_normalized="ola@example.com",
        password_hash="$argon2id$dummy",
        display_name="Ola Nowak",
        is_active=True,
        email_verified_at=datetime.now(UTC),
    )
    session.scalar = AsyncMock(return_value=user)

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )

    with TestClient(app) as client:
        response = client.put(
            "/api/v1/auth/profile/signature",
            json={"signature": SIGNATURE_DATA_URL},
        )

    assert response.status_code == 204
    assert response.headers["Cache-Control"] == "private, no-store"
    assert user.signature_data_url == SIGNATURE_DATA_URL
    assert user.signature_updated_at is not None
    session.flush.assert_awaited_once()


def test_user_signature_is_synchronized_to_linked_salon_profile() -> None:
    session, _ = _pk_assigning_session()
    user_id = uuid4()
    tenant_id = uuid4()
    membership_id = uuid4()
    user = User(
        id=user_id,
        email="ola@example.com",
        email_normalized="ola@example.com",
        password_hash="$argon2id$dummy",
        display_name="Ola Nowak",
        is_active=True,
        email_verified_at=datetime.now(UTC),
    )
    session.scalar = AsyncMock(return_value=user)
    membership_rows = MagicMock()
    membership_rows.all.return_value = [(tenant_id, membership_id)]
    session.execute = AsyncMock(side_effect=[membership_rows, MagicMock(), MagicMock()])

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )

    with TestClient(app) as client:
        response = client.put(
            "/api/v1/auth/profile/signature",
            json={"signature": SIGNATURE_DATA_URL},
        )

    assert response.status_code == 204
    update_statement = session.execute.await_args_list[-1].args[0]
    assert "UPDATE team_members" in str(update_statement)
    assert "team_members.membership_id" in str(update_statement)


def test_owner_can_update_and_read_complete_personal_profile() -> None:
    session, _ = _pk_assigning_session()
    now = datetime.now(UTC)
    tenant_id = uuid4()
    membership_id = uuid4()
    user = User(
        id=uuid4(),
        email="ola@example.com",
        email_normalized="ola@example.com",
        password_hash="$argon2id$dummy",
        display_name="Ola Nowak",
        is_active=True,
        email_verified_at=now,
        created_at=now - timedelta(days=3),
        last_login_at=now,
    )
    session.scalar = AsyncMock(return_value=user)
    membership_rows = MagicMock()
    membership_rows.all.return_value = [(tenant_id, membership_id)]
    session.execute = AsyncMock(side_effect=[membership_rows, MagicMock(), MagicMock()])

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )

    with TestClient(app) as client:
        response = client.put(
            "/api/v1/auth/profile",
            json={"displayName": "  Ola   Kowalska  ", "phone": "+48 500 600 700"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "displayName": "Ola Kowalska",
        "email": "ola@example.com",
        "phone": "+48500600700",
        "emailVerifiedAt": now.isoformat().replace("+00:00", "Z"),
        "createdAt": (now - timedelta(days=3)).isoformat().replace("+00:00", "Z"),
        "lastLoginAt": now.isoformat().replace("+00:00", "Z"),
        "signatureConfigured": False,
        "signatureUpdatedAt": None,
    }
    assert user.phone_normalized == "+48500600700"
    team_update = session.execute.await_args_list[2].args[0]
    update_params = team_update.compile().params
    assert update_params["phone"] == "+48500600700"
    assert update_params["phone_normalized"] == "+48500600700"


def test_user_can_remove_phone_from_every_linked_team_profile() -> None:
    session, _ = _pk_assigning_session()
    tenant_id = uuid4()
    membership_id = uuid4()
    now = datetime.now(UTC)
    user = User(
        id=uuid4(),
        email="ola@example.com",
        email_normalized="ola@example.com",
        password_hash="$argon2id$dummy",
        display_name="Ola Nowak",
        phone_normalized="+48500600700",
        is_active=True,
        email_verified_at=now,
        created_at=now,
    )
    session.scalar = AsyncMock(return_value=user)
    membership_rows = MagicMock()
    membership_rows.all.return_value = [(tenant_id, membership_id)]
    session.execute = AsyncMock(side_effect=[membership_rows, MagicMock(), MagicMock()])

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )

    with TestClient(app) as client:
        response = client.put(
            "/api/v1/auth/profile",
            json={"displayName": "Ola Nowak", "phone": None},
        )

    assert response.status_code == 200
    assert response.json()["phone"] is None
    assert user.phone_normalized is None
    team_update = session.execute.await_args_list[2].args[0]
    update_params = team_update.compile().params
    assert update_params["phone"] is None
    assert update_params["phone_normalized"] is None


def test_authenticated_user_can_change_password_and_revoke_other_sessions() -> None:
    session, _ = _pk_assigning_session()
    user = User(
        id=uuid4(),
        email="ola@example.com",
        email_normalized="ola@example.com",
        password_hash="old-hash",
        display_name="Ola Nowak",
        is_active=True,
        email_verified_at=datetime.now(UTC),
        failed_login_attempts=2,
        locked_until=datetime.now(UTC) + timedelta(minutes=5),
    )
    session.scalar = AsyncMock(return_value=user)
    token = generate_session_token()

    app = create_app(Settings(_env_file=None))

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )

    with (
        patch("app.api.routes.registration.hash_password", return_value="new-hash"),
        TestClient(app) as client,
    ):
        client.cookies.set("beautydocs_session", token)
        response = client.put(
            "/api/v1/auth/profile/password",
            json={"newPassword": "nowe-haslo-123"},
        )

    assert response.status_code == 204
    assert response.headers["Cache-Control"] == "private, no-store"
    assert user.password_hash == "new-hash"
    assert user.failed_login_attempts == 0
    assert user.locked_until is None
    revoke_statement = session.execute.await_args.args[0]
    assert "UPDATE auth_sessions" in str(revoke_statement)
    assert "auth_sessions.token_digest !=" in str(revoke_statement)
    session.flush.assert_awaited_once()


def test_password_change_rejects_too_short_new_password_before_database_access() -> None:
    session, _ = _pk_assigning_session()

    app = create_app(Settings(_env_file=None))

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=uuid4(),
        email="ola@example.com",
        display_name="Ola Nowak",
    )

    with TestClient(app) as client:
        response = client.put(
            "/api/v1/auth/profile/password",
            json={"newPassword": "krotkie"},
        )

    assert response.status_code == 422
    session.scalar.assert_not_awaited()


def test_staff_can_delete_account_and_linked_team_profile_is_deactivated() -> None:
    session, _ = _pk_assigning_session()
    user_id = uuid4()
    tenant_id = uuid4()
    membership_id = uuid4()
    user = User(
        id=user_id,
        email="ola@example.com",
        email_normalized="ola@example.com",
        password_hash="$argon2id$dummy",
        display_name="Ola Nowak",
        is_active=True,
        email_verified_at=datetime.now(UTC),
        signature_data_url=SIGNATURE_DATA_URL,
    )
    session.scalar = AsyncMock(side_effect=[user, None])
    membership_rows = MagicMock()
    membership_rows.all.return_value = [(tenant_id, membership_id)]
    session.execute = AsyncMock(
        side_effect=[membership_rows, MagicMock(), MagicMock(), MagicMock(), MagicMock()]
    )

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )

    with (
        patch("app.api.routes.registration.hash_password", return_value="deleted-hash"),
        TestClient(app) as client,
    ):
        response = client.request(
            "DELETE",
            "/api/v1/auth/profile",
            json={"confirmation": "USUŃ KONTO"},
        )

    assert response.status_code == 204
    assert user.is_active is False
    assert user.deleted_at is not None
    assert user.signature_data_url is None
    assert user.email.endswith("@deleted.invalid")
    team_update = session.execute.await_args_list[2].args[0]
    assert "UPDATE team_members" in str(team_update)
    update_params = team_update.compile().params
    assert update_params["phone"] is None
    assert update_params["phone_normalized"] is None
    assert "beautydocs_session" in response.headers["set-cookie"]


def test_invalid_user_signature_is_rejected_before_database_access() -> None:
    session, _ = _pk_assigning_session()

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    user_id = uuid4()
    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_trusted_origin] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        user_id=user_id,
        email="ola@example.com",
        display_name="Ola Nowak",
    )

    with TestClient(app) as client:
        response = client.put(
            "/api/v1/auth/profile/signature",
            json={"signature": "data:image/png;base64,bm90LWEtcG5n"},
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_user_signature"
    assert response.headers["Cache-Control"] == "private, no-store"
    session.scalar.assert_not_awaited()
