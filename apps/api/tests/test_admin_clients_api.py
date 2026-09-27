from __future__ import annotations

import base64
from collections.abc import AsyncIterator
from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db_session, require_tenant_membership
from app.core.auth_context import AuthenticatedUser, TenantAccess
from app.core.config import Settings
from app.main import create_app
from app.models.domain import (
    Client,
    ClientNote,
    ClientNoteCategory,
    FormSubmission,
    MembershipRole,
    SignatureVerification,
    TeamMember,
    Tenant,
    TenantStatus,
    Visit,
    VisitStatus,
)

NOW = datetime(2026, 7, 19, 10, 0, tzinfo=UTC)
SIGNATURE_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
SIGNATURE_PNG_BYTES = base64.b64decode(SIGNATURE_PNG_BASE64)


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


def _access(tenant: Tenant, role: MembershipRole) -> TenantAccess:
    return TenantAccess(
        principal=AuthenticatedUser(
            user_id=uuid4(),
            email="staff@example.test",
            display_name="Staff",
        ),
        tenant=tenant,
        role=role,
    )


def _client(tenant: Tenant) -> Client:
    return Client(
        id=uuid4(),
        tenant_id=tenant.id,
        first_name="Anna",
        last_name="Testowa",
        first_name_normalized="anna",
        last_name_normalized="testowa",
        phone="+48 111 222 333",
        phone_normalized="48111222333",
        email="anna@example.test",
        birth_date=date(1990, 5, 4),
        archived_at=None,
        created_at=NOW,
        updated_at=NOW,
    )


def _rows(items: list[object]) -> MagicMock:
    result = MagicMock()
    result.all.return_value = items
    return result


def _test_app(
    session: MagicMock,
    access: TenantAccess,
) -> FastAPI:
    async def override_db_session() -> AsyncIterator[AsyncSession]:
        yield session

    async def override_access() -> TenantAccess:
        return access

    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[require_tenant_membership] = override_access
    return app


@pytest.mark.parametrize("role", list(MembershipRole))
def test_client_list_is_available_to_every_active_membership_role(
    role: MembershipRole,
) -> None:
    tenant = _tenant()
    client_row = _client(tenant)
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=1)
    session.scalars = AsyncMock(return_value=_rows([client_row]))
    app = _test_app(session, _access(tenant, role))

    with TestClient(app) as client:
        response = client.get(
            "/api/v1/admin/tenants/salon-a/clients",
            params={"page": 1, "pageSize": 20},
        )

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, no-store"
    assert response.json() == {
        "items": [
            {
                "id": str(client_row.id),
                "firstName": "Anna",
                "lastName": "Testowa",
                "phone": "+48 111 222 333",
                "email": "anna@example.test",
                "archivedAt": None,
                "createdAt": "2026-07-19T10:00:00Z",
                "updatedAt": "2026-07-19T10:00:00Z",
            }
        ],
        "total": 1,
        "page": 1,
        "pageSize": 20,
        "totalPages": 1,
    }
    assert "birthDate" not in response.text
    assert "clients.tenant_id" in str(session.scalar.await_args.args[0])
    assert "clients.tenant_id" in str(session.scalars.await_args.args[0])


def test_client_list_normalizes_search_and_treats_wildcards_literally() -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=0)
    session.scalars = AsyncMock(return_value=_rows([]))
    app = _test_app(session, _access(tenant, MembershipRole.READ_ONLY))

    with TestClient(app) as client:
        response = client.get(
            "/api/v1/admin/tenants/salon-a/clients",
            params={"search": "  \uff21%_  ", "page": 2, "pageSize": 10},
        )

    assert response.status_code == 200
    assert response.json()["page"] == 2
    assert response.json()["totalPages"] == 0
    count_query = session.scalar.await_args.args[0]
    data_query = session.scalars.await_args.args[0]
    assert "clients.tenant_id" in str(count_query)
    assert "clients.tenant_id" in str(data_query)
    bound_values = list(data_query.compile().params.values())
    assert "%a\\%\\_%" in bound_values


@pytest.mark.parametrize("search", ["a", "x" * 81])
def test_client_list_rejects_unbounded_search_without_echoing_input(
    search: str,
) -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock()
    session.scalars = AsyncMock()
    app = _test_app(session, _access(tenant, MembershipRole.OWNER))

    with TestClient(app) as client:
        response = client.get(
            "/api/v1/admin/tenants/salon-a/clients",
            params={"search": search},
        )

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "invalid_search"
    assert "details" not in error
    assert response.headers["Cache-Control"] == "private, no-store"
    session.scalar.assert_not_awaited()
    session.scalars.assert_not_awaited()


@pytest.mark.parametrize(
    "query",
    [
        {"page": 0},
        {"page": 501},
        {"pageSize": 0},
        {"pageSize": 101},
    ],
)
def test_client_list_enforces_pagination_bounds(query: dict[str, int]) -> None:
    tenant = _tenant()
    session = MagicMock(spec=AsyncSession)
    app = _test_app(session, _access(tenant, MembershipRole.ADMIN))

    with TestClient(app) as client:
        response = client.get(
            "/api/v1/admin/tenants/salon-a/clients",
            params=query,
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_client_profile_returns_bounded_latest_summaries_in_camel_case() -> None:
    tenant = _tenant()
    client_row = _client(tenant)
    visit = Visit(
        id=uuid4(),
        tenant_id=tenant.id,
        client_id=client_row.id,
        staff_membership_id=None,
        form_template_id=None,
        treatment_name="Lip augmentation",
        starts_at=NOW - timedelta(days=2),
        ends_at=NOW - timedelta(days=2) + timedelta(hours=1),
        status=VisitStatus.COMPLETED.value,
        notes="Follow-up recommended",
        anaesthesia="Local",
        created_at=NOW - timedelta(days=2),
        updated_at=NOW - timedelta(days=2),
    )
    note = ClientNote(
        id=uuid4(),
        tenant_id=tenant.id,
        client_id=client_row.id,
        author_membership_id=uuid4(),
        body="Allergy noted",
        category=ClientNoteCategory.ALERGIA.value,
        created_at=NOW - timedelta(days=1),
        edited_at=None,
    )
    form_id = uuid4()
    form_row = SimpleNamespace(
        id=form_id,
        visit_id=visit.id,
        template_code="lip-augmentation",
        template_name="Lip augmentation consent",
        status="SUBMITTED",
        submitted_at=NOW - timedelta(days=2),
        signed_at=None,
        created_at=NOW - timedelta(days=2),
    )

    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[client_row, 1, 101, 1])
    session.scalars = AsyncMock(side_effect=[_rows([visit]), _rows([note])])
    form_result = MagicMock()
    form_result.all.return_value = [form_row]
    session.execute = AsyncMock(return_value=form_result)
    app = _test_app(session, _access(tenant, MembershipRole.STAFF))

    with TestClient(app) as client:
        response = client.get(f"/api/v1/admin/tenants/salon-a/clients/{client_row.id}")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, no-store"
    payload = response.json()
    assert payload["client"]["birthDate"] == "1990-05-04"
    assert payload["visits"]["items"][0]["treatmentName"] == "Lip augmentation"
    assert payload["visits"]["total"] == 1
    assert payload["visits"]["truncated"] is False
    assert payload["notes"] == {
        "items": [
            {
                "id": str(note.id),
                "body": "Allergy noted",
                "category": "ALERGIA",
                "createdAt": "2026-07-18T10:00:00Z",
                "editedAt": None,
            }
        ],
        "total": 101,
        "truncated": True,
    }
    assert payload["forms"]["items"][0] == {
        "id": str(form_id),
        "visitId": str(visit.id),
        "templateCode": "lip-augmentation",
        "templateName": "Lip augmentation consent",
        "status": "SUBMITTED",
        "submittedAt": "2026-07-17T10:00:00Z",
        "signedAt": None,
        "createdAt": "2026-07-17T10:00:00Z",
    }
    assert "answers" not in response.text

    profile_queries = [call.args[0] for call in session.scalar.await_args_list] + [
        call.args[0] for call in session.scalars.await_args_list
    ]
    profile_queries.append(session.execute.await_args.args[0])
    assert all("tenant_id" in str(query) for query in profile_queries)
    assert " LIMIT " in str(session.scalars.await_args_list[0].args[0])
    assert " LIMIT " in str(session.scalars.await_args_list[1].args[0])
    assert " LIMIT " in str(session.execute.await_args.args[0])


def test_client_profile_uses_same_non_leaking_404_for_unknown_client() -> None:
    tenant = _tenant()
    missing_client_id = UUID("aaaaaaaa-0000-0000-0000-000000000001")
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=None)
    app = _test_app(session, _access(tenant, MembershipRole.READ_ONLY))

    with TestClient(app) as client:
        response = client.get(f"/api/v1/admin/tenants/salon-a/clients/{missing_client_id}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "client_not_found"
    assert response.json()["error"]["message"] == "Client was not found"
    assert str(missing_client_id) not in response.text
    assert response.headers["Cache-Control"] == "private, no-store"
    lookup_query = session.scalar.await_args.args[0]
    assert "clients.tenant_id" in str(lookup_query)
    assert "clients.id" in str(lookup_query)


@pytest.mark.parametrize("role", list(MembershipRole))
def test_client_form_detail_returns_labeled_answers_without_signature_image(
    role: MembershipRole,
) -> None:
    tenant = _tenant()
    client_row = _client(tenant)
    submission_id = uuid4()
    submission = FormSubmission(
        id=submission_id,
        tenant_id=tenant.id,
        client_id=client_row.id,
        visit_id=None,
        form_template_version_id=uuid4(),
        status="SIGNED",
        answers={
            "fields": {
                "produkt": "Juvederm",
                "contraindications": {"alergia": {"answer": "yes", "followUp": "Lateks"}},
            },
            "treatmentArea": ["forehead", "calf_right"],
            "consents": {"zgodaDane": True},
            "placeAndDate": "Warszawa, 19.07.2026",
        },
        document_snapshot={
            "client": {
                "fullName": "Anna Testowa",
                "phone": "+48 111 222 333",
            },
            "signatures": {
                "podpisDane": "data:image/png;base64,PRIVATE_SIGNATURE_IMAGE",
                "podpisRodo2": "data:image/png;base64,SECOND_PRIVATE_SIGNATURE_IMAGE",
            },
            "clientSigning": {
                "method": "sms_otp",
                "status": "VERIFIED",
                "destinationMasked": "+48 *** *** 333",
                "verifiedAt": "2026-07-19T09:59:00Z",
                "verificationId": "verification-123",
                "draftDocumentHash": "b" * 64,
            },
        },
        document_hash="a" * 64,
        submitted_at=NOW,
        signed_at=NOW,
        created_at=NOW,
        updated_at=NOW,
    )

    class DetailRow(SimpleNamespace):
        def __getitem__(self, index: int) -> object:
            if index == 0:
                return submission
            raise IndexError(index)

    detail_row = DetailRow(
        **{
            "client_first_name": "Anna",
            "client_last_name": "Testowa",
            "template_code": "modelowanie-ust",
            "template_name": "Modelowanie ust",
            "template_version": 2,
            "template_schema": {
                "anatomy": {
                    "model": "both",
                    "faceZoneSet": "face",
                    "bodyZoneSet": "body",
                },
                "sections": [
                    {
                        "type": "fields",
                        "key": "zabieg",
                        "title": "Dane zabiegu",
                        "fields": [
                            {
                                "key": "produkt",
                                "label": "Nazwa produktu",
                                "type": "text",
                            },
                            {
                                "key": "obszarZabiegu",
                                "label": "Obszar zabiegu",
                                "type": "text",
                            },
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
                        "items": [
                            {
                                "key": "alergia",
                                "question": "Czy występują alergie?",
                            }
                        ],
                    },
                ]
            },
            "template_legal_content": {
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
                        "text": "Pełna treść dokumentu {{salonName}}",
                    }
                ],
            },
        }
    )
    result = MagicMock()
    result.first.return_value = detail_row
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=result)
    app = _test_app(session, _access(tenant, role))

    with TestClient(app) as client:
        response = client.get(
            f"/api/v1/admin/tenants/salon-a/clients/{client_row.id}/forms/{submission_id}"
        )

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, no-store"
    payload = response.json()
    assert payload["submission"]["templateName"] == "Modelowanie ust"
    assert payload["submission"]["templateVersion"] == 2
    assert payload["sections"][0]["items"][0] == {
        "key": "produkt",
        "label": "Nazwa produktu",
        "kind": "field",
        "value": "Juvederm",
        "detail": None,
    }
    assert payload["signatureKeys"] == ["podpisDane", "podpisRodo2"]
    assert payload["documentHash"] == "a" * 64
    assert payload["printMetadata"]["documentHash"] == "a" * 64
    assert payload["printMetadata"]["templateVersion"] == 2
    assert payload["anatomy"] == {
        "model": "both",
        "faceZoneSet": "face",
        "bodyZoneSet": "body",
    }
    assert payload["treatmentAreaIds"] == ["forehead", "calf_right"]
    sections = {section["key"]: section for section in payload["sections"]}
    treatment_area = next(
        item
        for item in sections["zabieg"]["items"]
        if item["key"] == "obszarZabiegu"
    )
    assert treatment_area["value"] == "Czoło, Prawa łydka"
    signature = next(
        item
        for item in sections["consents"]["items"]
        if item["key"] == "podpisDane"
    )
    assert signature["label"] == "Oświadczenie klientki"
    assert signature["detail"] == "Pełna treść dokumentu Salon A"
    assert sections["consents"]["items"][0]["detail"] == "Treść zgody dla Salon A"
    assert [item["key"] for item in sections["consents"]["items"]] == [
        "zgodaDane",
        "podpisDane",
        "podpisRodo2",
    ]
    assert sections["consents"]["items"][2]["label"] == (
        "Podpis pod klauzulą informacyjną RODO"
    )
    assert all(
        item["kind"] != "signature" for item in sections["zabieg"]["items"]
    )
    assert all(
        item["kind"] != "signature" for item in sections["additional"]["items"]
    )
    evidence = {
        item["key"]: item["value"]
        for item in sections["client-signing-evidence"]["items"]
    }
    assert evidence["clientSigningMethod"] == "Jednorazowy kod SMS"
    assert evidence["clientSigningStatus"] == "Potwierdzono"
    assert evidence["destinationMasked"] == "+48 *** *** 333"
    assert evidence["draftDocumentHash"] == "b" * 64
    assert evidence["documentForm"] == "dokument elektroniczny"
    assert "PRIVATE_SIGNATURE_IMAGE" not in response.text
    detail_query = session.execute.await_args.args[0]
    compiled = str(detail_query)
    assert "form_submissions.tenant_id" in compiled
    assert "form_submissions.client_id" in compiled
    assert "form_submissions.id" in compiled


def test_client_form_detail_uses_non_leaking_404() -> None:
    tenant = _tenant()
    client_id = uuid4()
    submission_id = uuid4()
    result = MagicMock()
    result.first.return_value = None
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=result)
    app = _test_app(session, _access(tenant, MembershipRole.READ_ONLY))

    with TestClient(app) as client:
        response = client.get(
            f"/api/v1/admin/tenants/salon-a/clients/{client_id}/forms/{submission_id}"
        )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "client_form_not_found"
    assert str(client_id) not in response.text
    assert str(submission_id) not in response.text


def test_client_form_detail_treats_practitioner_column_as_authoritative_signature() -> None:
    """A signed submission whose embedded snapshot copy lost the practitioner
    signature must still report it as signed — the dedicated column is
    written in the same transaction as the SIGNED status and is never wrong,
    unlike the embedded copy which has been found missing on real rows.
    """
    tenant = _tenant()
    client_row = _client(tenant)
    submission_id = uuid4()
    practitioner_id = uuid4()
    signed_at = NOW
    submission = FormSubmission(
        id=submission_id,
        tenant_id=tenant.id,
        client_id=client_row.id,
        visit_id=None,
        form_template_version_id=uuid4(),
        status="SIGNED",
        answers={},
        document_snapshot={
            "client": {"fullName": "Anna Testowa", "phone": "+48 111 222 333"},
            "practitioner": {
                "teamMemberId": str(practitioner_id),
                "displayName": "Mateusz Gardzina",
                "signature": None,
            },
        },
        document_hash="a" * 64,
        practitioner_signature_data_url=f"data:image/png;base64,{SIGNATURE_PNG_BASE64}",
        practitioner_signed_at=signed_at,
        submitted_at=NOW,
        signed_at=NOW,
        created_at=NOW,
        updated_at=NOW,
    )

    class DetailRow(SimpleNamespace):
        def __getitem__(self, index: int) -> object:
            if index == 0:
                return submission
            raise IndexError(index)

    detail_row = DetailRow(
        client_first_name="Anna",
        client_last_name="Testowa",
        template_code="modelowanie-ust",
        template_name="Modelowanie ust",
        template_version=2,
        template_schema={"sections": []},
        template_legal_content={"consents": [], "documents": []},
    )
    result = MagicMock()
    result.first.return_value = detail_row
    practitioner_row = TeamMember(
        id=practitioner_id,
        tenant_id=tenant.id,
        display_name="Mateusz Gardzina",
        job_title=None,
        membership_id=uuid4(),
        is_owner=True,
        is_active=True,
        performs_treatments=True,
    )
    actor_membership_id = uuid4()
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=result)
    session.scalar = AsyncMock(side_effect=["pl", practitioner_row, actor_membership_id])
    app = _test_app(session, _access(tenant, MembershipRole.OWNER))

    with TestClient(app) as client:
        response = client.get(
            f"/api/v1/admin/tenants/salon-a/clients/{client_row.id}/forms/{submission_id}"
        )

    assert response.status_code == 200
    practitioner = response.json()["practitioner"]
    assert practitioner["signatureConfigured"] is True
    assert practitioner["signedAt"] is not None
    assert "PRIVATE_SIGNATURE_IMAGE" not in response.text


def test_client_form_practitioner_signature_prefers_dedicated_column() -> None:
    tenant = _tenant()
    client_id = uuid4()
    submission_id = uuid4()
    result = MagicMock()
    result.first.return_value = SimpleNamespace(
        document_snapshot={"practitioner": {"signature": None}},
        practitioner_signature_data_url=f"data:image/png;base64,{SIGNATURE_PNG_BASE64}",
    )
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=result)
    app = _test_app(session, _access(tenant, MembershipRole.READ_ONLY))

    with TestClient(app) as client:
        response = client.get(
            f"/api/v1/admin/tenants/salon-a/clients/{client_id}"
            f"/forms/{submission_id}/practitioner-signature"
        )

    assert response.status_code == 200
    assert response.content == SIGNATURE_PNG_BYTES
    assert response.headers["Content-Type"] == "image/png"


def test_client_form_detail_query_excludes_draft_submissions() -> None:
    """A DRAFT means the client never finished signing — nothing to show yet.

    Without this filter a staff member could open an abandoned draft and see
    a confusing "client already signed" message that isn't true.
    """
    tenant = _tenant()
    client_id = uuid4()
    submission_id = uuid4()
    result = MagicMock()
    result.first.return_value = None
    session = MagicMock(spec=AsyncSession)
    session.execute = AsyncMock(return_value=result)
    app = _test_app(session, _access(tenant, MembershipRole.READ_ONLY))

    with TestClient(app) as client:
        client.get(
            f"/api/v1/admin/tenants/salon-a/clients/{client_id}/forms/{submission_id}"
        )

    query = session.execute.await_args.args[0]
    bound_values = list(query.compile().params.values())
    assert ["SUBMITTED", "SIGNED"] in bound_values
    assert "DRAFT" not in bound_values


def test_client_forms_list_query_excludes_draft_submissions() -> None:
    tenant = _tenant()
    client_row = _client(tenant)
    session = MagicMock(spec=AsyncSession)
    # tenant_client_profile calls session.scalar for the client lookup, then
    # the visits/notes/forms counts (in that order).
    session.scalar = AsyncMock(side_effect=[client_row, 0, 0, 0])
    empty_scalars = MagicMock()
    empty_scalars.all.return_value = []
    session.scalars = AsyncMock(return_value=empty_scalars)
    forms_result = MagicMock()
    forms_result.all.return_value = []
    session.execute = AsyncMock(return_value=forms_result)
    app = _test_app(session, _access(tenant, MembershipRole.READ_ONLY))

    with TestClient(app) as client:
        response = client.get(
            f"/api/v1/admin/tenants/salon-a/clients/{client_row.id}"
        )

    assert response.status_code == 200
    forms_query = session.execute.await_args.args[0]
    bound_values = list(forms_query.compile().params.values())
    assert ["SUBMITTED", "SIGNED"] in bound_values
    assert "DRAFT" not in bound_values
    forms_count_query = session.scalar.await_args_list[3].args[0]
    count_bound_values = list(forms_count_query.compile().params.values())
    assert ["SUBMITTED", "SIGNED"] in count_bound_values


@pytest.mark.parametrize("role", list(MembershipRole))
def test_client_form_signature_returns_private_png_for_every_active_role(
    role: MembershipRole,
) -> None:
    tenant = _tenant()
    client_id = uuid4()
    submission_id = uuid4()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(
        return_value={"signatures": {"podpisDane": f"data:image/png;base64,{SIGNATURE_PNG_BASE64}"}}
    )
    app = _test_app(session, _access(tenant, role))

    with TestClient(app) as client:
        response = client.get(
            f"/api/v1/admin/tenants/salon-a/clients/{client_id}"
            f"/forms/{submission_id}/signatures/podpisDane"
        )

    assert response.status_code == 200
    assert response.content == SIGNATURE_PNG_BYTES
    assert response.headers["Content-Type"] == "image/png"
    assert response.headers["Cache-Control"] == "private, no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Content-Disposition"] == ('inline; filename="signature.png"')
    signature_query = session.scalar.await_args.args[0]
    compiled = str(signature_query)
    assert "form_submissions.tenant_id" in compiled
    assert "form_submissions.client_id" in compiled
    assert "form_submissions.id" in compiled


@pytest.mark.parametrize(
    "document_snapshot",
    [
        None,
        {"signatures": {}},
        {"signatures": {"podpisDane": "data:image/png;base64,invalid"}},
        {"signatures": {"podpisDane": "data:text/html;base64,PGgxPng8L2gxPg=="}},
    ],
)
def test_client_form_signature_uses_non_leaking_404(
    document_snapshot: object,
) -> None:
    tenant = _tenant()
    client_id = uuid4()
    submission_id = uuid4()
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(return_value=document_snapshot)
    app = _test_app(session, _access(tenant, MembershipRole.READ_ONLY))

    with TestClient(app) as client:
        response = client.get(
            f"/api/v1/admin/tenants/salon-a/clients/{client_id}"
            f"/forms/{submission_id}/signatures/podpisDane"
        )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == ("client_form_signature_not_found")
    assert str(client_id) not in response.text
    assert str(submission_id) not in response.text
    assert "podpisDane" not in response.text
    assert response.headers["Cache-Control"] == "private, no-store"


def test_assigned_practitioner_receives_independent_sms_challenge() -> None:
    tenant = _tenant()
    access = _access(tenant, MembershipRole.STAFF)
    membership_id = uuid4()
    client_id = uuid4()
    submission_id = uuid4()
    practitioner = TeamMember(
        id=uuid4(),
        tenant_id=tenant.id,
        membership_id=membership_id,
        display_name="Karolina Testowa",
        email="staff@example.test",
        phone="+48 700 800 900",
        phone_normalized="+48700800900",
        job_title="Kosmetolog",
        is_owner=False,
        performs_treatments=True,
        is_active=True,
        signature_data_url=None,
        signature_updated_at=None,
        created_at=NOW,
        updated_at=NOW,
    )
    submission = FormSubmission(
        id=submission_id,
        tenant_id=tenant.id,
        client_id=client_id,
        form_template_version_id=uuid4(),
        practitioner_team_member_id=practitioner.id,
        status="SUBMITTED",
        answers={},
        document_snapshot={"practitioner": {"teamMemberId": str(practitioner.id)}},
        document_hash="a" * 64,
        submitted_at=NOW,
        created_at=NOW,
        updated_at=NOW,
    )
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[membership_id, submission, practitioner, None])

    async def assign_verification_id() -> None:
        added = session.add.call_args.args[0]
        if isinstance(added, SignatureVerification) and added.id is None:
            added.id = uuid4()

    session.flush = AsyncMock(side_effect=assign_verification_id)
    app = _test_app(session, access)

    with TestClient(app) as client:
        response = client.post(
            f"/api/v1/admin/tenants/salon-a/clients/{client_id}"
            f"/forms/{submission_id}/practitioner-verification",
            headers={
                "Origin": "http://localhost:3000",
                "User-Agent": "BeautyDocs test browser",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["destinationMasked"].endswith("900")
    assert len(payload["devCode"]) == 6
    verification = session.add.call_args.args[0]
    assert isinstance(verification, SignatureVerification)
    assert verification.signer_type == "PRACTITIONER"
    assert verification.signer_membership_id == membership_id
    assert verification.signer_team_member_id == practitioner.id
    assert verification.document_hash == submission.document_hash
    assert verification.requested_user_agent == "BeautyDocs test browser"


def test_practitioner_signature_finalizes_same_reviewed_document_hash() -> None:
    tenant = _tenant()
    access = _access(tenant, MembershipRole.STAFF)
    membership_id = uuid4()
    client_id = uuid4()
    submission_id = uuid4()
    practitioner = TeamMember(
        id=uuid4(),
        tenant_id=tenant.id,
        membership_id=membership_id,
        display_name="Karolina Testowa",
        email="staff@example.test",
        phone="+48 700 800 900",
        phone_normalized="+48700800900",
        job_title="Kosmetolog",
        is_owner=False,
        performs_treatments=True,
        is_active=True,
        signature_data_url=None,
        signature_updated_at=None,
        created_at=NOW,
        updated_at=NOW,
    )
    reviewed_hash = "b" * 64
    submission = FormSubmission(
        id=submission_id,
        tenant_id=tenant.id,
        client_id=client_id,
        form_template_version_id=uuid4(),
        practitioner_team_member_id=practitioner.id,
        status="SUBMITTED",
        answers={},
        document_snapshot={
            "clientSigning": {"status": "SIGNED"},
            "practitioner": {
                "teamMemberId": str(practitioner.id),
                "displayName": practitioner.display_name,
                "signature": None,
            },
        },
        document_hash=reviewed_hash,
        submitted_at=NOW,
        created_at=NOW,
        updated_at=NOW,
    )
    verification = SignatureVerification(
        id=uuid4(),
        tenant_id=tenant.id,
        form_submission_id=submission.id,
        signer_type="PRACTITIONER",
        signer_membership_id=membership_id,
        signer_team_member_id=practitioner.id,
        status="VERIFIED",
        otp_digest="unused",
        destination_masked="+48••••••900",
        provider="DEVELOPMENT",
        provider_message_id=None,
        document_hash=reviewed_hash,
        attempt_count=0,
        created_at=NOW,
        expires_at=datetime.now(UTC) + timedelta(days=30),
        verified_at=NOW,
        consumed_at=None,
    )
    session = MagicMock(spec=AsyncSession)
    session.scalar = AsyncMock(side_effect=[membership_id, submission, practitioner, verification])
    session.flush = AsyncMock()
    app = _test_app(session, access)

    with TestClient(app) as client:
        response = client.post(
            f"/api/v1/admin/tenants/salon-a/clients/{client_id}"
            f"/forms/{submission_id}/practitioner-signature",
            headers={"Origin": "http://localhost:3000"},
            json={
                "verificationId": str(verification.id),
                "signature": f"data:image/png;base64,{SIGNATURE_PNG_BASE64}",
            },
        )

    assert response.status_code == 200
    assert response.json()["status"] == "SIGNED"
    assert submission.status == "SIGNED"
    assert submission.practitioner_signature_data_url is not None
    assert submission.document_hash != reviewed_hash
    assert submission.document_snapshot["practitioner"]["reviewedDocumentHash"] == reviewed_hash
    assert submission.document_snapshot["practitioner"]["verification"]["verificationId"] == str(
        verification.id
    )
    assert verification.consumed_at is not None
