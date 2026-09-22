from __future__ import annotations

import base64
import hashlib
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db_session, get_optional_consumer
from app.core.auth_context import AuthenticatedConsumer
from app.core.config import Settings
from app.core.security import (
    generate_session_token,
    hash_password,
    session_token_digest,
    verification_code_digest,
)
from app.main import create_app
from app.models.domain import (
    Client,
    ConsumerAccount,
    ConsumerAppointment,
    ConsumerChallengeStatus,
    ConsumerDocumentClaim,
    ConsumerGoogleIdentity,
    ConsumerLoginChallenge,
    ConsumerSession,
    ConsumerSubmissionLink,
    FormSubmission,
    Tenant,
    TenantStatus,
    Visit,
)
from app.services.google_identity import (
    GoogleIdentityVerificationError,
    VerifiedGoogleIdentity,
)

ORIGIN = "http://localhost:3000"
NOW = datetime.now(UTC)
SIGNATURE_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
SIGNATURE_DATA_URL = f"data:image/png;base64,{SIGNATURE_PNG_BASE64}"


def _session_with_ids() -> tuple[AsyncSession, list[object]]:
    session = MagicMock(spec=AsyncSession)
    added: list[object] = []
    session.add = MagicMock(side_effect=added.append)
    session.execute = AsyncMock(return_value=MagicMock())
    session.scalars = AsyncMock(return_value=MagicMock(all=MagicMock(return_value=[])))

    async def flush() -> None:
        for item in added:
            if getattr(item, "id", None) is None:
                item.id = uuid4()

    session.flush = AsyncMock(side_effect=flush)
    return session, added


def _client_app(
    session: AsyncSession,
    *,
    anonymous: bool = False,
    consumer: AuthenticatedConsumer | None = None,
    google_client_id: str | None = None,
) -> TestClient:
    async def override_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(
        Settings(
            _env_file=None,
            environment="test",
            auth_allowed_origins=[ORIGIN],
            google_client_id=google_client_id,
        )
    )
    app.dependency_overrides[get_db_session] = override_session
    if anonymous:
        app.dependency_overrides[get_optional_consumer] = lambda: None
    elif consumer is not None:
        app.dependency_overrides[get_optional_consumer] = lambda: consumer
    return TestClient(app)


def test_consumer_can_delete_login_profile_without_deleting_salon_records() -> None:
    session, _ = _session_with_ids()
    account = ConsumerAccount(
        id=uuid4(),
        phone="+48 600 700 800",
        phone_normalized="+48600700800",
        full_name="Ewa Testowa",
        email="ewa@example.test",
        email_normalized="ewa@example.test",
        password_hash="$argon2id$dummy",
        birth_date=datetime(1990, 1, 1, tzinfo=UTC).date(),
        medical_profile={"contraindications": {"alergie": {"answer": "no"}}},
    )
    session.scalar = AsyncMock(return_value=account)
    principal = AuthenticatedConsumer(
        consumer_account_id=account.id,
        phone_normalized=account.phone_normalized,
        full_name=account.full_name,
    )

    with _client_app(session, consumer=principal) as client:
        response = client.request(
            "DELETE",
            "/api/v1/consumer/account",
            headers={"Origin": ORIGIN},
            json={"confirmation": "USUŃ KONTO"},
        )

    assert response.status_code == 204
    assert account.deleted_at is not None
    assert account.email is None
    assert account.phone is None
    assert account.medical_profile == {}
    assert "beautydocs_consumer_session" in response.headers["set-cookie"]


def test_consumer_medical_catalog_uses_latest_templates_and_deduplicates_keys() -> None:
    session, _ = _session_with_ids()
    consumer_id = uuid4()
    template_id = uuid4()
    result = MagicMock()
    result.all.return_value = [
        (
            template_id,
            "Modelowanie ust",
            2,
            {
                "sections": [
                    {
                        "type": "contraindications",
                        "items": [
                            {
                                "key": "alergie",
                                "question": "Czy występują alergie?",
                                "hasFollowUp": True,
                                "followUpPlaceholder": "Podaj alergeny",
                            }
                        ],
                    }
                ]
            },
        ),
        (
            template_id,
            "Modelowanie ust",
            1,
            {
                "sections": [
                    {
                        "type": "contraindications",
                        "items": [{"key": "stare", "question": "Nieaktualne pytanie"}],
                    }
                ]
            },
        ),
    ]
    session.execute = AsyncMock(return_value=result)
    principal = AuthenticatedConsumer(
        consumer_account_id=consumer_id,
        phone_normalized=None,
        full_name="Ewa Testowa",
    )

    with _client_app(session, consumer=principal) as client:
        response = client.get("/api/v1/consumer/profile/medical")

    assert response.status_code == 200
    assert response.json() == {
        "questions": [
            {
                "key": "alergie",
                "question": "Czy występują alergie?",
                "hasFollowUp": True,
                "followUpPlaceholder": "Podaj alergeny",
                "category": None,
                "sourceForms": ["Modelowanie ust"],
            }
        ]
    }


def test_consumer_medical_catalog_requires_details_for_medication_questions() -> None:
    session, _ = _session_with_ids()
    result = MagicMock()
    result.all.return_value = [
        (
            uuid4(),
            "Usuwanie tatuażu",
            1,
            {
                "sections": [
                    {
                        "type": "contraindications",
                        "items": [
                            {
                                "key": "lekiRozrzedzajace",
                                "question": "Czy stosuje Pani/Pan leki rozrzedzające krew?",
                                "hasFollowUp": False,
                            },
                            {
                                "key": "lekiMiejscowe",
                                "question": "Czy stosuje Pani/Pan leki miejscowe?",
                                "hasFollowUp": False,
                            },
                        ],
                    }
                ]
            },
        )
    ]
    session.execute = AsyncMock(return_value=result)
    principal = AuthenticatedConsumer(
        consumer_account_id=uuid4(),
        phone_normalized=None,
        full_name="Ewa Testowa",
    )

    with _client_app(session, consumer=principal) as client:
        response = client.get("/api/v1/consumer/profile/medical")

    assert response.status_code == 200
    questions = response.json()["questions"]
    assert {item["key"] for item in questions} == {
        "lekiMiejscowe",
        "lekiRozrzedzajace",
    }
    assert all(item["hasFollowUp"] is True for item in questions)
    assert all(
        item["followUpPlaceholder"] == "Podaj nazwę leku, dawkę i częstotliwość stosowania"
        for item in questions
    )


def test_consumer_can_save_medical_profile_from_current_catalog() -> None:
    session, _ = _session_with_ids()
    account = ConsumerAccount(
        id=uuid4(),
        full_name="Ewa Testowa",
        email="ewa@example.test",
        medical_profile={},
        created_at=NOW,
        updated_at=NOW,
    )
    session.get = AsyncMock(return_value=account)
    catalog_result = MagicMock()
    catalog_result.all.return_value = [
        (
            uuid4(),
            "Modelowanie ust",
            1,
            {
                "sections": [
                    {
                        "type": "contraindications",
                        "items": [
                            {
                                "key": "alergie",
                                "question": "Czy występują alergie?",
                                "hasFollowUp": True,
                            }
                        ],
                    }
                ]
            },
        )
    ]
    session.execute = AsyncMock(return_value=catalog_result)
    session.scalar = AsyncMock(return_value=None)
    principal = AuthenticatedConsumer(
        consumer_account_id=account.id,
        phone_normalized=None,
        full_name=account.full_name,
    )

    with _client_app(session, consumer=principal) as client:
        response = client.put(
            "/api/v1/consumer/profile/medical",
            headers={"Origin": ORIGIN},
            json={"answers": {"alergie": {"answer": "yes", "followUp": "Lateks"}}},
        )

    assert response.status_code == 200
    assert response.json()["profile"]["medicalAnswers"] == {
        "alergie": {"answer": "yes", "followUp": "Lateks"}
    }
    assert account.medical_profile_updated_at is not None


def test_consumer_medical_profile_requires_details_for_configured_positive_answer() -> None:
    session, _ = _session_with_ids()
    account = ConsumerAccount(
        id=uuid4(),
        full_name="Ewa Testowa",
        medical_profile={},
        created_at=NOW,
        updated_at=NOW,
    )
    session.get = AsyncMock(return_value=account)
    catalog_result = MagicMock()
    catalog_result.all.return_value = [
        (
            uuid4(),
            "Modelowanie ust",
            1,
            {
                "sections": [
                    {
                        "type": "contraindications",
                        "items": [
                            {
                                "key": "alergie",
                                "question": "Czy występują alergie?",
                                "hasFollowUp": True,
                                "followUpPlaceholder": "Podaj alergeny",
                            }
                        ],
                    }
                ]
            },
        )
    ]
    session.execute = AsyncMock(return_value=catalog_result)
    principal = AuthenticatedConsumer(
        consumer_account_id=account.id,
        phone_normalized=None,
        full_name=account.full_name,
    )

    with _client_app(session, consumer=principal) as client:
        response = client.put(
            "/api/v1/consumer/profile/medical",
            headers={"Origin": ORIGIN},
            json={"answers": {"alergie": {"answer": "yes", "followUp": ""}}},
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "medical_follow_up_required"


def test_consumer_can_manage_reusable_signature() -> None:
    session, _ = _session_with_ids()
    account = ConsumerAccount(
        id=uuid4(),
        full_name="Ewa Testowa",
        medical_profile={},
        created_at=NOW,
        updated_at=NOW,
    )
    session.get = AsyncMock(return_value=account)
    principal = AuthenticatedConsumer(
        consumer_account_id=account.id,
        phone_normalized=None,
        full_name=account.full_name,
    )

    with _client_app(session, consumer=principal) as client:
        saved = client.put(
            "/api/v1/consumer/profile/signature",
            headers={"Origin": ORIGIN},
            json={"signature": SIGNATURE_DATA_URL},
        )
        preview = client.get("/api/v1/consumer/profile/signature")
        removed = client.delete(
            "/api/v1/consumer/profile/signature",
            headers={"Origin": ORIGIN},
        )

    assert saved.status_code == 204
    assert preview.status_code == 200
    assert preview.headers["content-type"] == "image/png"
    assert removed.status_code == 204
    assert account.signature_data_url is None


def test_phone_passwordless_login_is_not_exposed() -> None:
    session, _ = _session_with_ids()
    with _client_app(session) as client:
        request_response = client.post(
            "/api/v1/consumer/auth/code",
            headers={"Origin": ORIGIN},
            json={"phone": "+48 600 700 800"},
        )
        verify_response = client.post(
            "/api/v1/consumer/auth/verify",
            headers={"Origin": ORIGIN},
            json={
                "phone": "+48 600 700 800",
                "challengeId": str(uuid4()),
                "code": "123456",
            },
        )

    assert request_response.status_code == 404
    assert verify_response.status_code == 404


def test_consumer_can_register_with_email_and_password() -> None:
    session, added = _session_with_ids()
    session.scalar = AsyncMock(side_effect=[None, None])

    with _client_app(session) as client:
        response = client.post(
            "/api/v1/consumer/auth/register",
            headers={"Origin": ORIGIN},
            json={
                "fullName": "Ewa Testowa",
                "email": " EWA@example.test ",
                "password": "SilneHaslo!123",
            },
        )

    assert response.status_code == 201
    assert response.json()["email"] == "EWA@example.test"
    assert len(response.json()["devCode"]) == 6
    account = next(item for item in added if isinstance(item, ConsumerAccount))
    assert account.email_normalized == "ewa@example.test"
    assert account.password_hash is not None
    assert account.email_verified_at is None
    assert account.verification_code_hash is not None
    assert not any(isinstance(item, ConsumerSession) for item in added)


def test_consumer_can_verify_email_and_open_session() -> None:
    session, added = _session_with_ids()
    account = ConsumerAccount(
        id=uuid4(),
        phone=None,
        phone_normalized=None,
        full_name="Ewa Testowa",
        email="ewa@example.test",
        email_normalized="ewa@example.test",
        password_hash=hash_password("SilneHaslo!123"),
        email_verified_at=None,
        verification_code_hash=verification_code_digest("123456"),
        verification_code_expires_at=NOW + timedelta(minutes=10),
        verification_attempts=0,
        medical_profile={},
        created_at=NOW,
        updated_at=NOW,
    )
    session.scalar = AsyncMock(side_effect=[account, None])

    with _client_app(session) as client:
        response = client.post(
            "/api/v1/consumer/auth/register/verify",
            headers={"Origin": ORIGIN},
            json={"email": "EWA@example.test", "code": "123456"},
        )

    assert response.status_code == 200
    assert account.email_verified_at is not None
    assert account.verification_code_hash is None
    assert response.json()["signInMethods"] == ["password"]
    assert "beautydocs_consumer_session" in response.headers["set-cookie"]
    assert any(isinstance(item, ConsumerSession) for item in added)


def test_consumer_can_login_with_email_and_password() -> None:
    session, added = _session_with_ids()
    account = ConsumerAccount(
        id=uuid4(),
        phone=None,
        phone_normalized=None,
        full_name="Ewa Testowa",
        email="ewa@example.test",
        email_normalized="ewa@example.test",
        password_hash=hash_password("SilneHaslo!123"),
        email_verified_at=NOW,
        medical_profile={},
        created_at=NOW,
        updated_at=NOW,
    )
    session.scalar = AsyncMock(side_effect=[account, None])

    with _client_app(session) as client:
        response = client.post(
            "/api/v1/consumer/auth/password",
            headers={"Origin": ORIGIN},
            json={"email": "EWA@example.test", "password": "SilneHaslo!123"},
        )

    assert response.status_code == 200
    assert response.json()["profile"]["fullName"] == "Ewa Testowa"
    assert response.json()["signInMethods"] == ["password"]
    assert any(isinstance(item, ConsumerSession) for item in added)


def test_consumer_password_login_rejects_wrong_password() -> None:
    session, _ = _session_with_ids()
    account = ConsumerAccount(
        id=uuid4(),
        phone=None,
        phone_normalized=None,
        full_name="Ewa Testowa",
        email="ewa@example.test",
        email_normalized="ewa@example.test",
        password_hash=hash_password("SilneHaslo!123"),
        medical_profile={},
        created_at=NOW,
        updated_at=NOW,
    )
    session.scalar = AsyncMock(return_value=account)

    with _client_app(session) as client:
        response = client.post(
            "/api/v1/consumer/auth/password",
            headers={"Origin": ORIGIN},
            json={"email": "ewa@example.test", "password": "ZleHaslo"},
        )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


def test_signed_in_consumer_can_request_phone_verification_code() -> None:
    session, added = _session_with_ids()
    account = ConsumerAccount(
        id=uuid4(),
        full_name="Ewa Testowa",
        email="ewa@example.test",
        medical_profile={},
        created_at=NOW,
        updated_at=NOW,
    )
    session.get = AsyncMock(return_value=account)
    # conflict check -> no other account; pending challenge lookup -> none.
    session.scalar = AsyncMock(side_effect=[None, None])
    principal = AuthenticatedConsumer(
        consumer_account_id=account.id,
        phone_normalized=None,
        full_name=account.full_name,
    )

    with _client_app(session, consumer=principal) as client:
        response = client.post(
            "/api/v1/consumer/profile/phone/code",
            headers={"Origin": ORIGIN},
            json={"phone": "+48 600 700 800"},
        )

    assert response.status_code == 201
    assert len(response.json()["devCode"]) == 6
    challenge = next(item for item in added if isinstance(item, ConsumerLoginChallenge))
    assert challenge.phone_normalized == "+48600700800"
    assert challenge.status == ConsumerChallengeStatus.PENDING.value


def test_phone_verification_code_rejected_when_number_belongs_to_other_account() -> None:
    session, _ = _session_with_ids()
    account = ConsumerAccount(
        id=uuid4(),
        full_name="Ewa Testowa",
        medical_profile={},
        created_at=NOW,
        updated_at=NOW,
    )
    session.get = AsyncMock(return_value=account)
    session.scalar = AsyncMock(side_effect=[uuid4()])  # another account owns the phone
    principal = AuthenticatedConsumer(
        consumer_account_id=account.id,
        phone_normalized=None,
        full_name=account.full_name,
    )

    with _client_app(session, consumer=principal) as client:
        response = client.post(
            "/api/v1/consumer/profile/phone/code",
            headers={"Origin": ORIGIN},
            json={"phone": "+48 600 700 800"},
        )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "consumer_phone_taken"


def test_signed_in_consumer_can_verify_and_change_phone_without_new_session() -> None:
    session, _ = _session_with_ids()
    new_phone = "+48600700800"
    challenge = ConsumerLoginChallenge(
        id=uuid4(),
        phone_normalized=new_phone,
        destination_masked="+48•••••800",
        otp_digest=hash_password("123456"),
        status=ConsumerChallengeStatus.PENDING.value,
        attempt_count=0,
        created_at=NOW,
        expires_at=NOW + timedelta(minutes=5),
    )
    account = ConsumerAccount(
        id=uuid4(),
        phone="+48 500 000 000",
        phone_normalized="+48500000000",
        full_name="Ewa Testowa",
        medical_profile={},
        phone_verified_at=NOW,
        created_at=NOW,
        updated_at=NOW,
    )
    session.get = AsyncMock(return_value=account)
    # challenge lookup, conflict re-check (none), google identity for state (none).
    session.scalar = AsyncMock(side_effect=[challenge, None, None])
    principal = AuthenticatedConsumer(
        consumer_account_id=account.id,
        phone_normalized=account.phone_normalized,
        full_name=account.full_name,
    )

    with _client_app(session, consumer=principal) as client:
        response = client.post(
            "/api/v1/consumer/profile/phone/verify",
            headers={"Origin": ORIGIN},
            json={
                "phone": new_phone,
                "challengeId": str(challenge.id),
                "code": "123456",
            },
        )

    assert response.status_code == 200
    assert response.json()["profile"]["phone"] == new_phone
    assert account.phone_normalized == new_phone
    assert challenge.status == ConsumerChallengeStatus.VERIFIED.value
    assert "set-cookie" not in {key.lower() for key in response.headers}


def test_phone_verification_rejects_wrong_code() -> None:
    session, _ = _session_with_ids()
    phone = "+48600700800"
    challenge = ConsumerLoginChallenge(
        id=uuid4(),
        phone_normalized=phone,
        destination_masked="+48•••••800",
        otp_digest=hash_password("123456"),
        status=ConsumerChallengeStatus.PENDING.value,
        attempt_count=0,
        created_at=NOW,
        expires_at=NOW + timedelta(minutes=5),
    )
    account = ConsumerAccount(
        id=uuid4(),
        full_name="Ewa Testowa",
        medical_profile={},
        created_at=NOW,
        updated_at=NOW,
    )
    session.get = AsyncMock(return_value=account)
    session.scalar = AsyncMock(side_effect=[challenge])
    principal = AuthenticatedConsumer(
        consumer_account_id=account.id,
        phone_normalized=None,
        full_name=account.full_name,
    )

    with _client_app(session, consumer=principal) as client:
        response = client.post(
            "/api/v1/consumer/profile/phone/verify",
            headers={"Origin": ORIGIN},
            json={
                "phone": phone,
                "challengeId": str(challenge.id),
                "code": "000000",
            },
        )

    assert response.status_code == 400
    assert account.phone_normalized is None
    assert challenge.attempt_count == 1


def test_signed_form_claim_creates_account_profile_link_and_session() -> None:
    session, added = _session_with_ids()
    tenant_id = uuid4()
    client_id = uuid4()
    submission_id = uuid4()
    token = "A" * 43
    phone = "+48600700800"
    claim = ConsumerDocumentClaim(
        id=uuid4(),
        tenant_id=tenant_id,
        form_submission_id=submission_id,
        phone_normalized=phone,
        token_digest=hashlib.sha256(token.encode("ascii")).hexdigest(),
        created_at=NOW,
        expires_at=NOW + timedelta(minutes=30),
    )
    submission = FormSubmission(
        id=submission_id,
        tenant_id=tenant_id,
        client_id=client_id,
        form_template_version_id=uuid4(),
        status="SUBMITTED",
        answers={},
        document_snapshot={
            "formCode": "modelowanie-ust",
            "client": {
                "fullName": "Ewa Testowa",
                "phone": "+48 600 700 800",
                "email": "ewa@example.test",
                "birthDate": "1990-04-12",
                "street": "Kwiatowa 1",
                "postalCode": "00-001",
                "city": "Warszawa",
            },
            "answers": {
                "fields": {"contraindications": {"alergie": {"answer": "no", "followUp": ""}}}
            },
        },
    )
    salon_client = Client(
        id=client_id,
        tenant_id=tenant_id,
        first_name="Ewa",
        last_name="Testowa",
        first_name_normalized="ewa",
        last_name_normalized="testowa",
        phone=phone,
        phone_normalized=phone,
        created_at=NOW,
        updated_at=NOW,
    )
    session.scalar = AsyncMock(side_effect=[claim, submission, salon_client, None, None, None])
    with _client_app(session, anonymous=True) as client:
        response = client.post(
            "/api/v1/consumer/claim",
            headers={"Origin": ORIGIN},
            json={
                "submissionId": str(submission_id),
                "claimToken": token,
                "saveProfile": True,
            },
        )

    assert response.status_code == 200
    assert response.json()["profile"]["medicalAnswers"]["alergie"]["answer"] == "no"
    assert claim.consumed_at is not None
    assert any(isinstance(item, ConsumerAccount) for item in added)
    assert any(isinstance(item, ConsumerSubmissionLink) for item in added)
    assert any(isinstance(item, ConsumerSession) for item in added)
    assert "beautydocs_consumer_session" in response.headers["set-cookie"]


def test_consumer_sees_complete_document_before_practitioner_signature() -> None:
    session, _ = _session_with_ids()
    account_id = uuid4()
    tenant_id = uuid4()
    client_id = uuid4()
    submission_id = uuid4()
    submission = FormSubmission(
        id=submission_id,
        tenant_id=tenant_id,
        client_id=client_id,
        form_template_version_id=uuid4(),
        status="SUBMITTED",
        answers={
            "fields": {
                "produkt": "Produkt testowy",
                "contraindications": {"alergie": {"answer": "no", "followUp": ""}},
            },
            "treatmentArea": ["calf_left", "calf_right"],
            "consents": {"zgodaDane": True},
            "placeAndDate": "Warszawa, 19.07.2026",
        },
        document_snapshot={
            "formName": "Modelowanie ust",
            "client": {"fullName": "Ewa Testowa"},
            "answers": {
                "fields": {
                    "produkt": "Produkt testowy",
                    "contraindications": {"alergie": {"answer": "no", "followUp": ""}},
                },
                "treatmentArea": ["calf_left", "calf_right"],
                "consents": {"zgodaDane": True},
                "placeAndDate": "Warszawa, 19.07.2026",
            },
            "signatures": {"podpisDane": SIGNATURE_DATA_URL},
            "clientSignedAt": NOW.isoformat(),
            "clientSigning": {
                "method": "sms_otp",
                "status": "VERIFIED",
                "destinationMasked": "+48 *** *** 800",
            },
            "practitioner": {
                "displayName": "Anna Kosmetolog",
                "jobTitle": "Kosmetolog",
                "signedAt": None,
            },
        },
        submitted_at=NOW,
        signed_at=None,
        created_at=NOW,
        updated_at=NOW,
    )
    link = ConsumerSubmissionLink(
        id=uuid4(),
        consumer_account_id=account_id,
        tenant_id=tenant_id,
        client_id=client_id,
        form_submission_id=submission_id,
        shared_at=NOW,
    )
    schema = {
        "anatomy": {
            "model": "body",
            "faceZoneSet": None,
            "bodyZoneSet": "body",
        },
        "sections": [
            {
                "type": "fields",
                "key": "zabieg",
                "title": "Szczegóły zabiegu",
                "fields": [
                    {"key": "produkt", "label": "Nazwa produktu", "type": "text"},
                    {
                        "key": "podpisDane",
                        "label": "Podpis klientki",
                        "type": "signature",
                    },
                ],
            },
            {
                "type": "contraindications",
                "key": "wywiad",
                "title": "Wywiad medyczny",
                "items": [{"key": "alergie", "question": "Czy występują alergie?"}],
            },
        ],
    }
    legal_content = {
        "documentForm": "dokument elektroniczny",
        "consents": [
            {
                "key": "zgodaDane",
                "title": "Zgoda na przetwarzanie danych",
                "text": "Treść zgody dla {{salonName}}",
            }
        ],
        "documents": [
            {
                "key": "podpisDane",
                "title": "Oświadczenie klientki",
                "text": "Treść podpisanego dokumentu {{salonName}}",
            }
        ],
    }
    detail_result = MagicMock()
    detail_result.first.return_value = (
        submission,
        "Salon A",
        "salon-a",
        "modelowanie-ust",
        schema,
        legal_content,
    )
    session.scalar = AsyncMock(side_effect=[link, link, submission.document_snapshot])
    session.execute = AsyncMock(side_effect=[MagicMock(), detail_result, MagicMock()])
    principal = AuthenticatedConsumer(
        consumer_account_id=account_id,
        phone_normalized="+48600700800",
        full_name="Ewa Testowa",
    )

    with _client_app(session, consumer=principal) as client:
        response = client.get(f"/api/v1/consumer/documents/{submission_id}")
        signature_response = client.get(
            f"/api/v1/consumer/documents/{submission_id}/signatures/podpisDane"
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "SUBMITTED"
    assert payload["formCode"] == "modelowanie-ust"
    assert payload["practitionerSignedAt"] is None
    assert payload["practitioner"]["signedAt"] is None
    assert payload["anatomy"] == {
        "model": "body",
        "faceZoneSet": None,
        "bodyZoneSet": "body",
    }
    assert payload["treatmentAreaIds"] == ["calf_left", "calf_right"]
    sections = {section["key"]: section for section in payload["sections"]}
    assert sections["zabieg"]["items"][0]["value"] == "Produkt testowy"
    assert sections["wywiad"]["items"][0]["label"] == "Czy występują alergie?"
    assert sections["consents"]["items"][0]["detail"] == "Treść zgody dla Salon A"
    signature = next(
        item
        for item in sections["consents"]["items"]
        if item["key"] == "podpisDane"
    )
    assert signature["detail"] == "Treść podpisanego dokumentu Salon A"
    assert signature["kind"] == "signature"
    assert "client-signing-evidence" in sections
    assert signature_response.status_code == 200
    assert signature_response.headers["content-type"] == "image/png"
    assert signature_response.content == base64.b64decode(SIGNATURE_PNG_BASE64)


def test_claim_rejects_expired_token() -> None:
    session, _ = _session_with_ids()
    token = "B" * 43
    session.scalar = AsyncMock(
        return_value=ConsumerDocumentClaim(
            id=uuid4(),
            tenant_id=uuid4(),
            form_submission_id=uuid4(),
            phone_normalized="+48600700800",
            token_digest=hashlib.sha256(token.encode("ascii")).hexdigest(),
            created_at=NOW - timedelta(hours=1),
            expires_at=NOW - timedelta(minutes=1),
        )
    )
    with _client_app(session, anonymous=True) as client:
        response = client.post(
            "/api/v1/consumer/claim",
            headers={"Origin": ORIGIN},
            json={
                "submissionId": str(uuid4()),
                "claimToken": token,
                "saveProfile": True,
            },
        )

    assert response.status_code == 404


def test_google_login_creates_consumer_without_skipping_phone_verification() -> None:
    session, added = _session_with_ids()
    session.scalar = AsyncMock(side_effect=[None, None, uuid4()])
    google_client_id = "123456789-beautydocstest.apps.googleusercontent.com"
    verified = VerifiedGoogleIdentity(
        subject="google-subject-123",
        email="ewa@gmail.com",
        email_normalized="ewa@gmail.com",
        full_name="Ewa Google",
        hosted_domain=None,
        email_is_authoritative=True,
    )

    with (
        patch(
            "app.api.routes.consumer.verify_google_credential",
            return_value=verified,
        ),
        _client_app(
            session,
            anonymous=True,
            google_client_id=google_client_id,
        ) as client,
    ):
        response = client.post(
            "/api/v1/consumer/auth/google",
            headers={"Origin": ORIGIN},
            json={"credential": "x" * 100},
        )

    assert response.status_code == 200
    assert response.json()["profile"]["fullName"] == "Ewa Google"
    assert response.json()["profile"]["phone"] is None
    assert response.json()["signInMethods"] == ["google"]
    account = next(item for item in added if isinstance(item, ConsumerAccount))
    assert account.phone_verified_at is None
    assert any(isinstance(item, ConsumerGoogleIdentity) for item in added)
    assert any(isinstance(item, ConsumerSession) for item in added)


def test_google_login_rejects_unverified_credential() -> None:
    session, _ = _session_with_ids()
    google_client_id = "123456789-beautydocstest.apps.googleusercontent.com"
    with (
        patch(
            "app.api.routes.consumer.verify_google_credential",
            side_effect=GoogleIdentityVerificationError("invalid"),
        ),
        _client_app(
            session,
            anonymous=True,
            google_client_id=google_client_id,
        ) as client,
    ):
        response = client.post(
            "/api/v1/consumer/auth/google",
            headers={"Origin": ORIGIN},
            json={"credential": "x" * 100},
        )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_google_credential"


def test_consumer_can_search_discoverable_salons_by_active_form() -> None:
    tenant = Tenant(
        id=uuid4(),
        slug="powderbrows",
        display_name="PowderBrows Academy",
        legal_name="PowderBrows Academy sp. z o.o.",
        email="kontakt@example.test",
        privacy_contact_email="rodo@example.test",
        phone="+48600700800",
        website_url="https://powderbrows.example",
        address_line1="Kwiatowa 1",
        postal_code="00-001",
        city="Warszawa",
        country_code="PL",
        directory_visible=True,
        status=TenantStatus.ACTIVE.value,
    )
    session, _ = _session_with_ids()
    tenant_result = MagicMock()
    tenant_result.all.return_value = [tenant]
    session.scalars = AsyncMock(return_value=tenant_result)
    form_result = MagicMock()
    form_result.all.return_value = [
        ("permanent-makeup", "Makijaż permanentny"),
        ("brow-lamination", "Laminacja brwi"),
    ]
    session.execute = AsyncMock(side_effect=[MagicMock(), form_result])
    principal = AuthenticatedConsumer(
        consumer_account_id=uuid4(),
        phone_normalized="+48600100200",
        full_name="Ewa Testowa",
    )

    with _client_app(session, consumer=principal) as client:
        response = client.get("/api/v1/consumer/salons?query=makija%C5%BC")

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "slug": "powderbrows",
                "displayName": "PowderBrows Academy",
                "logoUrl": None,
                "coverUrl": None,
                "introduction": "",
                "startingPrice": None,
                "city": "Warszawa",
                "postalCode": "00-001",
                "addressLine1": "Kwiatowa 1",
                "addressLine2": None,
                "phone": "+48600700800",
                "websiteUrl": "https://powderbrows.example",
                "activeForms": [
                    {"code": "permanent-makeup", "displayName": "Makijaż permanentny"},
                    {"code": "brow-lamination", "displayName": "Laminacja brwi"},
                ],
            }
        ]
    }
    candidate_statement = session.scalars.await_args.args[0]
    assert "tenants.directory_visible IS true" in str(candidate_statement)
    assert TenantStatus.ACTIVE.value in candidate_statement.compile().params.values()
    rls_call = session.execute.await_args_list[0]
    assert "set_config" in str(rls_call.args[0])
    assert rls_call.args[1]["tenant_id"] == str(tenant.id)


def test_consumer_can_look_up_a_salon_directly_by_slug() -> None:
    tenant = Tenant(
        id=uuid4(),
        slug="powderbrows",
        display_name="PowderBrows Academy",
        legal_name="PowderBrows Academy sp. z o.o.",
        email="kontakt@example.test",
        privacy_contact_email="rodo@example.test",
        phone="+48600700800",
        website_url="https://powderbrows.example",
        address_line1="Kwiatowa 1",
        postal_code="00-001",
        city="Warszawa",
        country_code="PL",
        directory_visible=True,
        status=TenantStatus.ACTIVE.value,
    )
    session, _ = _session_with_ids()
    tenant_result = MagicMock()
    tenant_result.all.return_value = [tenant]
    session.scalars = AsyncMock(return_value=tenant_result)
    form_result = MagicMock()
    form_result.all.return_value = [
        ("permanent-makeup", "Makijaż permanentny"),
    ]
    session.execute = AsyncMock(side_effect=[MagicMock(), form_result])
    principal = AuthenticatedConsumer(
        consumer_account_id=uuid4(),
        phone_normalized="+48600100200",
        full_name="Ewa Testowa",
    )

    with _client_app(session, consumer=principal) as client:
        # "spa" never appears in this tenant's name, city, or forms — a direct
        # slug lookup (the public salon page's "Umów wizytę" deep link) must
        # still find it, unlike the ranked text search.
        response = client.get("/api/v1/consumer/salons?slug=powderbrows&query=spa")

    assert response.status_code == 200
    body = response.json()
    assert [item["slug"] for item in body["items"]] == ["powderbrows"]
    candidate_statement = session.scalars.await_args.args[0]
    assert "tenants.slug = " in str(candidate_statement)
    assert "powderbrows" in candidate_statement.compile().params.values()


def _next_booking_weekday() -> datetime:
    value = datetime.now(ZoneInfo("Europe/Warsaw")) + timedelta(days=1)
    while value.weekday() >= 5:
        value += timedelta(days=1)
    return value.replace(hour=10, minute=0, second=0, microsecond=0)


def test_consumer_can_read_available_appointment_slots() -> None:
    tenant = Tenant(
        id=uuid4(),
        slug="powderbrows",
        display_name="PowderBrows Academy",
        legal_name="PowderBrows Academy",
        email="kontakt@example.test",
        privacy_contact_email="kontakt@example.test",
        directory_visible=True,
        status=TenantStatus.ACTIVE.value,
    )
    form = SimpleNamespace(
        id=uuid4(),
        code="brows",
        name="Makijaż permanentny",
        duration_minutes=90,
    )
    session, _ = _session_with_ids()
    session.scalar = AsyncMock(return_value=tenant)
    form_result = MagicMock()
    form_result.first.return_value = form
    session.execute = AsyncMock(side_effect=[MagicMock(), form_result])
    session.scalars = AsyncMock(return_value=MagicMock(all=MagicMock(return_value=[])))
    principal = AuthenticatedConsumer(
        consumer_account_id=uuid4(),
        phone_normalized="+48600100200",
        full_name="Ewa Testowa",
    )
    booking_day = _next_booking_weekday().date().isoformat()
    booking_weekday = datetime.fromisoformat(booking_day).weekday()
    tenant.booking_schedule = {
        "slotIntervalMinutes": 30,
        "days": [
            {
                "weekday": weekday,
                "enabled": weekday == booking_weekday,
                "opensAt": "08:00",
                "closesAt": "12:00",
            }
            for weekday in range(7)
        ],
    }

    with _client_app(session, consumer=principal) as client:
        response = client.get(
            f"/api/v1/consumer/salons/powderbrows/availability?formCode=brows&date={booking_day}"
        )

    assert response.status_code == 200
    assert response.json()["timeZone"] == "Europe/Warsaw"
    assert response.json()["slotMinutes"] == 90
    assert response.json()["slotIntervalMinutes"] == 30
    assert len(response.json()["slots"]) == 6


def test_consumer_can_read_a_full_month_of_available_days() -> None:
    tenant = Tenant(
        id=uuid4(),
        slug="powderbrows",
        display_name="PowderBrows Academy",
        legal_name="PowderBrows Academy",
        email="kontakt@example.test",
        privacy_contact_email="kontakt@example.test",
        directory_visible=True,
        status=TenantStatus.ACTIVE.value,
    )
    form = SimpleNamespace(
        id=uuid4(),
        code="brows",
        name="Makijaż permanentny",
        duration_minutes=90,
    )
    booking_date = _next_booking_weekday().date()
    tenant.booking_schedule = {
        "slotIntervalMinutes": 30,
        "days": [
            {
                "weekday": weekday,
                "enabled": weekday == booking_date.weekday(),
                "opensAt": "08:00",
                "closesAt": "12:00",
            }
            for weekday in range(7)
        ],
    }
    session, _ = _session_with_ids()
    session.scalar = AsyncMock(return_value=tenant)
    form_result = MagicMock()
    form_result.first.return_value = form
    session.execute = AsyncMock(side_effect=[MagicMock(), form_result])
    session.scalars = AsyncMock(return_value=MagicMock(all=MagicMock(return_value=[])))
    principal = AuthenticatedConsumer(
        consumer_account_id=uuid4(),
        phone_normalized="+48600100200",
        full_name="Ewa Testowa",
    )

    with _client_app(session, consumer=principal) as client:
        response = client.get(
            "/api/v1/consumer/salons/powderbrows/availability/month"
            f"?formCode=brows&month={booking_date.strftime('%Y-%m')}"
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["month"] == booking_date.strftime("%Y-%m")
    assert payload["slotMinutes"] == 90
    selected_day = next(day for day in payload["days"] if day["date"] == booking_date.isoformat())
    assert selected_day["availableSlots"] == 6


def test_consumer_cannot_book_a_date_in_the_past() -> None:
    session = MagicMock(spec=AsyncSession)
    principal = AuthenticatedConsumer(
        consumer_account_id=uuid4(),
        phone_normalized="+48600100200",
        full_name="Ewa Testowa",
    )
    yesterday = (datetime.now(ZoneInfo("Europe/Warsaw")).date() - timedelta(days=1)).isoformat()

    with _client_app(session, consumer=principal) as client:
        response = client.get(
            f"/api/v1/consumer/salons/powderbrows/availability?formCode=brows&date={yesterday}"
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "booking_date_out_of_range"
    session.scalar.assert_not_called()


def test_consumer_cannot_book_outside_salon_working_hours() -> None:
    starts_at = _next_booking_weekday().replace(hour=7)
    tenant = Tenant(
        id=uuid4(),
        slug="powderbrows",
        display_name="PowderBrows Academy",
        legal_name="PowderBrows Academy",
        email="kontakt@example.test",
        privacy_contact_email="kontakt@example.test",
        directory_visible=True,
        status=TenantStatus.ACTIVE.value,
        booking_schedule={
            "slotIntervalMinutes": 30,
            "days": [
                {
                    "weekday": weekday,
                    "enabled": weekday == starts_at.weekday(),
                    "opensAt": "08:00",
                    "closesAt": "12:00",
                }
                for weekday in range(7)
            ],
        },
    )
    account = ConsumerAccount(
        id=uuid4(),
        full_name="Ewa Testowa",
        phone="+48 600 100 200",
        phone_normalized="+48600100200",
        phone_verified_at=NOW,
        medical_profile={},
    )
    form = SimpleNamespace(
        id=uuid4(),
        code="brows",
        name="Makijaż permanentny",
        duration_minutes=90,
    )
    session, added = _session_with_ids()
    session.get = AsyncMock(return_value=account)
    session.scalar = AsyncMock(return_value=tenant)
    form_result = MagicMock()
    form_result.first.return_value = form
    session.execute = AsyncMock(side_effect=[MagicMock(), form_result])
    principal = AuthenticatedConsumer(
        consumer_account_id=account.id,
        phone_normalized=account.phone_normalized,
        full_name=account.full_name,
    )

    with _client_app(session, consumer=principal) as client:
        response = client.post(
            "/api/v1/consumer/appointments",
            headers={"Origin": ORIGIN},
            json={
                "tenantSlug": tenant.slug,
                "formCode": form.code,
                "startsAt": starts_at.isoformat(),
            },
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_booking_slot"
    assert not any(isinstance(item, Visit) for item in added)


def test_consumer_can_book_a_visit_linked_to_a_form() -> None:
    tenant = Tenant(
        id=uuid4(),
        slug="powderbrows",
        display_name="PowderBrows Academy",
        legal_name="PowderBrows Academy",
        email="kontakt@example.test",
        privacy_contact_email="kontakt@example.test",
        directory_visible=True,
        status=TenantStatus.ACTIVE.value,
    )
    account = ConsumerAccount(
        id=uuid4(),
        full_name="Ewa Testowa",
        phone="+48 600 100 200",
        phone_normalized="+48600100200",
        phone_verified_at=NOW,
        email="ewa@example.test",
        email_normalized="ewa@example.test",
        medical_profile={},
    )
    existing_client = Client(
        id=uuid4(),
        tenant_id=tenant.id,
        first_name="Ewa",
        last_name="Testowa",
        first_name_normalized="ewa",
        last_name_normalized="testowa",
        phone=account.phone,
        phone_normalized=account.phone_normalized,
        email=account.email,
    )
    form = SimpleNamespace(
        id=uuid4(),
        code="brows",
        name="Makijaż permanentny",
        duration_minutes=90,
    )
    session, added = _session_with_ids()
    session.get = AsyncMock(return_value=account)
    session.scalar = AsyncMock(side_effect=[tenant, existing_client, None, None])
    form_result = MagicMock()
    form_result.first.return_value = form
    session.execute = AsyncMock(side_effect=[MagicMock(), form_result])
    session.scalars = AsyncMock(return_value=MagicMock(all=MagicMock(return_value=[])))
    principal = AuthenticatedConsumer(
        consumer_account_id=account.id,
        phone_normalized=account.phone_normalized,
        full_name=account.full_name,
    )
    starts_at = _next_booking_weekday()

    with _client_app(session, consumer=principal) as client:
        response = client.post(
            "/api/v1/consumer/appointments",
            headers={"Origin": ORIGIN},
            json={
                "tenantSlug": tenant.slug,
                "formCode": form.code,
                "startsAt": starts_at.isoformat(),
            },
        )

    assert response.status_code == 201
    assert response.json()["tenantSlug"] == tenant.slug
    assert response.json()["formCode"] == form.code
    assert len(response.json()["bookingToken"]) == 43
    visit = next(item for item in added if isinstance(item, Visit))
    link = next(item for item in added if isinstance(item, ConsumerAppointment))
    assert visit.client_id == existing_client.id
    assert visit.form_template_id == form.id
    assert visit.ends_at - visit.starts_at == timedelta(minutes=90)
    assert link.visit_id == visit.id
    assert link.consumer_account_id == account.id
