from __future__ import annotations

import hashlib
import json
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]
import bcrypt
import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr

from app.core.config import Settings
from app.core.security import hash_password
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

TENANT_A = UUID("10000000-0000-0000-0000-000000000001")
TENANT_B = UUID("20000000-0000-0000-0000-000000000002")
CLIENT_A = UUID("11000000-0000-0000-0000-000000000001")
CLIENT_B = UUID("22000000-0000-0000-0000-000000000002")
TEMPLATE_ID = UUID("30000000-0000-0000-0000-000000000001")
SECOND_TEMPLATE_ID = UUID("30000000-0000-0000-0000-000000000002")
RETIRED_TEMPLATE_ID = UUID("30000000-0000-0000-0000-000000000003")
DISABLED_TEMPLATE_ID = UUID("30000000-0000-0000-0000-000000000004")
TEMPLATE_VERSION_ID = UUID("31000000-0000-0000-0000-000000000001")
AUDIT_EVENT_ID = UUID("40000000-0000-0000-0000-000000000001")
INACTIVE_TENANT = UUID("50000000-0000-0000-0000-000000000001")
USER_A = UUID("60000000-0000-0000-0000-000000000001")
USER_B = UUID("60000000-0000-0000-0000-000000000002")
MEMBERSHIP_A_OWNER = UUID("61000000-0000-0000-0000-000000000001")
MEMBERSHIP_A_READ_ONLY_B = UUID("61000000-0000-0000-0000-000000000002")
MEMBERSHIP_B_STAFF = UUID("61000000-0000-0000-0000-000000000003")
TEAM_MEMBER_A = UUID("62000000-0000-0000-0000-000000000001")
TEAM_MEMBER_B = UUID("62000000-0000-0000-0000-000000000002")


@asynccontextmanager
async def _tenant_transaction(
    connection: asyncpg.Connection, tenant_id: UUID
) -> AsyncIterator[None]:
    async with connection.transaction():
        configured_tenant = await connection.fetchval(
            "SELECT set_config('app.tenant_id', $1, true)", str(tenant_id)
        )
        assert configured_tenant == str(tenant_id)
        yield


async def _seed_initial_data(connection: asyncpg.Connection) -> None:
    await connection.executemany(
        """
        INSERT INTO tenants (
            id,
            slug,
            display_name,
            legal_name,
            nip,
            email,
            privacy_contact_email,
            phone,
            website_url,
            address_line1,
            address_line2,
            postal_code,
            city,
            country_code,
            status
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15
        )
        """,
        [
            (
                TENANT_A,
                "salon-a",
                "Salon A",
                "Salon A sp. z o.o.",
                "1234567890",
                "kontakt-a@example.test",
                "privacy-a@example.test",
                "+48111111111",
                "https://salon-a.example.test",
                "ul. Piękna 1",
                "lok. 2",
                "00-001",
                "Warszawa",
                "PL",
                "ACTIVE",
            ),
            (
                TENANT_B,
                "salon-b",
                "Salon B",
                "Salon B sp. z o.o.",
                None,
                "kontakt-b@example.test",
                "privacy-b@example.test",
                None,
                None,
                None,
                None,
                None,
                None,
                "PL",
                "ACTIVE",
            ),
            (
                INACTIVE_TENANT,
                "inactive",
                "Inactive Salon",
                "Inactive Salon sp. z o.o.",
                None,
                "inactive@example.test",
                "privacy-inactive@example.test",
                None,
                None,
                None,
                None,
                None,
                None,
                "PL",
                "SUSPENDED",
            ),
        ],
    )

    await connection.executemany(
        """
        INSERT INTO users (
            id,
            email,
            email_normalized,
            password_hash,
            display_name,
            is_active
        )
        VALUES ($1, $2, $3, $4, $5, true)
        """,
        [
            (
                USER_A,
                "owner@example.test",
                "owner@example.test",
                hash_password("owner-password"),
                "Owner A",
            ),
            (
                USER_B,
                "legacy@example.test",
                "legacy@example.test",
                bcrypt.hashpw(b"legacy-password", bcrypt.gensalt()).decode("ascii"),
                "Legacy Staff",
            ),
        ],
    )

    async with _tenant_transaction(connection, TENANT_A):
        await connection.execute(
            """
            INSERT INTO tenant_memberships (
                id, tenant_id, user_id, role, is_active
            )
            VALUES ($1, $2, $3, 'OWNER', true)
            """,
            MEMBERSHIP_A_OWNER,
            TENANT_A,
            USER_A,
        )
    async with _tenant_transaction(connection, TENANT_B):
        await connection.executemany(
            """
            INSERT INTO tenant_memberships (
                id, tenant_id, user_id, role, is_active
            )
            VALUES ($1, $2, $3, $4, true)
            """,
            [
                (
                    MEMBERSHIP_A_READ_ONLY_B,
                    TENANT_B,
                    USER_A,
                    "READ_ONLY",
                ),
                (MEMBERSHIP_B_STAFF, TENANT_B, USER_B, "STAFF"),
            ],
        )

    for (
        tenant_id,
        team_member_id,
        membership_id,
        display_name,
        is_owner,
    ) in (
        (
            TENANT_A,
            TEAM_MEMBER_A,
            MEMBERSHIP_A_OWNER,
            "Owner A",
            True,
        ),
        (
            TENANT_B,
            TEAM_MEMBER_B,
            MEMBERSHIP_B_STAFF,
            "Legacy Staff",
            False,
        ),
    ):
        async with _tenant_transaction(connection, tenant_id):
            await connection.execute(
                """
                INSERT INTO team_members (
                    id,
                    tenant_id,
                    membership_id,
                    display_name,
                    is_owner,
                    performs_treatments,
                    is_active
                )
                VALUES ($1, $2, $3, $4, $5, true, true)
                """,
                team_member_id,
                tenant_id,
                membership_id,
                display_name,
                is_owner,
            )

    for tenant_id, client_id, first_name, last_name in (
        (TENANT_A, CLIENT_A, "Anna", "SalonA"),
        (TENANT_B, CLIENT_B, "Beata", "SalonB"),
    ):
        async with _tenant_transaction(connection, tenant_id):
            await connection.execute(
                """
                INSERT INTO clients (
                    id,
                    tenant_id,
                    first_name,
                    last_name,
                    first_name_normalized,
                    last_name_normalized
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                client_id,
                tenant_id,
                first_name,
                last_name,
                first_name.lower(),
                last_name.lower(),
            )

    await connection.executemany(
        """
        INSERT INTO form_templates (id, code, name, status)
        VALUES ($1, $2, $3, $4)
        """,
        [
            (TEMPLATE_ID, "botulinum-toxin", "Toksyna botulinowa", "ACTIVE"),
            (
                SECOND_TEMPLATE_ID,
                "permanent-makeup",
                "Makijaż permanentny",
                "ACTIVE",
            ),
            (RETIRED_TEMPLATE_ID, "retired", "Wycofany formularz", "RETIRED"),
            (DISABLED_TEMPLATE_ID, "disabled", "Wyłączony formularz", "ACTIVE"),
        ],
    )
    await connection.execute(
        """
        INSERT INTO form_template_versions (
            id,
            form_template_id,
            version_number,
            schema,
            legal_content,
            content_hash,
            published_at
        )
        VALUES ($1, $2, 1, $3::jsonb, $4::jsonb, $5, now())
        """,
        TEMPLATE_VERSION_ID,
        TEMPLATE_ID,
        json.dumps({"sections": []}),
        json.dumps({"consents": []}),
        "a" * 64,
    )

    async with _tenant_transaction(connection, TENANT_A):
        await connection.executemany(
            """
            INSERT INTO tenant_form_templates (
                id,
                tenant_id,
                form_template_id,
                enabled,
                display_order
            )
            VALUES ($1, $2, $3, $4, $5)
            """,
            [
                (
                    UUID("32000000-0000-0000-0000-000000000001"),
                    TENANT_A,
                    TEMPLATE_ID,
                    True,
                    2,
                ),
                (
                    UUID("32000000-0000-0000-0000-000000000002"),
                    TENANT_A,
                    SECOND_TEMPLATE_ID,
                    True,
                    1,
                ),
                (
                    UUID("32000000-0000-0000-0000-000000000003"),
                    TENANT_A,
                    RETIRED_TEMPLATE_ID,
                    True,
                    0,
                ),
                (
                    UUID("32000000-0000-0000-0000-000000000004"),
                    TENANT_A,
                    DISABLED_TEMPLATE_ID,
                    False,
                    0,
                ),
            ],
        )


async def _visible_client_ids(connection: asyncpg.Connection, tenant_id: UUID) -> list[UUID]:
    async with _tenant_transaction(connection, tenant_id):
        rows = await connection.fetch("SELECT id FROM clients ORDER BY id")
        return [row["id"] for row in rows]


async def _visible_team_member_ids(connection: asyncpg.Connection, tenant_id: UUID) -> list[UUID]:
    async with _tenant_transaction(connection, tenant_id):
        rows = await connection.fetch("SELECT id FROM team_members ORDER BY id")
        return [row["id"] for row in rows]


async def _cross_tenant_update_count(
    connection: asyncpg.Connection, active_tenant: UUID, target_client: UUID
) -> int:
    async with _tenant_transaction(connection, active_tenant):
        result = await connection.execute(
            "UPDATE clients SET first_name = 'intruder' WHERE id = $1",
            target_client,
        )
        return int(result.rsplit(" ", maxsplit=1)[-1])


async def _assert_public_tenant_endpoint(app_sqlalchemy_url: str) -> None:
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=SecretStr(app_sqlalchemy_url),
        database_pool_size=1,
        database_max_overflow=0,
    )
    application = create_app(settings=settings)
    database = application.state.database
    assert isinstance(database, Database)
    assert database.engine is not None
    assert database.engine.url.username == "beautydocs_app_test"

    transport = ASGITransport(app=application)
    async with (
        application.router.lifespan_context(application),
        AsyncClient(
            transport=transport,
            base_url="http://beautydocs.test",
        ) as client,
    ):
        active_response = await client.get(
            "/api/v1/public/tenant",
            headers={"Host": "salon-a.beautydocs.pl"},
        )
        inactive_response = await client.get(
            "/api/v1/public/tenant",
            headers={"Host": "inactive.beautydocs.pl"},
        )
        unknown_response = await client.get(
            "/api/v1/public/tenant",
            headers={"Host": "unknown.beautydocs.pl"},
        )
        path_active_response = await client.get(
            "/api/v1/public/tenants/salon-a",
            headers={"Host": "forms.beautydocs.pl"},
        )
        path_inactive_response = await client.get(
            "/api/v1/public/tenants/inactive",
            headers={"Host": "forms.beautydocs.pl"},
        )
        path_unknown_response = await client.get(
            "/api/v1/public/tenants/unknown",
            headers={"Host": "forms.beautydocs.pl"},
        )

    assert active_response.status_code == 200
    assert path_active_response.status_code == 200
    expected_active_tenant = {
        "slug": "salon-a",
        "displayName": "Salon A",
        "legalName": "Salon A sp. z o.o.",
        "legal": {
            "nip": "1234567890",
            "address": {
                "street": "ul. Piękna 1\nlok. 2",
                "postalCode": "00-001",
                "city": "Warszawa",
                "countryCode": "PL",
            },
            "privacyContactEmail": "privacy-a@example.test",
        },
        "contact": {
            "phone": "+48111111111",
            "email": "kontakt-a@example.test",
            "websiteUrl": "https://salon-a.example.test",
        },
        "activeForms": [
            {
                "code": "permanent-makeup",
                "displayName": "Makijaż permanentny",
                "displayOrder": 1,
            },
            {
                "code": "botulinum-toxin",
                "displayName": "Toksyna botulinowa",
                "displayOrder": 2,
            },
        ],
    }
    assert active_response.json() == expected_active_tenant
    assert path_active_response.json() == expected_active_tenant
    for missing_response in (
        inactive_response,
        unknown_response,
        path_inactive_response,
        path_unknown_response,
    ):
        assert missing_response.status_code == 404
        assert missing_response.json()["error"]["code"] == "tenant_not_found"


async def _membership_tenants_for_user(connection: asyncpg.Connection, user_id: UUID) -> list[UUID]:
    async with connection.transaction():
        await connection.execute("SELECT set_config('app.user_id', $1, true)", str(user_id))
        rows = await connection.fetch("SELECT tenant_id FROM tenant_memberships ORDER BY tenant_id")
        return [row["tenant_id"] for row in rows]


async def _assert_auth_and_overview_endpoints(
    app_sqlalchemy_url: str,
    migrator: asyncpg.Connection,
    app_connection: asyncpg.Connection,
) -> None:
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=SecretStr(app_sqlalchemy_url),
        database_pool_size=1,
        database_max_overflow=0,
        auth_allowed_origins=["http://app.beautydocs.pl"],
    )
    application = create_app(settings=settings)
    transport = ASGITransport(app=application)
    origin_headers = {"Origin": "http://app.beautydocs.pl"}

    async with (
        application.router.lifespan_context(application),
        AsyncClient(
            transport=transport,
            base_url="http://app.beautydocs.pl",
        ) as client,
    ):
        missing = await client.post(
            "/api/v1/auth/login",
            headers=origin_headers,
            json={"email": "missing@example.test", "password": "wrong"},
        )
        wrong = await client.post(
            "/api/v1/auth/login",
            headers=origin_headers,
            json={"email": "owner@example.test", "password": "wrong"},
        )
        assert missing.status_code == wrong.status_code == 401
        assert missing.json()["error"]["code"] == "invalid_credentials"
        assert missing.json()["error"]["message"] == wrong.json()["error"]["message"]

        login = await client.post(
            "/api/v1/auth/login",
            headers=origin_headers,
            json={"email": "owner@example.test", "password": "owner-password"},
        )
        assert login.status_code == 200
        assert login.json() == {
            "user": {"email": "owner@example.test", "displayName": "Owner A"},
            "memberships": [
                {
                    "tenantSlug": "salon-a",
                    "tenantDisplayName": "Salon A",
                    "role": "OWNER",
                },
                {
                    "tenantSlug": "salon-b",
                    "tenantDisplayName": "Salon B",
                    "role": "READ_ONLY",
                },
            ],
        }
        raw_token = login.cookies["beautydocs_session"]
        digest = hashlib.sha256(raw_token.encode("ascii")).hexdigest()
        assert raw_token not in login.text

        async with migrator.transaction():
            await migrator.execute("SELECT set_config('app.session_digest', $1, true)", digest)
            persisted = await migrator.fetchrow(
                """
                SELECT token_digest, revoked_at
                FROM auth_sessions
                WHERE token_digest = $1
                """,
                digest,
            )
        assert persisted is not None
        assert persisted["token_digest"] == digest
        assert persisted["revoked_at"] is None

        me = await client.get("/api/v1/auth/me")
        assert me.status_code == 200
        assert me.json() == login.json()

        owner_overview = await client.get("/api/v1/admin/tenants/salon-a/overview")
        assert owner_overview.status_code == 200
        assert owner_overview.json() == {
            "tenant": {
                "slug": "salon-a",
                "displayName": "Salon A",
                "legalName": "Salon A sp. z o.o.",
            },
            "membership": {"role": "OWNER"},
            "stats": {
                "clientsCount": 1,
                "activeFormsCount": 2,
                "formSubmissionsCount": 0,
                "signedFormSubmissionsCount": 0,
            },
            "capabilities": {
                "canViewClients": True,
                "canManageClients": True,
                "canManageForms": True,
                "canManageMembers": True,
            },
        }

        read_only_overview = await client.get("/api/v1/admin/tenants/salon-b/overview")
        assert read_only_overview.status_code == 200
        assert read_only_overview.json()["membership"] == {"role": "READ_ONLY"}
        assert read_only_overview.json()["capabilities"] == {
            "canViewClients": True,
            "canManageClients": False,
            "canManageForms": False,
            "canManageMembers": False,
        }

        logout = await client.post("/api/v1/auth/logout", headers=origin_headers)
        assert logout.status_code == 204
        assert (await client.get("/api/v1/auth/me")).status_code == 401

        async with migrator.transaction():
            await migrator.execute("SELECT set_config('app.session_digest', $1, true)", digest)
            revoked_at = await migrator.fetchval(
                "SELECT revoked_at FROM auth_sessions WHERE token_digest = $1",
                digest,
            )
        assert revoked_at is not None

        legacy_login = await client.post(
            "/api/v1/auth/login",
            headers=origin_headers,
            json={"email": "legacy@example.test", "password": "legacy-password"},
        )
        assert legacy_login.status_code == 200
        assert legacy_login.json()["memberships"] == [
            {
                "tenantSlug": "salon-b",
                "tenantDisplayName": "Salon B",
                "role": "STAFF",
            }
        ]
        forbidden = await client.get("/api/v1/admin/tenants/salon-a/overview")
        assert forbidden.status_code == 403
        assert forbidden.json()["error"]["code"] == "tenant_access_denied"

    upgraded_hash = await migrator.fetchval("SELECT password_hash FROM users WHERE id = $1", USER_B)
    assert upgraded_hash.startswith("$argon2id$")

    # Both sensitive RLS tables fail closed without transaction-local context.
    assert await app_connection.fetch("SELECT id FROM tenant_memberships") == []
    assert await app_connection.fetch("SELECT id FROM auth_sessions") == []
    assert await _membership_tenants_for_user(app_connection, USER_A) == [
        TENANT_A,
        TENANT_B,
    ]
    assert await _membership_tenants_for_user(app_connection, USER_B) == [TENANT_B]


async def test_initial_migration_rls_and_immutable_triggers() -> None:
    assert MIGRATOR_DSN is not None
    assert APP_DSN is not None

    migrator = await asyncpg.connect(MIGRATOR_DSN)
    app = await asyncpg.connect(APP_DSN)
    try:
        await _seed_initial_data(migrator)

        role_state = await app.fetchrow(
            """
            SELECT
                current_user AS role_name,
                rolbypassrls,
                rolsuper
            FROM pg_roles
            WHERE rolname = current_user
            """
        )
        assert role_state is not None
        assert role_state["role_name"] == "beautydocs_app_test"
        assert role_state["rolbypassrls"] is False
        assert role_state["rolsuper"] is False

        public_privileges = await app.fetchrow(
            """
            SELECT
                has_table_privilege(current_user, 'tenants', 'SELECT') AS tenant_select,
                has_table_privilege(
                    current_user, 'tenant_form_templates', 'SELECT'
                ) AS tenant_form_select,
                has_table_privilege(
                    current_user, 'tenant_form_templates', 'INSERT'
                ) AS tenant_form_insert,
                has_table_privilege(
                    current_user, 'form_templates', 'SELECT'
                ) AS form_select,
                has_table_privilege(
                    current_user, 'form_templates', 'UPDATE'
                ) AS form_update,
                has_table_privilege(
                    current_user, 'team_members', 'SELECT'
                ) AS team_select,
                has_table_privilege(
                    current_user, 'team_members', 'INSERT'
                ) AS team_insert,
                has_table_privilege(
                    current_user, 'team_members', 'UPDATE'
                ) AS team_update,
                has_table_privilege(
                    current_user, 'team_members', 'DELETE'
                ) AS team_delete
            """
        )
        assert public_privileges is not None
        assert public_privileges["tenant_select"] is True
        assert public_privileges["tenant_form_select"] is True
        assert public_privileges["tenant_form_insert"] is False
        assert public_privileges["form_select"] is True
        assert public_privileges["form_update"] is False
        assert public_privileges["team_select"] is True
        assert public_privileges["team_insert"] is True
        assert public_privileges["team_update"] is True
        assert public_privileges["team_delete"] is False

        # A pooled connection without request context must fail closed.
        assert await app.fetch("SELECT id FROM clients") == []
        assert await app.fetch("SELECT id FROM team_members") == []

        assert await _visible_client_ids(app, TENANT_A) == [CLIENT_A]
        assert await _visible_client_ids(app, TENANT_B) == [CLIENT_B]
        assert await _visible_team_member_ids(app, TENANT_A) == [TEAM_MEMBER_A]
        assert await _visible_team_member_ids(app, TENANT_B) == [TEAM_MEMBER_B]

        # Neither tenant can target the other tenant's row for mutation.
        assert await _cross_tenant_update_count(app, TENANT_A, CLIENT_B) == 0
        assert await _cross_tenant_update_count(app, TENANT_B, CLIENT_A) == 0

        async with _tenant_transaction(app, TENANT_A):
            cross_tenant_team_update = await app.execute(
                """
                UPDATE team_members
                SET display_name = 'intruder'
                WHERE id = $1
                """,
                TEAM_MEMBER_B,
            )
        assert cross_tenant_team_update == "UPDATE 0"

        # WITH CHECK rejects both a forged insert and moving an owned row to a
        # different tenant, even though the active row was visible to UPDATE.
        with pytest.raises(asyncpg.InsufficientPrivilegeError):
            async with _tenant_transaction(app, TENANT_A):
                await app.execute(
                    """
                    INSERT INTO clients (
                        id,
                        tenant_id,
                        first_name,
                        last_name,
                        first_name_normalized,
                        last_name_normalized
                    )
                    VALUES ($1, $2, 'Forged', 'Client', 'forged', 'client')
                    """,
                    UUID("23000000-0000-0000-0000-000000000003"),
                    TENANT_B,
                )

        with pytest.raises(asyncpg.InsufficientPrivilegeError):
            async with _tenant_transaction(app, TENANT_A):
                await app.execute(
                    "UPDATE clients SET tenant_id = $1 WHERE id = $2",
                    TENANT_B,
                    CLIENT_A,
                )

        assert await _visible_client_ids(app, TENANT_A) == [CLIENT_A]
        assert await _visible_client_ids(app, TENANT_B) == [CLIENT_B]

        # Published form versions cannot be altered or removed.
        with pytest.raises(asyncpg.RaiseError, match="immutable"):
            async with app.transaction():
                await app.execute(
                    """
                    UPDATE form_template_versions
                    SET legal_content = '{}'::jsonb
                    WHERE id = $1
                    """,
                    TEMPLATE_VERSION_ID,
                )

        with pytest.raises(asyncpg.RaiseError, match="immutable"):
            async with app.transaction():
                await app.execute(
                    "DELETE FROM form_template_versions WHERE id = $1",
                    TEMPLATE_VERSION_ID,
                )

        # Audit events accept append operations in the active tenant and reject
        # every UPDATE/DELETE attempt at the database boundary.
        async with _tenant_transaction(app, TENANT_A):
            await app.execute(
                """
                INSERT INTO audit_events (
                    id,
                    tenant_id,
                    action,
                    resource_type,
                    resource_id,
                    metadata
                )
                VALUES ($1, $2, 'CLIENT_VIEWED', 'client', $3, '{}'::jsonb)
                """,
                AUDIT_EVENT_ID,
                TENANT_A,
                CLIENT_A,
            )

        with pytest.raises(asyncpg.RaiseError, match="append-only"):
            async with _tenant_transaction(app, TENANT_A):
                await app.execute(
                    "UPDATE audit_events SET action = 'TAMPERED' WHERE id = $1",
                    AUDIT_EVENT_ID,
                )

        with pytest.raises(asyncpg.RaiseError, match="append-only"):
            async with _tenant_transaction(app, TENANT_A):
                await app.execute("DELETE FROM audit_events WHERE id = $1", AUDIT_EVENT_ID)

        async with _tenant_transaction(app, TENANT_A):
            audit_action = await app.fetchval(
                "SELECT action FROM audit_events WHERE id = $1", AUDIT_EVENT_ID
            )
        assert audit_action == "CLIENT_VIEWED"

        app_sqlalchemy_url = APP_DSN.replace("postgresql://", "postgresql+asyncpg://", 1)
        await _assert_public_tenant_endpoint(app_sqlalchemy_url)
        await _assert_auth_and_overview_endpoints(
            app_sqlalchemy_url,
            migrator,
            app,
        )
    finally:
        await app.close()
        await migrator.close()
