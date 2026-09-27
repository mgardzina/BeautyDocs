from __future__ import annotations

import hashlib
import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db_session
from app.api.routes.public_submissions import (
    _validate_consent_signatures,
    _validate_consents,
)
from app.core.config import Settings
from app.core.errors import AppError
from app.main import create_app
from app.models.domain import (
    Client,
    FormSubmission,
    SignatureVerification,
    TeamMember,
    Tenant,
    TenantStatus,
)

NOW = datetime(2026, 7, 28, 10, 0, tzinfo=UTC)
SIGNATURE_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
    "+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
ORIGIN = "http://forms.beautydocs.pl"


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


def _client(tenant: Tenant) -> Client:
    return Client(
        id=uuid4(),
        tenant_id=tenant.id,
        first_name="Ewa",
        last_name="Testowa",
        first_name_normalized="ewa",
        last_name_normalized="testowa",
        phone="+48 500 600 700",
        phone_normalized="+48 500 600 700",
        email=None,
        archived_at=None,
        created_at=NOW,
        updated_at=NOW,
    )


def _practitioner(tenant: Tenant) -> TeamMember:
    return TeamMember(
        id=uuid4(),
        tenant_id=tenant.id,
        membership_id=uuid4(),
        display_name="Anna Nowak",
        email="anna@example.test",
        phone="+48 700 800 900",
        phone_normalized="+48700800900",
        job_title="Kosmetolog",
        is_owner=False,
        performs_treatments=True,
        all_treatments=True,
        treatment_codes=[],
        is_active=True,
        signature_data_url=SIGNATURE_DATA_URL,
        signature_updated_at=NOW,
        created_at=NOW,
        updated_at=NOW,
    )


def _submission_payload(practitioner_id: str) -> dict[str, object]:
    return {
        "client": {
            "fullName": "Ewa Testowa",
            "phone": "+48 500 600 700",
        },
        "treatmentArea": ["usta"],
        "answers": {
            "osobaPrzeprowadzajacaZabieg": "Fałszywa nazwa z przeglądarki",
            "alergie": "no",
        },
        "consents": {},
        "placeAndDate": "Warszawa, 28.07.2026",
        "practitionerTeamMemberId": practitioner_id,
    }


def test_client_verification_stores_draft_without_auto_practitioner_signature() -> None:
    tenant = _tenant()
    practitioner = _practitioner(tenant)
    existing_client = _client(tenant)
    version_id = uuid4()

    version_result = MagicMock()
    version_result.first.return_value = SimpleNamespace(
        name="Modelowanie ust",
        id=version_id,
        version_number=3,
        legal_content={},
        schema_definition={
            "sections": [
                {
                    "fields": [
                        {
                            "key": "osobaPrzeprowadzajacaZabieg",
                            "required": True,
                        }
                    ]
                }
            ]
        },
    )
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[tenant, practitioner, existing_client, None])
    session.execute = AsyncMock(side_effect=[MagicMock(), version_result])

    async def assign_submission_id() -> None:
        if not session.add.call_args_list:
            return
        added = session.add.call_args_list[-1].args[0]
        if isinstance(added, (FormSubmission, SignatureVerification)) and added.id is None:
            added.id = uuid4()

    session.flush = AsyncMock(side_effect=assign_submission_id)

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None, auth_allowed_origins=[ORIGIN]))
    app.dependency_overrides[get_db_session] = override_db_session

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/public/tenants/salon-a/forms/modelowanie-ust/submissions/client-verification",
            headers={"Origin": ORIGIN},
            json=_submission_payload(str(practitioner.id)),
        )

    assert response.status_code == 201
    submission = next(
        call.args[0]
        for call in session.add.call_args_list
        if isinstance(call.args[0], FormSubmission)
    )
    assert isinstance(submission, FormSubmission)
    assert submission.tenant_id == tenant.id
    assert submission.client_id == existing_client.id
    assert submission.practitioner_team_member_id == practitioner.id
    assert submission.answers["fields"]["osobaPrzeprowadzajacaZabieg"] == "Anna Nowak"
    assert submission.status == "DRAFT"
    assert submission.answers["consents"] == {}
    assert submission.document_snapshot["practitioner"] == {
        "teamMemberId": str(practitioner.id),
        "displayName": "Anna Nowak",
        "jobTitle": "Kosmetolog",
        "signature": None,
        "signedAt": None,
    }
    expected_hash = hashlib.sha256(
        json.dumps(
            submission.document_snapshot,
            sort_keys=True,
            ensure_ascii=False,
        ).encode("utf-8")
    ).hexdigest()
    assert submission.document_hash == expected_hash
    assert len(response.json()["devCode"]) == 6
    practitioner_query = session.scalar.await_args_list[1].args[0]
    assert "team_members.tenant_id" in str(practitioner_query)
    assert "team_members.is_active IS true" in str(practitioner_query)
    assert "team_members.performs_treatments IS true" in str(practitioner_query)


def test_practitioner_without_panel_account_or_phone_cannot_be_selected() -> None:
    tenant = _tenant()
    practitioner = _practitioner(tenant)
    practitioner.signature_data_url = None
    practitioner.membership_id = None
    practitioner.phone_normalized = None

    version_result = MagicMock()
    version_result.first.return_value = SimpleNamespace(
        name="Modelowanie ust",
        id=uuid4(),
        version_number=1,
        legal_content={},
        schema_definition={
            "sections": [
                {
                    "fields": [
                        {
                            "key": "osobaPrzeprowadzajacaZabieg",
                            "required": True,
                        }
                    ]
                }
            ]
        },
    )
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[tenant, None])
    session.execute = AsyncMock(side_effect=[MagicMock(), version_result])

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None, auth_allowed_origins=[ORIGIN]))
    app.dependency_overrides[get_db_session] = override_db_session

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/public/tenants/salon-a/forms/modelowanie-ust/submissions/client-verification",
            headers={"Origin": ORIGIN},
            json=_submission_payload(str(practitioner.id)),
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_practitioner"
    session.add.assert_not_called()


def test_verified_client_accepts_consents_with_final_signature() -> None:
    tenant = _tenant()
    existing_client = _client(tenant)
    version_id = uuid4()
    submission_id = uuid4()
    verification_id = uuid4()
    submission_token = "A" * 43
    answers = {
        "fields": {"alergie": "no"},
        "treatmentArea": ["usta"],
        "consents": {},
        "placeAndDate": "Warszawa, 28.07.2026",
    }
    snapshot = {
        "formCode": "modelowanie-ust",
        "formName": "Modelowanie ust",
        "templateVersion": 3,
        "client": {
            "fullName": "Ewa Testowa",
            "phone": "+48 500 600 700",
            "email": None,
            "birthDate": None,
            "street": None,
            "postalCode": None,
            "city": None,
        },
        "answers": answers,
        "practitioner": None,
        "signatures": {},
        "clientSigning": {"status": "PENDING_SMS"},
    }
    draft_hash = hashlib.sha256(
        json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    submission = FormSubmission(
        id=submission_id,
        tenant_id=tenant.id,
        client_id=existing_client.id,
        form_template_version_id=version_id,
        practitioner_team_member_id=None,
        status="DRAFT",
        answers=answers,
        document_snapshot=snapshot,
        document_hash=draft_hash,
        public_access_token_digest=hashlib.sha256(submission_token.encode("ascii")).hexdigest(),
    )
    verification = SignatureVerification(
        id=verification_id,
        tenant_id=tenant.id,
        form_submission_id=submission.id,
        method="SMS_OTP",
        signer_type="CLIENT",
        status="VERIFIED",
        otp_digest="test-digest",
        destination_masked="+48 *** *** 700",
        provider="smsapi",
        document_hash=draft_hash,
        attempt_count=0,
        created_at=NOW,
        expires_at=datetime(2030, 1, 1, tzinfo=UTC),
        verified_at=NOW,
        consumed_at=None,
    )
    version_result = MagicMock()
    version_result.first.return_value = SimpleNamespace(
        name="Modelowanie ust",
        id=version_id,
        version_number=3,
        legal_content={},
        schema_definition={
            "sections": [
                {
                    "fields": [
                        {
                            "key": "zgodaPrzetwarzanieDanych",
                            "type": "consent",
                            "required": True,
                        },
                        {
                            "key": "zgodaMarketing",
                            "type": "consent",
                            "required": False,
                        },
                    ]
                }
            ]
        },
    )
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[tenant, submission, verification, existing_client])
    session.execute = AsyncMock(side_effect=[MagicMock(), version_result])

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    app = create_app(Settings(_env_file=None, auth_allowed_origins=[ORIGIN]))
    app.dependency_overrides[get_db_session] = override_db_session
    consents = {
        "zgodaWykonanieZabiegu": True,
        "zgodaPrzetwarzanieDanych": True,
        "zgodaMarketing": False,
    }

    with TestClient(app) as client:
        response = client.post(
            f"/api/v1/public/tenants/salon-a/forms/modelowanie-ust/submissions/"
            f"{submission.id}/client-signature",
            headers={"Origin": ORIGIN},
            json={
                "submissionToken": submission_token,
                "verificationId": str(verification.id),
                "consents": consents,
                "signatures": {
                    "podpisDane": SIGNATURE_DATA_URL,
                    "podpisRodo": SIGNATURE_DATA_URL,
                    "podpisMarketing": SIGNATURE_DATA_URL,
                },
            },
        )

    assert response.status_code == 201
    assert submission.answers["consents"] == consents
    assert submission.document_snapshot["answers"]["consents"] == consents
    assert submission.document_snapshot["signatures"] == {
        "podpisDane": SIGNATURE_DATA_URL,
        "podpisRodo": SIGNATURE_DATA_URL,
        "podpisMarketing": SIGNATURE_DATA_URL,
    }
    assert submission.document_snapshot["clientSigning"]["draftDocumentHash"] == (draft_hash)
    assert submission.status == "SUBMITTED"
    assert submission.document_hash != draft_hash
    assert submission.public_access_token_digest is None
    assert verification.consumed_at is not None
    assert response.json()["claimToken"]
    assert response.json()["claimExpiresInSeconds"] == 1_800


def test_each_consent_decision_including_refusal_requires_its_own_signature() -> None:
    with pytest.raises(AppError) as raised:
        _validate_consent_signatures(
            {
                "zgodaWykonanieZabiegu": True,
                "zgodaPrzetwarzanieDanych": True,
                "zgodaMarketing": True,
                "zgodaFotografie": False,
            },
            {
                "podpisDane": SIGNATURE_DATA_URL,
                "podpisRodo": SIGNATURE_DATA_URL,
            },
        )

    assert raised.value.status_code == 422
    assert raised.value.code == "consent_signature_required"

    _validate_consent_signatures(
        {
            "zgodaWykonanieZabiegu": True,
            "zgodaPrzetwarzanieDanych": True,
            "zgodaMarketing": True,
            "zgodaFotografie": False,
        },
        {
            "podpisDane": SIGNATURE_DATA_URL,
            "podpisRodo": SIGNATURE_DATA_URL,
            "podpisMarketing": SIGNATURE_DATA_URL,
            "podpisFotografie": SIGNATURE_DATA_URL,
        },
    )


def test_treatment_consent_is_always_required_for_client_signature() -> None:
    definition = {"sections": [{"fields": []}]}

    with pytest.raises(AppError) as raised:
        _validate_consents({}, definition)

    assert raised.value.status_code == 422
    assert raised.value.code == "consent_required"

    _validate_consents({"zgodaWykonanieZabiegu": True}, definition)
