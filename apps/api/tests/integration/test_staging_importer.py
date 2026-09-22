from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid5

import asyncpg  # type: ignore[import-untyped]
import pytest

from app.core.security import hash_password
from app.migration_tools.legacy_importer import (
    MigrationConflictError,
    MigrationGateError,
    apply_migration_plan,
)
from app.migration_tools.legacy_powderbrows import (
    MIGRATION_NAMESPACE,
    LegacyExport,
    PlannerResult,
    build_migration_plan,
    deterministic_global_uuid,
)

MIGRATOR_DSN = os.getenv("BEAUTYDOCS_INTEGRATION_MIGRATOR_DSN")
APP_DSN = os.getenv("BEAUTYDOCS_INTEGRATION_APP_DSN")
IMPORTER_DSN = os.getenv("BEAUTYDOCS_INTEGRATION_IMPORTER_DSN")

pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(
        not MIGRATOR_DSN or not APP_DSN or not IMPORTER_DSN,
        reason="run through scripts/run_postgres_integration_tests.sh",
    ),
]

FIXTURE_PATH = (
    Path(__file__).resolve().parents[1] / "fixtures" / "legacy_powderbrows_v1.synthetic.json"
)
OWNER_ADMIN_LEGACY_ID = "40000000-0000-0000-0000-000000000001"
IMPORTER_ROLE = "beautydocs_importer_test"
CHANGE_TICKET = "BD-1234"
APPLY_TENANT = UUID("aa000000-0000-0000-0000-000000000001")
CONFLICT_TENANT = UUID("cc000000-0000-0000-0000-000000000001")
OTHER_TENANT = UUID("dd000000-0000-0000-0000-000000000001")

TENANT_TABLES = (
    "clients",
    "tenant_memberships",
    "client_notes",
    "visits",
    "form_submissions",
    "audit_events",
)


def _datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _plan_for_tenant(tenant_id: UUID) -> PlannerResult:
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    payload["records"]["adminUsers"][0]["email"] = f"admin-{tenant_id.hex}@example.test"
    legacy_export = LegacyExport.model_validate(payload)
    result = build_migration_plan(
        legacy_export,
        tenant_id,
        owner_admin_legacy_id=OWNER_ADMIN_LEGACY_ID,
    )
    assert result.report.errors == []
    return result


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


async def _seed_tenant_prerequisites(
    connection: asyncpg.Connection,
    planned: PlannerResult,
    *,
    slug: str,
) -> None:
    tenant_id = planned.plan.tenant_id
    actor_user_id = uuid5(MIGRATION_NAMESPACE, f"test-actor:{tenant_id}")

    await connection.execute(
        """
        INSERT INTO tenants (
            id, slug, display_name, legal_name, email,
            privacy_contact_email, status
        )
        VALUES ($1, $2, $3, $3, $4, $4, 'ACTIVE')
        """,
        tenant_id,
        slug,
        f"Synthetic {slug}",
        f"privacy-{slug}@example.test",
    )
    await connection.execute(
        """
        INSERT INTO users (
            id, email, email_normalized, password_hash, display_name, is_active
        )
        VALUES ($1, $2, $2, $3, 'Synthetic migration actor', true)
        """,
        actor_user_id,
        f"migration-actor-{tenant_id.hex}@example.test",
        hash_password(f"synthetic-actor-{tenant_id}"),
    )

    async with _tenant_transaction(connection, tenant_id):
        await connection.execute(
            """
            INSERT INTO tenant_memberships (
                id, tenant_id, user_id, role, is_active
            )
            VALUES ($1, $2, $3, 'ADMIN', true)
            """,
            planned.plan.migration_actor_membership_id,
            tenant_id,
            actor_user_id,
        )

    template_codes_to_version_ids = {
        submission["templateCode"]: UUID(submission["formTemplateVersionId"])
        for submission in planned.plan.form_submissions
    }
    for template_code, version_id in template_codes_to_version_ids.items():
        template_id = deterministic_global_uuid("form-template", template_code)
        await connection.execute(
            """
            INSERT INTO form_templates (id, code, name, status)
            VALUES ($1, $2, $3, 'ACTIVE')
            ON CONFLICT (code) DO NOTHING
            """,
            template_id,
            template_code,
            f"Synthetic {template_code}",
        )
        await connection.execute(
            """
            INSERT INTO form_template_versions (
                id, form_template_id, version_number, schema,
                legal_content, content_hash, published_at
            )
            VALUES ($1, $2, 1, '{}'::jsonb, '{}'::jsonb, $3, now())
            ON CONFLICT (id) DO NOTHING
            """,
            version_id,
            template_id,
            "a" * 64,
        )


async def _tenant_counts(
    connection: asyncpg.Connection,
    tenant_id: UUID,
) -> dict[str, int]:
    async with _tenant_transaction(connection, tenant_id):
        return {
            table: await connection.fetchval(f"SELECT count(*) FROM {table}")
            for table in TENANT_TABLES
        }


async def _planned_user_count(
    connection: asyncpg.Connection,
    planned: PlannerResult,
) -> int:
    user_ids = [UUID(user["id"]) for user in planned.plan.users]
    count = await connection.fetchval(
        "SELECT count(*) FROM users WHERE id = ANY($1::uuid[])", user_ids
    )
    return int(count)


async def _apply(
    connection: asyncpg.Connection,
    planned: PlannerResult,
    *,
    migration_role: str = IMPORTER_ROLE,
) -> Any:
    return await apply_migration_plan(
        connection,
        plan=planned.plan,
        report=planned.report,
        environment="staging",
        expected_plan_fingerprint=planned.report.plan_fingerprint,
        change_ticket=CHANGE_TICKET,
        apply=True,
        migration_role=migration_role,
    )


async def test_staging_apply_reconciles_is_idempotent_and_keeps_rls() -> None:
    assert MIGRATOR_DSN is not None
    assert APP_DSN is not None
    assert IMPORTER_DSN is not None
    planned = _plan_for_tenant(APPLY_TENANT)

    migrator = await asyncpg.connect(MIGRATOR_DSN)
    importer = await asyncpg.connect(IMPORTER_DSN)
    app = await asyncpg.connect(APP_DSN)
    try:
        await _seed_tenant_prerequisites(migrator, planned, slug="import-success")
        await migrator.execute(
            """
            INSERT INTO tenants (
                id, slug, display_name, legal_name, email,
                privacy_contact_email, status
            )
            VALUES (
                $1, 'import-other', 'Synthetic other', 'Synthetic other',
                'other@example.test', 'privacy-other@example.test', 'ACTIVE'
            )
            """,
            OTHER_TENANT,
        )

        role_state = await importer.fetchrow(
            """
            SELECT current_user AS role_name, rolbypassrls, rolsuper
            FROM pg_roles
            WHERE rolname = current_user
            """
        )
        assert role_state is not None
        assert role_state["role_name"] == IMPORTER_ROLE
        assert role_state["rolbypassrls"] is False
        assert role_state["rolsuper"] is False
        for table in (
            "users",
            "tenant_memberships",
            "clients",
            "client_notes",
            "visits",
            "form_submissions",
            "audit_events",
        ):
            assert not await importer.fetchval(
                "SELECT has_table_privilege(current_user, $1, 'UPDATE')",
                table,
            )
            assert not await importer.fetchval(
                "SELECT has_table_privilege(current_user, $1, 'DELETE')",
                table,
            )

        result = await _apply(importer, planned)

        assert result.status == "applied"
        assert result.tenant_id == APPLY_TENANT
        assert result.plan_fingerprint == planned.report.plan_fingerprint
        assert result.change_ticket == CHANGE_TICKET
        assert await _planned_user_count(migrator, planned) == 1
        assert await _tenant_counts(importer, APPLY_TENANT) == {
            "clients": 2,
            "tenant_memberships": 2,  # migration actor plus imported OWNER
            "client_notes": 1,
            "visits": 1,
            "form_submissions": 1,
            "audit_events": 1,
        }

        # A byte-for-byte equivalent rerun is a no-op and cannot duplicate rows.
        rerun = await _apply(importer, planned)
        assert rerun.status == "noop"
        assert await _planned_user_count(migrator, planned) == 1
        assert await _tenant_counts(importer, APPLY_TENANT) == {
            "clients": 2,
            "tenant_memberships": 2,
            "client_notes": 1,
            "visits": 1,
            "form_submissions": 1,
            "audit_events": 1,
        }

        # Transaction-local context disappears after commit and cannot leak to
        # the next tenant on a reused migration connection.
        assert await importer.fetch("SELECT id FROM clients") == []
        assert await importer.fetch("SELECT id FROM tenant_memberships") == []
        async with _tenant_transaction(importer, OTHER_TENANT):
            assert await importer.fetch("SELECT id FROM clients") == []
            assert await importer.fetch("SELECT id FROM tenant_memberships") == []
        async with _tenant_transaction(app, APPLY_TENANT):
            assert await app.fetchval("SELECT count(*) FROM clients") == 2
        async with _tenant_transaction(app, OTHER_TENANT):
            assert await app.fetchval("SELECT count(*) FROM clients") == 0

        # Audit and public result metadata must not contain source PII, health
        # answers, note bodies, or copied source records.
        async with _tenant_transaction(importer, APPLY_TENANT):
            audit = await importer.fetchrow(
                """
                SELECT action, resource_type, resource_id, metadata
                FROM audit_events
                """
            )
        assert audit is not None
        audit_text = json.dumps(dict(audit), ensure_ascii=False, default=str)
        result_text = json.dumps(
            result.model_dump(mode="json", by_alias=True),
            ensure_ascii=False,
            default=str,
        )
        for direct_pii in (
            "Anna Testowa",
            "Beata Przykład",
            "anna.synthetic@example.test",
            "48111222333",
            "ul. Testowa 1",
            "Syntetyczna notatka testowa",
            "syntheticQuestion",
        ):
            assert direct_pii not in audit_text
            assert direct_pii not in result_text

        before_wrong_role = await _tenant_counts(importer, APPLY_TENANT)
        with pytest.raises(MigrationGateError):
            await _apply(
                importer,
                planned,
                migration_role="beautydocs_migrator_test",
            )
        assert await _tenant_counts(importer, APPLY_TENANT) == before_wrong_role
    finally:
        await app.close()
        await importer.close()
        await migrator.close()


async def _seed_late_conflict(
    connection: asyncpg.Connection,
    planned: PlannerResult,
) -> None:
    client = planned.plan.clients[0]
    visit = planned.plan.visits[0]
    submission = planned.plan.form_submissions[0]

    async with _tenant_transaction(connection, planned.plan.tenant_id):
        await connection.execute(
            """
            INSERT INTO clients (
                id, tenant_id, first_name, last_name,
                first_name_normalized, last_name_normalized,
                phone, phone_normalized, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """,
            UUID(client["id"]),
            UUID(client["tenantId"]),
            client["firstName"],
            client["lastName"],
            client["firstNameNormalized"],
            client["lastNameNormalized"],
            client["phone"],
            client["phoneNormalized"],
            _datetime(client["createdAt"]),
            _datetime(client["updatedAt"]),
        )
        await connection.execute(
            """
            INSERT INTO visits (
                id, tenant_id, client_id, treatment_name, starts_at,
                status, notes, anaesthesia
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            UUID(visit["id"]),
            UUID(visit["tenantId"]),
            UUID(visit["clientId"]),
            visit["treatmentName"],
            _datetime(visit["startsAt"]),
            visit["status"],
            visit["notes"],
            visit["anaesthesia"],
        )
        await connection.execute(
            """
            INSERT INTO form_submissions (
                id, tenant_id, client_id, visit_id,
                form_template_version_id, status, answers, submitted_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
            """,
            UUID(submission["id"]),
            UUID(submission["tenantId"]),
            UUID(submission["clientId"]),
            UUID(submission["visitId"]),
            UUID(submission["formTemplateVersionId"]),
            submission["status"],
            json.dumps({"syntheticConflict": True}),
            _datetime(submission["submittedAt"]),
        )


async def test_conflicting_target_row_causes_complete_transaction_rollback() -> None:
    assert MIGRATOR_DSN is not None
    assert IMPORTER_DSN is not None
    planned = _plan_for_tenant(CONFLICT_TENANT)

    migrator = await asyncpg.connect(MIGRATOR_DSN)
    importer = await asyncpg.connect(IMPORTER_DSN)
    try:
        await _seed_tenant_prerequisites(migrator, planned, slug="import-conflict")
        await _seed_late_conflict(migrator, planned)
        before = await _tenant_counts(importer, CONFLICT_TENANT)
        users_before = await _planned_user_count(migrator, planned)

        with pytest.raises(MigrationConflictError):
            await _apply(importer, planned)

        assert await _tenant_counts(importer, CONFLICT_TENANT) == before
        assert await _planned_user_count(migrator, planned) == users_before
        assert before == {
            "clients": 1,
            "tenant_memberships": 1,
            "client_notes": 0,
            "visits": 1,
            "form_submissions": 1,
            "audit_events": 0,
        }
        async with _tenant_transaction(importer, CONFLICT_TENANT):
            answers = await importer.fetchval("SELECT answers FROM form_submissions")
        assert json.loads(answers) == {"syntheticConflict": True}
    finally:
        await importer.close()
        await migrator.close()
