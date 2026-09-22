"""Fail-closed staging importer for a reviewed PowderBrows migration plan.

The public entry point is deliberately dry-run by default. Database writes are
possible only with ``apply=True`` and an exact ``staging`` environment gate.
The caller must provide a connection authenticated as a dedicated migration
role; this module never falls back to the API runtime database configuration.
"""

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]
from pydantic import Field

from app.migration_tools.legacy_powderbrows import (
    MigrationPlan,
    ReconciliationReport,
    StrictModel,
    deterministic_global_uuid,
    deterministic_target_uuid,
    migration_plan_fingerprint,
)

STAGING_ENVIRONMENT = "staging"
CHANGE_TICKET_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$")
ROLE_PATTERN = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")
FINGERPRINT_PATTERN = re.compile(r"^[0-9a-f]{64}$")
FORCE_RESET_PASSWORD_SENTINEL = "!beautydocs-force-reset-required-v1"

ENTITY_KEYS = (
    "users",
    "memberships",
    "clients",
    "clientNotes",
    "visits",
    "formSubmissions",
    "auditEvents",
)
MIGRATION_TABLES = (
    "tenants",
    "users",
    "tenant_memberships",
    "clients",
    "client_notes",
    "form_templates",
    "form_template_versions",
    "visits",
    "form_submissions",
    "signature_verifications",
    "audit_events",
)


class MigrationImportError(RuntimeError):
    """Base exception whose message is safe to emit without PII."""


class MigrationGateError(MigrationImportError):
    """Raised before writes when an operator or artifact gate is not satisfied."""


class MigrationConflictError(MigrationImportError):
    """Raised when a deterministic target row exists but is not an exact match."""


class MigrationReconciliationError(MigrationImportError):
    """Raised when planned and target counts do not reconcile before commit."""


class MigrationApplyResult(StrictModel):
    status: Literal["dry_run", "applied", "noop"]
    tenant_id: UUID = Field(alias="tenantId")
    plan_fingerprint: str = Field(alias="planFingerprint")
    change_ticket: str = Field(alias="changeTicket")
    planned_counts: dict[str, int] = Field(alias="plannedCounts")
    inserted_counts: dict[str, int] = Field(alias="insertedCounts")
    skipped_counts: dict[str, int] = Field(alias="skippedCounts")


def load_migration_plan(path: Path) -> MigrationPlan:
    with path.open("r", encoding="utf-8") as plan_file:
        return MigrationPlan.model_validate(json.load(plan_file))


def load_reconciliation_report(path: Path) -> ReconciliationReport:
    with path.open("r", encoding="utf-8") as report_file:
        return ReconciliationReport.model_validate(json.load(report_file))


def _empty_counts() -> dict[str, int]:
    return {entity: 0 for entity in ENTITY_KEYS}


def _plan_counts(plan: MigrationPlan) -> dict[str, int]:
    return {
        "clients": len(plan.clients),
        "clientNotes": len(plan.client_notes),
        "formSubmissions": len(plan.form_submissions),
        "adminUsers": len(plan.users),
        "adminMemberships": len(plan.memberships),
        "visits": len(plan.visits),
        "signatureVerifications": 0,
    }


def _result_plan_counts(plan: MigrationPlan) -> dict[str, int]:
    return {
        "users": len(plan.users),
        "memberships": len(plan.memberships),
        "clients": len(plan.clients),
        "clientNotes": len(plan.client_notes),
        "visits": len(plan.visits),
        "formSubmissions": len(plan.form_submissions),
        "auditEvents": 1,
    }


def _uuid(value: Any, *, entity: str) -> UUID:
    try:
        return value if isinstance(value, UUID) else UUID(str(value))
    except (TypeError, ValueError, AttributeError) as exc:
        raise MigrationGateError(f"{entity} contains an invalid UUID") from exc


def _datetime(value: Any, *, entity: str) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (TypeError, ValueError) as exc:
            raise MigrationGateError(f"{entity} contains an invalid timestamp") from exc
    if parsed.tzinfo is None:
        raise MigrationGateError(f"{entity} contains a timezone-naive timestamp")
    return parsed.astimezone(UTC)


def _mapping_values(
    report: ReconciliationReport,
    mapping_key: str,
    entity: str,
) -> set[UUID]:
    mapping = report.mappings.get(mapping_key, {})
    return {_uuid(value, entity=entity) for value in mapping.values()}


def _validate_deterministic_ids(
    plan: MigrationPlan,
    report: ReconciliationReport,
) -> None:
    tenant_id = plan.tenant_id
    tenant_entities = (
        ("clients", "clients", "client", plan.clients),
        ("clientNotes", "clientNotes", "client-note", plan.client_notes),
        (
            "consentForms",
            "formSubmissions",
            "form-submission",
            plan.form_submissions,
        ),
        ("treatmentHistories", "visits", "visit", plan.visits),
        (
            "adminMemberships",
            "memberships",
            "membership",
            plan.memberships,
        ),
    )
    for mapping_key, entity, namespace, rows in tenant_entities:
        mapping = report.mappings.get(mapping_key, {})
        expected_ids = {
            deterministic_target_uuid(tenant_id, namespace, legacy_id) for legacy_id in mapping
        }
        mapped_ids = {_uuid(value, entity=entity) for value in mapping.values()}
        planned_ids = {_uuid(row.get("id"), entity=entity) for row in rows}
        if len(planned_ids) != len(rows) or planned_ids != mapped_ids:
            raise MigrationGateError(f"{entity} IDs do not match the report mappings")
        if mapped_ids != expected_ids:
            raise MigrationGateError(f"{entity} IDs are not deterministic")

    mapped_user_ids = _mapping_values(report, "adminUsers", "users")
    planned_user_ids = {_uuid(row.get("id"), entity="users") for row in plan.users}
    if len(planned_user_ids) != len(plan.users) or mapped_user_ids != planned_user_ids:
        raise MigrationGateError("user IDs do not match the report mappings")
    for row in plan.users:
        normalized_email = row.get("emailNormalized")
        if not isinstance(normalized_email, str):
            raise MigrationGateError("users contain an invalid normalized email")
        if _uuid(row.get("id"), entity="users") != deterministic_global_uuid(
            "user", normalized_email
        ):
            raise MigrationGateError("user IDs are not deterministic")
        if row.get("passwordAction") != "FORCE_RESET":
            raise MigrationGateError(
                "legacy password hashes are not accepted; FORCE_RESET is required"
            )

    expected_actor_id = deterministic_target_uuid(
        tenant_id, "membership", "powderbrows-migration-actor"
    )
    if plan.migration_actor_membership_id != expected_actor_id:
        raise MigrationGateError("migration actor membership ID is not deterministic")

    template_mapping = report.mappings.get("templateVersions", {})
    for row in plan.form_submissions:
        template_code = row.get("templateCode")
        if not isinstance(template_code, str) or not template_code:
            raise MigrationGateError("form submissions contain an invalid template code")
        version_id = _uuid(row.get("formTemplateVersionId"), entity="formSubmissions")
        if version_id != deterministic_global_uuid(
            "form-template-version", f"{template_code}:legacy-v1"
        ):
            raise MigrationGateError("template version IDs are not deterministic")
        if template_mapping.get(template_code) != str(version_id):
            raise MigrationGateError("template version IDs do not match report mappings")

    for entity, rows in (
        ("clients", plan.clients),
        ("memberships", plan.memberships),
        ("clientNotes", plan.client_notes),
        ("visits", plan.visits),
        ("formSubmissions", plan.form_submissions),
    ):
        if any(_uuid(row.get("tenantId"), entity=entity) != tenant_id for row in rows):
            raise MigrationGateError(f"{entity} contains a cross-tenant row")


def _validate_gates(
    *,
    plan: MigrationPlan,
    report: ReconciliationReport,
    environment: str,
    expected_plan_fingerprint: str,
    change_ticket: str,
    migration_role: str,
) -> str:
    if environment != STAGING_ENVIRONMENT:
        raise MigrationGateError("environment must be exactly staging")
    if not CHANGE_TICKET_PATTERN.fullmatch(change_ticket):
        raise MigrationGateError("change ticket has an invalid format")
    if not ROLE_PATTERN.fullmatch(migration_role):
        raise MigrationGateError("migration role has an invalid format")
    if not FINGERPRINT_PATTERN.fullmatch(expected_plan_fingerprint):
        raise MigrationGateError("expected plan fingerprint has an invalid format")
    if report.errors:
        raise MigrationGateError("reconciliation report contains errors")
    if report.tenant_id != plan.tenant_id:
        raise MigrationGateError("plan and report tenant IDs differ")

    actual_fingerprint = migration_plan_fingerprint(plan)
    if report.plan_fingerprint != actual_fingerprint:
        raise MigrationGateError("report plan fingerprint does not match the plan")
    if expected_plan_fingerprint != actual_fingerprint:
        raise MigrationGateError("expected plan fingerprint does not match the plan")

    expected_counts = _plan_counts(plan)
    if report.planned_counts != expected_counts:
        raise MigrationGateError("report planned counts do not match the plan")
    _validate_deterministic_ids(plan, report)
    return actual_fingerprint


def _canonical(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.isoformat()
        return value.astimezone(UTC).isoformat()
    if isinstance(value, Mapping):
        return {str(key): _canonical(item) for key, item in sorted(value.items())}
    if isinstance(value, list):
        return [_canonical(item) for item in value]
    return value


def _json_document(value: Any, *, entity: str) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError as exc:
            raise MigrationConflictError(f"{entity} target JSON is not a valid document") from exc
    return value


def _assert_exact(
    entity: str,
    row: Mapping[str, Any],
    expected: Mapping[str, Any],
    *,
    json_fields: frozenset[str] = frozenset(),
) -> None:
    for key, expected_value in expected.items():
        actual_value = row[key]
        if key in json_fields:
            actual_value = _json_document(actual_value, entity=entity)
        if _canonical(actual_value) != _canonical(expected_value):
            raise MigrationConflictError(f"{entity} target row differs from the reviewed plan")


async def _insert_or_exact(
    connection: asyncpg.Connection,
    *,
    entity: str,
    select_query: str,
    select_arguments: tuple[Any, ...],
    expected: Mapping[str, Any],
    insert_query: str,
    insert_arguments: tuple[Any, ...],
    json_fields: frozenset[str] = frozenset(),
) -> bool:
    existing = await connection.fetchrow(select_query, *select_arguments)
    if existing is not None:
        _assert_exact(entity, existing, expected, json_fields=json_fields)
        return False
    try:
        await connection.execute(insert_query, *insert_arguments)
    except asyncpg.PostgresError as exc:
        raise MigrationConflictError(
            f"{entity} insert was rejected by the target database"
        ) from exc
    return True


async def _verify_prerequisites(
    connection: asyncpg.Connection,
    plan: MigrationPlan,
) -> None:
    tenant = await connection.fetchrow(
        "SELECT id, status FROM tenants WHERE id = $1", plan.tenant_id
    )
    if tenant is None or tenant["status"] != "ACTIVE":
        raise MigrationGateError("the pre-provisioned staging tenant is missing or inactive")

    actor = await connection.fetchrow(
        """
        SELECT id, tenant_id, is_active
        FROM tenant_memberships
        WHERE id = $1 AND tenant_id = $2
        """,
        plan.migration_actor_membership_id,
        plan.tenant_id,
    )
    if actor is None or not actor["is_active"]:
        raise MigrationGateError(
            "the pre-provisioned migration actor membership is missing or inactive"
        )

    required_templates = {
        (
            _uuid(row["formTemplateVersionId"], entity="formSubmissions"),
            str(row["templateCode"]),
        )
        for row in plan.form_submissions
    }
    for version_id, template_code in sorted(required_templates, key=lambda item: item[1]):
        template = await connection.fetchrow(
            """
            SELECT ftv.id, ftv.published_at, ft.code, ft.status
            FROM form_template_versions AS ftv
            JOIN form_templates AS ft ON ft.id = ftv.form_template_id
            WHERE ftv.id = $1
            """,
            version_id,
        )
        if (
            template is None
            or template["code"] != template_code
            or template["published_at"] is None
            or template["status"] != "ACTIVE"
        ):
            raise MigrationGateError(
                "a required published legacy template version is missing or mismatched"
            )


async def _verify_migration_role(
    connection: asyncpg.Connection,
    migration_role: str,
) -> None:
    role = await connection.fetchrow(
        """
        SELECT rolsuper, rolbypassrls, rolcanlogin
        FROM pg_roles
        WHERE rolname = current_user
        """
    )
    if role is None or role["rolsuper"] or role["rolbypassrls"] or not role["rolcanlogin"]:
        raise MigrationGateError("migration role must be LOGIN, NOSUPERUSER, and NOBYPASSRLS")

    owned_table_count = await connection.fetchval(
        """
        SELECT count(*)
        FROM pg_class AS table_definition
        JOIN pg_namespace AS schema_definition
          ON schema_definition.oid = table_definition.relnamespace
        WHERE schema_definition.nspname = 'public'
          AND table_definition.relkind IN ('r', 'p')
          AND table_definition.relname = ANY($1::text[])
          AND pg_get_userbyid(table_definition.relowner) = $2
        """,
        list(MIGRATION_TABLES),
        migration_role,
    )
    if int(owned_table_count) != 0:
        raise MigrationGateError("migration role must not own any migration target table")


async def _import_users(
    connection: asyncpg.Connection,
    plan: MigrationPlan,
    inserted: dict[str, int],
    skipped: dict[str, int],
) -> None:
    for item in plan.users:
        user_id = _uuid(item["id"], entity="users")
        expected = {
            "id": user_id,
            "email": item["email"],
            "email_normalized": item["emailNormalized"],
            "display_name": item["displayName"],
        }
        was_inserted = await _insert_or_exact(
            connection,
            entity="users",
            select_query=(
                "SELECT id, email, email_normalized, display_name FROM users WHERE id = $1"
            ),
            select_arguments=(user_id,),
            expected=expected,
            insert_query="""
                INSERT INTO users (
                    id, email, email_normalized, password_hash, display_name, is_active
                ) VALUES ($1, $2, $3, $4, $5, false)
            """,
            insert_arguments=(
                user_id,
                item["email"],
                item["emailNormalized"],
                FORCE_RESET_PASSWORD_SENTINEL,
                item["displayName"],
            ),
        )
        (inserted if was_inserted else skipped)["users"] += 1


async def _import_memberships(
    connection: asyncpg.Connection,
    plan: MigrationPlan,
    inserted: dict[str, int],
    skipped: dict[str, int],
) -> None:
    for item in plan.memberships:
        membership_id = _uuid(item["id"], entity="memberships")
        user_id = _uuid(item["userId"], entity="memberships")
        expected = {
            "id": membership_id,
            "tenant_id": plan.tenant_id,
            "user_id": user_id,
            "role": item["role"],
            "is_active": True,
        }
        was_inserted = await _insert_or_exact(
            connection,
            entity="memberships",
            select_query="""
                SELECT id, tenant_id, user_id, role, is_active
                FROM tenant_memberships
                WHERE id = $1
            """,
            select_arguments=(membership_id,),
            expected=expected,
            insert_query="""
                INSERT INTO tenant_memberships (
                    id, tenant_id, user_id, role, is_active
                ) VALUES ($1, $2, $3, $4, true)
            """,
            insert_arguments=(membership_id, plan.tenant_id, user_id, item["role"]),
        )
        (inserted if was_inserted else skipped)["memberships"] += 1


async def _import_clients(
    connection: asyncpg.Connection,
    plan: MigrationPlan,
    inserted: dict[str, int],
    skipped: dict[str, int],
) -> None:
    for item in plan.clients:
        client_id = _uuid(item["id"], entity="clients")
        created_at = _datetime(item["createdAt"], entity="clients")
        updated_at = _datetime(item["updatedAt"], entity="clients")
        expected = {
            "id": client_id,
            "tenant_id": plan.tenant_id,
            "first_name": item["firstName"],
            "last_name": item["lastName"],
            "first_name_normalized": item["firstNameNormalized"],
            "last_name_normalized": item["lastNameNormalized"],
            "phone": item["phone"],
            "phone_normalized": item["phoneNormalized"],
            "email": None,
            "birth_date": None,
            "archived_at": None,
            "created_at": created_at,
            "updated_at": updated_at,
        }
        was_inserted = await _insert_or_exact(
            connection,
            entity="clients",
            select_query="""
                SELECT id, tenant_id, first_name, last_name,
                       first_name_normalized, last_name_normalized,
                       phone, phone_normalized, email, birth_date, archived_at,
                       created_at, updated_at
                FROM clients WHERE id = $1
            """,
            select_arguments=(client_id,),
            expected=expected,
            insert_query="""
                INSERT INTO clients (
                    id, tenant_id, first_name, last_name,
                    first_name_normalized, last_name_normalized,
                    phone, phone_normalized, email, birth_date, archived_at,
                    created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8,
                    NULL, NULL, NULL, $9, $10
                )
            """,
            insert_arguments=(
                client_id,
                plan.tenant_id,
                item["firstName"],
                item["lastName"],
                item["firstNameNormalized"],
                item["lastNameNormalized"],
                item["phone"],
                item["phoneNormalized"],
                created_at,
                updated_at,
            ),
        )
        (inserted if was_inserted else skipped)["clients"] += 1


async def _import_visits(
    connection: asyncpg.Connection,
    plan: MigrationPlan,
    inserted: dict[str, int],
    skipped: dict[str, int],
) -> None:
    for item in plan.visits:
        visit_id = _uuid(item["id"], entity="visits")
        client_id = _uuid(item["clientId"], entity="visits")
        starts_at = _datetime(item["startsAt"], entity="visits")
        expected = {
            "id": visit_id,
            "tenant_id": plan.tenant_id,
            "client_id": client_id,
            "staff_membership_id": None,
            "form_template_id": None,
            "treatment_name": item["treatmentName"],
            "starts_at": starts_at,
            "ends_at": None,
            "status": item["status"],
            "notes": item["notes"],
            "anaesthesia": item["anaesthesia"],
        }
        was_inserted = await _insert_or_exact(
            connection,
            entity="visits",
            select_query="""
                SELECT id, tenant_id, client_id, staff_membership_id,
                       form_template_id, treatment_name, starts_at, ends_at,
                       status, notes, anaesthesia
                FROM visits WHERE id = $1
            """,
            select_arguments=(visit_id,),
            expected=expected,
            insert_query="""
                INSERT INTO visits (
                    id, tenant_id, client_id, staff_membership_id,
                    form_template_id, treatment_name, starts_at, ends_at,
                    status, notes, anaesthesia
                ) VALUES ($1, $2, $3, NULL, NULL, $4, $5, NULL, $6, $7, $8)
            """,
            insert_arguments=(
                visit_id,
                plan.tenant_id,
                client_id,
                item["treatmentName"],
                starts_at,
                item["status"],
                item["notes"],
                item["anaesthesia"],
            ),
        )
        (inserted if was_inserted else skipped)["visits"] += 1


async def _import_notes(
    connection: asyncpg.Connection,
    plan: MigrationPlan,
    inserted: dict[str, int],
    skipped: dict[str, int],
) -> None:
    for item in plan.client_notes:
        note_id = _uuid(item["id"], entity="clientNotes")
        client_id = _uuid(item["clientId"], entity="clientNotes")
        actor_id = _uuid(item["authorMembershipId"], entity="clientNotes")
        if actor_id != plan.migration_actor_membership_id:
            raise MigrationGateError("client notes contain an unexpected author")
        created_at = _datetime(item["createdAt"], entity="clientNotes")
        edited_at = (
            _datetime(item["editedAt"], entity="clientNotes")
            if item["editedAt"] is not None
            else None
        )
        expected = {
            "id": note_id,
            "tenant_id": plan.tenant_id,
            "client_id": client_id,
            "author_membership_id": actor_id,
            "body": item["body"],
            "category": item["category"],
            "created_at": created_at,
            "edited_at": edited_at,
        }
        was_inserted = await _insert_or_exact(
            connection,
            entity="clientNotes",
            select_query="""
                SELECT id, tenant_id, client_id, author_membership_id,
                       body, category, created_at, edited_at
                FROM client_notes WHERE id = $1
            """,
            select_arguments=(note_id,),
            expected=expected,
            insert_query="""
                INSERT INTO client_notes (
                    id, tenant_id, client_id, author_membership_id,
                    body, category, created_at, edited_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            insert_arguments=(
                note_id,
                plan.tenant_id,
                client_id,
                actor_id,
                item["body"],
                item["category"],
                created_at,
                edited_at,
            ),
        )
        (inserted if was_inserted else skipped)["clientNotes"] += 1


async def _import_submissions(
    connection: asyncpg.Connection,
    plan: MigrationPlan,
    inserted: dict[str, int],
    skipped: dict[str, int],
) -> None:
    for item in plan.form_submissions:
        submission_id = _uuid(item["id"], entity="formSubmissions")
        client_id = _uuid(item["clientId"], entity="formSubmissions")
        visit_id = (
            _uuid(item["visitId"], entity="formSubmissions")
            if item["visitId"] is not None
            else None
        )
        template_version_id = _uuid(item["formTemplateVersionId"], entity="formSubmissions")
        submitted_at = _datetime(item["submittedAt"], entity="formSubmissions")
        signed_at = (
            _datetime(item["signedAt"], entity="formSubmissions")
            if item["signedAt"] is not None
            else None
        )
        expected = {
            "id": submission_id,
            "tenant_id": plan.tenant_id,
            "client_id": client_id,
            "visit_id": visit_id,
            "form_template_version_id": template_version_id,
            "submitted_by_membership_id": None,
            "status": item["status"],
            "answers": item["answers"],
            "document_snapshot": item["documentSnapshot"],
            "document_hash": item["documentHash"],
            "submitted_at": submitted_at,
            "signed_at": signed_at,
            "voided_at": None,
            "created_at": submitted_at,
            "updated_at": submitted_at,
        }
        was_inserted = await _insert_or_exact(
            connection,
            entity="formSubmissions",
            select_query="""
                SELECT id, tenant_id, client_id, visit_id,
                       form_template_version_id, submitted_by_membership_id,
                       status, answers, document_snapshot, document_hash,
                       submitted_at, signed_at, voided_at, created_at, updated_at
                FROM form_submissions WHERE id = $1
            """,
            select_arguments=(submission_id,),
            expected=expected,
            insert_query="""
                INSERT INTO form_submissions (
                    id, tenant_id, client_id, visit_id,
                    form_template_version_id, submitted_by_membership_id,
                    status, answers, document_snapshot, document_hash,
                    submitted_at, signed_at, voided_at, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, NULL, $6, $7::jsonb,
                    $8::jsonb, $9, $10, $11, NULL, $10, $10
                )
            """,
            insert_arguments=(
                submission_id,
                plan.tenant_id,
                client_id,
                visit_id,
                template_version_id,
                item["status"],
                json.dumps(item["answers"], ensure_ascii=False, sort_keys=True),
                (
                    json.dumps(
                        item["documentSnapshot"],
                        ensure_ascii=False,
                        sort_keys=True,
                    )
                    if item["documentSnapshot"] is not None
                    else None
                ),
                item["documentHash"],
                submitted_at,
                signed_at,
            ),
            json_fields=frozenset({"answers", "document_snapshot"}),
        )
        (inserted if was_inserted else skipped)["formSubmissions"] += 1


async def _reconcile_target_counts(
    connection: asyncpg.Connection,
    plan: MigrationPlan,
) -> None:
    checks = (
        ("users", None, [_uuid(row["id"], entity="users") for row in plan.users]),
        (
            "tenant_memberships",
            plan.tenant_id,
            [_uuid(row["id"], entity="memberships") for row in plan.memberships],
        ),
        (
            "clients",
            plan.tenant_id,
            [_uuid(row["id"], entity="clients") for row in plan.clients],
        ),
        (
            "client_notes",
            plan.tenant_id,
            [_uuid(row["id"], entity="clientNotes") for row in plan.client_notes],
        ),
        (
            "visits",
            plan.tenant_id,
            [_uuid(row["id"], entity="visits") for row in plan.visits],
        ),
        (
            "form_submissions",
            plan.tenant_id,
            [_uuid(row["id"], entity="formSubmissions") for row in plan.form_submissions],
        ),
    )
    allowed_tables = {
        "users",
        "tenant_memberships",
        "clients",
        "client_notes",
        "visits",
        "form_submissions",
    }
    for table_name, tenant_id, target_ids in checks:
        if table_name not in allowed_tables:  # pragma: no cover - internal invariant
            raise MigrationReconciliationError("invalid reconciliation table")
        if tenant_id is None:
            count = await connection.fetchval(
                f"SELECT count(*) FROM {table_name} WHERE id = ANY($1::uuid[])",
                target_ids,
            )
        else:
            count = await connection.fetchval(
                f"""
                SELECT count(*) FROM {table_name}
                WHERE tenant_id = $1 AND id = ANY($2::uuid[])
                """,
                tenant_id,
                target_ids,
            )
        if int(count) != len(target_ids):
            raise MigrationReconciliationError(
                f"target count reconciliation failed for {table_name}"
            )

    submission_ids = [_uuid(row["id"], entity="formSubmissions") for row in plan.form_submissions]
    signature_count = await connection.fetchval(
        """
        SELECT count(*) FROM signature_verifications
        WHERE tenant_id = $1
          AND form_submission_id = ANY($2::uuid[])
        """,
        plan.tenant_id,
        submission_ids,
    )
    if int(signature_count) != 0:
        raise MigrationReconciliationError(
            "legacy submissions unexpectedly have signature verification rows"
        )


async def _write_audit_event(
    connection: asyncpg.Connection,
    *,
    plan: MigrationPlan,
    report: ReconciliationReport,
    fingerprint: str,
    change_ticket: str,
    inserted: dict[str, int],
    skipped: dict[str, int],
) -> None:
    audit_id = deterministic_target_uuid(
        plan.tenant_id,
        "audit-event",
        f"{fingerprint}:{change_ticket}",
    )
    metadata = {
        "schemaVersion": "beautydocs-powderbrows-apply/v1",
        "exportSchemaVersion": report.export_schema_version,
        "planFingerprint": fingerprint,
        "changeTicket": change_ticket,
        "plannedCounts": report.planned_counts,
    }
    expected = {
        "id": audit_id,
        "tenant_id": plan.tenant_id,
        "actor_membership_id": plan.migration_actor_membership_id,
        "action": "legacy_migration.applied",
        "resource_type": "migration_plan",
        "resource_id": None,
        "metadata": metadata,
        "request_id": change_ticket,
        "ip_hash": None,
        "user_agent": None,
    }
    was_inserted = await _insert_or_exact(
        connection,
        entity="auditEvents",
        select_query="""
            SELECT id, tenant_id, actor_membership_id, action,
                   resource_type, resource_id, metadata, request_id,
                   ip_hash, user_agent
            FROM audit_events WHERE id = $1
        """,
        select_arguments=(audit_id,),
        expected=expected,
        insert_query="""
            INSERT INTO audit_events (
                id, tenant_id, actor_membership_id, action,
                resource_type, resource_id, metadata, request_id,
                ip_hash, user_agent
            ) VALUES ($1, $2, $3, $4, $5, NULL, $6::jsonb, $7, NULL, NULL)
        """,
        insert_arguments=(
            audit_id,
            plan.tenant_id,
            plan.migration_actor_membership_id,
            "legacy_migration.applied",
            "migration_plan",
            json.dumps(metadata, sort_keys=True, separators=(",", ":")),
            change_ticket,
        ),
        json_fields=frozenset({"metadata"}),
    )
    (inserted if was_inserted else skipped)["auditEvents"] += 1


async def apply_migration_plan(
    connection: asyncpg.Connection | None,
    *,
    plan: MigrationPlan,
    report: ReconciliationReport,
    environment: str,
    expected_plan_fingerprint: str,
    change_ticket: str,
    apply: bool = False,
    migration_role: str,
) -> MigrationApplyResult:
    """Validate or atomically apply a plan to staging using exact-match reruns."""

    fingerprint = _validate_gates(
        plan=plan,
        report=report,
        environment=environment,
        expected_plan_fingerprint=expected_plan_fingerprint,
        change_ticket=change_ticket,
        migration_role=migration_role,
    )
    planned_counts = _result_plan_counts(plan)
    inserted = _empty_counts()
    skipped = _empty_counts()
    if not apply:
        return MigrationApplyResult(
            status="dry_run",
            tenant_id=plan.tenant_id,
            plan_fingerprint=fingerprint,
            change_ticket=change_ticket,
            planned_counts=planned_counts,
            inserted_counts=inserted,
            skipped_counts=skipped,
        )
    if connection is None:
        raise MigrationGateError("apply requires a dedicated staging migration connection")

    try:
        async with connection.transaction(isolation="serializable"):
            current_role = await connection.fetchval("SELECT current_user")
            if current_role != migration_role:
                raise MigrationGateError("database current_user is not the declared migration role")
            await _verify_migration_role(connection, migration_role)
            read_only = await connection.fetchval("SELECT current_setting('transaction_read_only')")
            if read_only != "off":
                raise MigrationGateError("migration transaction is unexpectedly read-only")

            await connection.fetchval(
                "SELECT set_config('app.tenant_id', $1, true)",
                str(plan.tenant_id),
            )
            context_tenant = await connection.fetchval(
                "SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid"
            )
            if context_tenant != plan.tenant_id:
                raise MigrationGateError("transaction-local tenant context was not established")

            await _verify_prerequisites(connection, plan)
            await _import_users(connection, plan, inserted, skipped)
            await _import_memberships(connection, plan, inserted, skipped)
            await _import_clients(connection, plan, inserted, skipped)
            await _import_visits(connection, plan, inserted, skipped)
            await _import_notes(connection, plan, inserted, skipped)
            await _import_submissions(connection, plan, inserted, skipped)
            await _reconcile_target_counts(connection, plan)
            await _write_audit_event(
                connection,
                plan=plan,
                report=report,
                fingerprint=fingerprint,
                change_ticket=change_ticket,
                inserted=inserted,
                skipped=skipped,
            )
    except MigrationImportError:
        raise
    except asyncpg.PostgresError as exc:
        raise MigrationImportError(
            "target database operation failed; transaction rolled back"
        ) from exc

    status: Literal["applied", "noop"] = "applied" if any(inserted.values()) else "noop"
    return MigrationApplyResult(
        status=status,
        tenant_id=plan.tenant_id,
        plan_fingerprint=fingerprint,
        change_ticket=change_ticket,
        planned_counts=planned_counts,
        inserted_counts=inserted,
        skipped_counts=skipped,
    )
