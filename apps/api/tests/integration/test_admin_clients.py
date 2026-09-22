from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid5

import asyncpg  # type: ignore[import-untyped]
import pytest
from httpx import ASGITransport, AsyncClient, Response
from pydantic import SecretStr

from app.core.config import Settings
from app.core.security import generate_session_token, hash_password
from app.db.session import Database
from app.main import create_app

MIGRATOR_DSN = os.getenv("BEAUTYDOCS_INTEGRATION_MIGRATOR_DSN")
APP_DSN = os.getenv("BEAUTYDOCS_INTEGRATION_APP_DSN")

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(
        not MIGRATOR_DSN or not APP_DSN,
        reason="run through scripts/run_postgres_integration_tests.sh",
    ),
]

TENANT_A = UUID("71000000-0000-0000-0000-000000000001")
TENANT_B = UUID("72000000-0000-0000-0000-000000000002")
INACTIVE_TENANT = UUID("73000000-0000-0000-0000-000000000003")
CLIENT_A_1 = UUID("71100000-0000-0000-0000-000000000001")
CLIENT_A_2 = UUID("71100000-0000-0000-0000-000000000002")
CLIENT_A_3 = UUID("71100000-0000-0000-0000-000000000003")
CLIENT_A_4 = UUID("71100000-0000-0000-0000-000000000004")
CLIENT_B_1 = UUID("72200000-0000-0000-0000-000000000001")
MISSING_CLIENT = UUID("79900000-0000-0000-0000-000000000099")
TEMPLATE_ID = UUID("74000000-0000-0000-0000-000000000001")
TEMPLATE_VERSION_ID = UUID("74100000-0000-0000-0000-000000000001")
NAMESPACE = UUID("75000000-0000-0000-0000-000000000001")
SUBMISSION_A_100 = uuid5(NAMESPACE, "submission-a:100")
SUBMISSION_B = uuid5(NAMESPACE, "submission-b")
MISSING_SUBMISSION = uuid5(NAMESPACE, "submission-missing")
BASE_TIME = datetime(2025, 1, 1, 8, 0, tzinfo=UTC)

TENANT_A_PRIVATE_EMAIL = "anna.private-a@example.test"
TENANT_B_PRIVATE_EMAIL = "tenant-b-secret@example.test"
TENANT_B_PRIVATE_NOTE = "TENANT_B_PRIVATE_MEDICAL_NOTE"
PRIVATE_HEALTH_ANSWER = "PRIVATE_HEALTH_ANSWER_MUST_NOT_BE_LISTED"
SIGNATURE_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
SIGNATURE_PNG_BYTES = base64.b64decode(SIGNATURE_PNG_BASE64)
SIGNATURE_PNG_DATA_URL = f"data:image/png;base64,{SIGNATURE_PNG_BASE64}"

USERS = {
    "OWNER": UUID("76000000-0000-0000-0000-000000000001"),
    "ADMIN": UUID("76000000-0000-0000-0000-000000000002"),
    "STAFF": UUID("76000000-0000-0000-0000-000000000003"),
    "READ_ONLY": UUID("76000000-0000-0000-0000-000000000004"),
    "OUTSIDER": UUID("76000000-0000-0000-0000-000000000005"),
}
MEMBERSHIPS = {role: uuid5(NAMESPACE, f"membership:{role}") for role in USERS}


@asynccontextmanager
async def _tenant_transaction(
    connection: asyncpg.Connection,
    tenant_id: UUID,
) -> AsyncIterator[None]:
    async with connection.transaction():
        configured = await connection.fetchval(
            "SELECT set_config('app.tenant_id', $1, true)", str(tenant_id)
        )
        assert configured == str(tenant_id)
        yield


async def _seed_users_memberships_and_sessions(
    connection: asyncpg.Connection,
) -> dict[str, str]:
    tokens: dict[str, str] = {}
    for role, user_id in USERS.items():
        email = f"clients-{role.casefold().replace('_', '-')}@example.test"
        await connection.execute(
            """
            INSERT INTO users (
                id, email, email_normalized, password_hash,
                display_name, is_active
            )
            VALUES ($1, $2, $2, $3, $4, true)
            """,
            user_id,
            email,
            hash_password(f"synthetic-{role}"),
            f"Synthetic {role}",
        )

        tenant_id = TENANT_B if role == "OUTSIDER" else TENANT_A
        membership_role = "OWNER" if role == "OUTSIDER" else role
        async with _tenant_transaction(connection, tenant_id):
            await connection.execute(
                """
                INSERT INTO tenant_memberships (
                    id, tenant_id, user_id, role, is_active
                )
                VALUES ($1, $2, $3, $4, true)
                """,
                MEMBERSHIPS[role],
                tenant_id,
                user_id,
                membership_role,
            )

        raw_token = generate_session_token()
        digest = hashlib.sha256(raw_token.encode("ascii")).hexdigest()
        async with connection.transaction():
            await connection.fetchval("SELECT set_config('app.session_digest', $1, true)", digest)
            await connection.execute(
                """
                INSERT INTO auth_sessions (
                    id, user_id, token_digest, created_at, expires_at
                )
                VALUES ($1, $2, $3, $4, $5)
                """,
                uuid5(NAMESPACE, f"session:{role}"),
                user_id,
                digest,
                BASE_TIME,
                datetime.now(UTC) + timedelta(days=1),
            )
        tokens[role] = raw_token
    return tokens


async def _seed_clients_and_aggregates(
    connection: asyncpg.Connection,
) -> dict[str, str]:
    await connection.executemany(
        """
        INSERT INTO tenants (
            id, slug, display_name, legal_name, email,
            privacy_contact_email, status
        )
        VALUES ($1, $2, $3, $3, $4, $4, $5)
        """,
        [
            (
                TENANT_A,
                "clients-a",
                "Clients Tenant A",
                "clients-a@example.test",
                "ACTIVE",
            ),
            (
                TENANT_B,
                "clients-b",
                "Clients Tenant B",
                "clients-b@example.test",
                "ACTIVE",
            ),
            (
                INACTIVE_TENANT,
                "clients-inactive",
                "Inactive Clients Tenant",
                "clients-inactive@example.test",
                "SUSPENDED",
            ),
        ],
    )
    await connection.execute(
        """
        INSERT INTO form_templates (id, code, name, status)
        VALUES ($1, 'client-detail-test', 'Client detail test form', 'ACTIVE')
        """,
        TEMPLATE_ID,
    )
    await connection.execute(
        """
        INSERT INTO form_template_versions (
            id, form_template_id, version_number, schema,
            legal_content, content_hash, published_at
        )
        VALUES ($1, $2, 1, '{}'::jsonb, '{}'::jsonb, $3, $4)
        """,
        TEMPLATE_VERSION_ID,
        TEMPLATE_ID,
        "b" * 64,
        BASE_TIME,
    )

    clients_a = [
        (
            CLIENT_A_1,
            "Anna",
            "Kowalska",
            "anna",
            "kowalska",
            "+48 500 111 222",
            "48500111222",
            TENANT_A_PRIVATE_EMAIL,
            datetime(1990, 1, 2).date(),
            None,
            BASE_TIME,
        ),
        (
            CLIENT_A_2,
            "Beata",
            "Procent%%Literal",
            "beata",
            "procent%%literal",
            "+48 500 222 333",
            "48500222333",
            "percent@example.test",
            None,
            None,
            BASE_TIME + timedelta(minutes=1),
        ),
        (
            CLIENT_A_3,
            "Celina",
            "Pod__kreslenie",
            "celina",
            "pod__kreslenie",
            "+48 500 333 444",
            "48500333444",
            "underscore@example.test",
            None,
            BASE_TIME + timedelta(days=1),
            BASE_TIME + timedelta(minutes=2),
        ),
        (
            CLIENT_A_4,
            "Żaneta",
            "Łącka",
            "żaneta",
            "łącka",
            None,
            None,
            None,
            None,
            None,
            BASE_TIME + timedelta(minutes=3),
        ),
    ]
    async with _tenant_transaction(connection, TENANT_A):
        await connection.executemany(
            """
            INSERT INTO clients (
                id, tenant_id, first_name, last_name,
                first_name_normalized, last_name_normalized,
                phone, phone_normalized, email, birth_date,
                archived_at, created_at, updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9,
                $10, $11, $12, $12
            )
            """,
            [(client_id, TENANT_A, *values) for client_id, *values in clients_a],
        )

    async with _tenant_transaction(connection, TENANT_B):
        await connection.execute(
            """
            INSERT INTO clients (
                id, tenant_id, first_name, last_name,
                first_name_normalized, last_name_normalized,
                phone, phone_normalized, email, birth_date,
                created_at, updated_at
            )
            VALUES (
                $1, $2, 'Anna', 'Kowalska', 'anna', 'kowalska',
                '+48 500 111 222', '48500111222', $3,
                '1985-05-05', $4, $4
            )
            """,
            CLIENT_B_1,
            TENANT_B,
            TENANT_B_PRIVATE_EMAIL,
            BASE_TIME,
        )

    tokens = await _seed_users_memberships_and_sessions(connection)
    await _seed_tenant_a_aggregates(connection)
    await _seed_tenant_b_aggregates(connection)
    return tokens


async def _seed_tenant_a_aggregates(connection: asyncpg.Connection) -> None:
    async with _tenant_transaction(connection, TENANT_A):
        await connection.executemany(
            """
            INSERT INTO client_notes (
                id, tenant_id, client_id, author_membership_id,
                body, category, created_at
            )
            VALUES ($1, $2, $3, $4, $5, 'UWAGA', $6)
            """,
            [
                (
                    uuid5(NAMESPACE, f"note-a:{index}"),
                    TENANT_A,
                    CLIENT_A_1,
                    MEMBERSHIPS["OWNER"],
                    f"Authorized note A {index}",
                    BASE_TIME + timedelta(minutes=index),
                )
                for index in range(101)
            ],
        )
        await connection.executemany(
            """
            INSERT INTO visits (
                id, tenant_id, client_id, treatment_name, starts_at,
                status, notes, anaesthesia, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, 'COMPLETED', $6, $7, $5, $5)
            """,
            [
                (
                    uuid5(NAMESPACE, f"visit-a:{index}"),
                    TENANT_A,
                    CLIENT_A_1,
                    f"Treatment A {index}",
                    BASE_TIME + timedelta(minutes=index),
                    f"Authorized visit note A {index}",
                    "none",
                )
                for index in range(101)
            ],
        )
        await connection.executemany(
            """
            INSERT INTO form_submissions (
                id, tenant_id, client_id, visit_id,
                form_template_version_id, status, answers, document_snapshot,
                submitted_at, created_at, updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5, 'SUBMITTED', $6::jsonb, $7::jsonb,
                $8, $8, $8
            )
            """,
            [
                (
                    uuid5(NAMESPACE, f"submission-a:{index}"),
                    TENANT_A,
                    CLIENT_A_1,
                    uuid5(NAMESPACE, f"visit-a:{index}"),
                    TEMPLATE_VERSION_ID,
                    json.dumps({"medical": PRIVATE_HEALTH_ANSWER}),
                    json.dumps({"signatures": {"podpisDane": SIGNATURE_PNG_DATA_URL}}),
                    BASE_TIME + timedelta(minutes=index),
                )
                for index in range(101)
            ],
        )


async def _seed_tenant_b_aggregates(connection: asyncpg.Connection) -> None:
    visit_id = uuid5(NAMESPACE, "visit-b")
    async with _tenant_transaction(connection, TENANT_B):
        await connection.execute(
            """
            INSERT INTO client_notes (
                id, tenant_id, client_id, author_membership_id,
                body, category, created_at
            )
            VALUES ($1, $2, $3, $4, $5, 'ALERGIA', $6)
            """,
            uuid5(NAMESPACE, "note-b"),
            TENANT_B,
            CLIENT_B_1,
            MEMBERSHIPS["OUTSIDER"],
            TENANT_B_PRIVATE_NOTE,
            BASE_TIME,
        )
        await connection.execute(
            """
            INSERT INTO visits (
                id, tenant_id, client_id, treatment_name, starts_at,
                status, notes, created_at, updated_at
            )
            VALUES ($1, $2, $3, 'Tenant B secret treatment', $4,
                    'COMPLETED', 'Tenant B secret visit note', $4, $4)
            """,
            visit_id,
            TENANT_B,
            CLIENT_B_1,
            BASE_TIME,
        )
        await connection.execute(
            """
            INSERT INTO form_submissions (
                id, tenant_id, client_id, visit_id,
                form_template_version_id, status, answers, document_snapshot,
                submitted_at, created_at, updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5, 'SUBMITTED', $6::jsonb, $7::jsonb,
                $8, $8, $8
            )
            """,
            uuid5(NAMESPACE, "submission-b"),
            TENANT_B,
            CLIENT_B_1,
            visit_id,
            TEMPLATE_VERSION_ID,
            json.dumps({"medical": "TENANT_B_PRIVATE_HEALTH_ANSWER"}),
            json.dumps({"signatures": {"podpisDane": SIGNATURE_PNG_DATA_URL}}),
            BASE_TIME,
        )


def _auth_headers(token: str) -> dict[str, str]:
    return {"Cookie": f"beautydocs_session={token}"}


def _assert_private_no_store(response: Response) -> None:
    assert response.headers.get("Cache-Control") == "private, no-store"


async def test_client_module_security_search_pagination_and_detail_aggregates(
    caplog: pytest.LogCaptureFixture,
) -> None:
    assert MIGRATOR_DSN is not None
    assert APP_DSN is not None
    migrator = await asyncpg.connect(MIGRATOR_DSN)
    try:
        tokens = await _seed_clients_and_aggregates(migrator)
    finally:
        await migrator.close()

    app_url = APP_DSN.replace("postgresql://", "postgresql+asyncpg://", 1)
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=SecretStr(app_url),
        database_pool_size=1,
        database_max_overflow=0,
    )
    application = create_app(settings=settings)
    database = application.state.database
    assert isinstance(database, Database)
    transport = ASGITransport(app=application)
    caplog.set_level(logging.INFO, logger="app")

    async with (
        application.router.lifespan_context(application),
        AsyncClient(
            transport=transport,
            base_url="http://app.beautydocs.pl",
        ) as client,
    ):
        list_path = "/api/v1/admin/tenants/clients-a/clients"
        detail_path = f"{list_path}/{CLIENT_A_1}"
        form_detail_path = f"{detail_path}/forms/{SUBMISSION_A_100}"
        form_signature_path = f"{form_detail_path}/signatures/podpisDane"

        unauthenticated = await client.get(list_path)
        assert unauthenticated.status_code == 401

        for role in ("OWNER", "ADMIN", "STAFF", "READ_ONLY"):
            response = await client.get(
                list_path,
                headers=_auth_headers(tokens[role]),
            )
            assert response.status_code == 200, (role, response.text)
            assert response.json()["total"] == 4
            _assert_private_no_store(response)

            detail = await client.get(
                detail_path,
                headers=_auth_headers(tokens[role]),
            )
            assert detail.status_code == 200, (role, detail.text)
            _assert_private_no_store(detail)

            form_detail = await client.get(
                form_detail_path,
                headers=_auth_headers(tokens[role]),
            )
            assert form_detail.status_code == 200, (role, form_detail.text)
            answer_values = {
                item["key"]: item["value"] for item in form_detail.json()["sections"][0]["items"]
            }
            assert answer_values["medical"] == PRIVATE_HEALTH_ANSWER
            assert answer_values["podpisDane"] == "signed"
            _assert_private_no_store(form_detail)

            form_signature = await client.get(
                form_signature_path,
                headers=_auth_headers(tokens[role]),
            )
            assert form_signature.status_code == 200, (
                role,
                form_signature.text,
            )
            assert form_signature.content == SIGNATURE_PNG_BYTES
            assert form_signature.headers["Content-Type"] == "image/png"
            assert form_signature.headers["X-Content-Type-Options"] == "nosniff"
            _assert_private_no_store(form_signature)

        denied = await client.get(
            list_path,
            headers=_auth_headers(tokens["OUTSIDER"]),
        )
        assert denied.status_code == 403
        assert denied.json()["error"]["code"] == "tenant_access_denied"

        inactive = await client.get(
            "/api/v1/admin/tenants/clients-inactive/clients",
            headers=_auth_headers(tokens["OWNER"]),
        )
        missing_tenant = await client.get(
            "/api/v1/admin/tenants/clients-missing/clients",
            headers=_auth_headers(tokens["OWNER"]),
        )
        for response in (inactive, missing_tenant):
            assert response.status_code == 404
            assert response.json()["error"]["code"] == "tenant_not_found"

        owner_headers = _auth_headers(tokens["OWNER"])
        first_page = await client.get(
            list_path,
            params={"page": 1, "pageSize": 2},
            headers=owner_headers,
        )
        second_page = await client.get(
            list_path,
            params={"page": 2, "pageSize": 2},
            headers=owner_headers,
        )
        repeat_page = await client.get(
            list_path,
            params={"page": 1, "pageSize": 2},
            headers=owner_headers,
        )
        assert first_page.status_code == second_page.status_code == 200
        assert first_page.json() == repeat_page.json()
        assert first_page.json()["total"] == 4
        assert first_page.json()["totalPages"] == 2
        assert len(first_page.json()["items"]) == 2
        assert len(second_page.json()["items"]) == 2
        assert {item["id"] for item in first_page.json()["items"]}.isdisjoint(
            {item["id"] for item in second_page.json()["items"]}
        )

        all_fields = json.dumps([first_page.json(), second_page.json()])
        assert "birthDate" not in all_fields
        assert PRIVATE_HEALTH_ANSWER not in all_fields
        assert TENANT_B_PRIVATE_EMAIL not in all_fields

        search_cases = (
            ("  \uff21\uff2e\uff2e\uff21 KOWALSKA  ", {str(CLIENT_A_1)}),
            ("500111222", {str(CLIENT_A_1)}),
            ("ANNA.PRIVATE-A@EXAMPLE.TEST", {str(CLIENT_A_1)}),
            ("%%", {str(CLIENT_A_2)}),
            ("__", {str(CLIENT_A_3)}),
        )
        for search, expected_ids in search_cases:
            response = await client.get(
                list_path,
                params={"search": search},
                headers=owner_headers,
            )
            assert response.status_code == 200, (search, response.text)
            assert {item["id"] for item in response.json()["items"]} == expected_ids

        empty_search = await client.get(
            list_path,
            params={"search": "   "},
            headers=owner_headers,
        )
        assert empty_search.status_code == 200
        assert empty_search.json()["total"] == 4

        tenant_b_search = await client.get(
            "/api/v1/admin/tenants/clients-b/clients",
            params={"search": "500111222"},
            headers=_auth_headers(tokens["OUTSIDER"]),
        )
        assert tenant_b_search.status_code == 200
        assert tenant_b_search.json()["total"] == 1
        assert tenant_b_search.json()["items"][0]["id"] == str(CLIENT_B_1)

        sensitive_invalid_search = "PRIVATE_SEARCH_VALUE_" + "X" * 70
        invalid_requests = (
            {"page": 0},
            {"page": 501},
            {"pageSize": 0},
            {"pageSize": 101},
            {"search": "x"},
            {"search": sensitive_invalid_search},
        )
        for params in invalid_requests:
            response = await client.get(
                list_path,
                params=params,
                headers=owner_headers,
            )
            assert response.status_code == 422, (params, response.text)
            assert sensitive_invalid_search not in response.text

        detail = await client.get(detail_path, headers=owner_headers)
        assert detail.status_code == 200
        payload = detail.json()
        assert payload["client"]["id"] == str(CLIENT_A_1)
        assert payload["client"]["birthDate"] == "1990-01-02"
        for collection in ("notes", "visits", "forms"):
            assert payload[collection]["total"] == 101
            assert len(payload[collection]["items"]) == 100
            assert payload[collection]["truncated"] is True
        assert payload["notes"]["items"][0]["body"] == "Authorized note A 100"
        assert payload["visits"]["items"][0]["treatmentName"] == "Treatment A 100"
        assert payload["forms"]["items"][0]["templateCode"] == "client-detail-test"
        assert payload["forms"]["items"][0]["templateName"] == ("Client detail test form")
        detail_text = json.dumps(payload, ensure_ascii=False)
        assert PRIVATE_HEALTH_ANSWER not in detail_text
        assert "answers" not in payload["forms"]["items"][0]
        assert TENANT_B_PRIVATE_NOTE not in detail_text

        form_detail = await client.get(form_detail_path, headers=owner_headers)
        assert form_detail.status_code == 200
        form_payload = form_detail.json()
        assert form_payload["client"]["id"] == str(CLIENT_A_1)
        assert form_payload["submission"]["id"] == str(SUBMISSION_A_100)
        assert form_payload["submission"]["templateName"] == ("Client detail test form")
        assert form_payload["signatureKeys"] == ["podpisDane"]
        assert form_payload["sections"] == [
            {
                "key": "consents",
                "title": "Zgody",
                "items": [
                    {
                        "key": "podpisDane",
                        "label": "Podpis pod zgodą na zabieg",
                        "kind": "signature",
                        "value": "signed",
                        "detail": None,
                    }
                ],
            },
            {
                "key": "additional",
                "title": "Pozostałe informacje",
                "items": [
                    {
                        "key": "medical",
                        "label": "medical",
                        "kind": "field",
                        "value": PRIVATE_HEALTH_ANSWER,
                        "detail": None,
                    },
                ],
            }
        ]
        assert "answers" not in form_payload
        assert "documentSnapshot" not in form_payload
        _assert_private_no_store(form_detail)

        cross_tenant = await client.get(
            f"{list_path}/{CLIENT_B_1}",
            headers={**owner_headers, "X-Request-ID": "client-not-found-test"},
        )
        missing_client = await client.get(
            f"{list_path}/{MISSING_CLIENT}",
            headers={**owner_headers, "X-Request-ID": "client-not-found-test"},
        )
        assert cross_tenant.status_code == missing_client.status_code == 404
        assert cross_tenant.json() == missing_client.json()
        assert cross_tenant.json()["error"] == {
            "code": "client_not_found",
            "message": "Client was not found",
            "request_id": "client-not-found-test",
        }
        assert str(CLIENT_B_1) not in cross_tenant.text
        assert str(MISSING_CLIENT) not in missing_client.text
        _assert_private_no_store(cross_tenant)
        _assert_private_no_store(missing_client)

        form_not_found_headers = {
            **owner_headers,
            "X-Request-ID": "client-form-not-found-test",
        }
        cross_tenant_form = await client.get(
            f"{detail_path}/forms/{SUBMISSION_B}",
            headers=form_not_found_headers,
        )
        mismatched_client_form = await client.get(
            f"{list_path}/{CLIENT_A_2}/forms/{SUBMISSION_A_100}",
            headers=form_not_found_headers,
        )
        missing_form = await client.get(
            f"{detail_path}/forms/{MISSING_SUBMISSION}",
            headers=form_not_found_headers,
        )
        for response in (
            cross_tenant_form,
            mismatched_client_form,
            missing_form,
        ):
            assert response.status_code == 404
            assert response.json()["error"] == {
                "code": "client_form_not_found",
                "message": "Client form was not found",
                "request_id": "client-form-not-found-test",
            }
            _assert_private_no_store(response)

        cross_tenant_signature = await client.get(
            f"{detail_path}/forms/{SUBMISSION_B}/signatures/podpisDane",
            headers=form_not_found_headers,
        )
        missing_signature = await client.get(
            f"{form_detail_path}/signatures/podpisRodo",
            headers=form_not_found_headers,
        )
        assert cross_tenant_signature.status_code == 404
        assert missing_signature.status_code == 404
        assert cross_tenant_signature.json() == missing_signature.json()
        assert cross_tenant_signature.json()["error"] == {
            "code": "client_form_signature_not_found",
            "message": "Client form signature was not found",
            "request_id": "client-form-not-found-test",
        }
        _assert_private_no_store(cross_tenant_signature)
        _assert_private_no_store(missing_signature)

    for private_value in (
        TENANT_A_PRIVATE_EMAIL,
        TENANT_B_PRIVATE_EMAIL,
        TENANT_B_PRIVATE_NOTE,
        PRIVATE_HEALTH_ANSWER,
        sensitive_invalid_search,
    ):
        assert private_value not in caplog.text
