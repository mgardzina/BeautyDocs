from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import UUID

import pytest

from app.migration_tools.legacy_importer import (
    MigrationGateError,
    apply_migration_plan,
)
from app.migration_tools.legacy_powderbrows import (
    LegacyExport,
    MigrationIssue,
    MigrationPlan,
    PlannerResult,
    ReconciliationReport,
    build_migration_plan,
    load_legacy_export,
)

FIXTURE_PATH = (
    Path(__file__).resolve().parents[1] / "fixtures" / "legacy_powderbrows_v1.synthetic.json"
)
TENANT_ID = UUID("aaaaaaaa-0000-0000-0000-000000000001")
OTHER_TENANT_ID = UUID("bbbbbbbb-0000-0000-0000-000000000002")
OWNER_ADMIN_LEGACY_ID = "40000000-0000-0000-0000-000000000001"
CHANGE_TICKET = "BD-1234"
MIGRATION_ROLE = "beautydocs_importer_test"


class _NoSqlConnection:
    """Fail loudly if an offline gate touches the database."""

    def __getattr__(self, name: str) -> Any:
        raise AssertionError(f"offline migration gate attempted SQL via {name}")


def _planner_result() -> PlannerResult:
    legacy_export = load_legacy_export(FIXTURE_PATH)
    return build_migration_plan(
        legacy_export,
        TENANT_ID,
        owner_admin_legacy_id=OWNER_ADMIN_LEGACY_ID,
    )


async def _apply_offline(
    *,
    plan: MigrationPlan,
    report: ReconciliationReport,
    environment: str = "staging",
    expected_plan_fingerprint: str | None = None,
    change_ticket: str = CHANGE_TICKET,
    apply: bool = True,
) -> Any:
    return await apply_migration_plan(
        _NoSqlConnection(),
        plan=plan,
        report=report,
        environment=environment,
        expected_plan_fingerprint=(expected_plan_fingerprint or report.plan_fingerprint),
        change_ticket=change_ticket,
        apply=apply,
        migration_role=MIGRATION_ROLE,
    )


@pytest.mark.asyncio
async def test_dry_run_validates_a_plan_without_touching_postgres() -> None:
    planned = _planner_result()

    result = await _apply_offline(
        plan=planned.plan,
        report=planned.report,
        apply=False,
    )

    assert result.status == "dry_run"
    assert result.tenant_id == TENANT_ID
    assert result.plan_fingerprint == planned.report.plan_fingerprint
    assert result.change_ticket == CHANGE_TICKET

    # A dry-run result is operational metadata, never a copy of source records.
    serialized_result = json.dumps(
        result.model_dump(mode="json", by_alias=True),
        ensure_ascii=False,
        sort_keys=True,
    )
    for direct_pii in (
        "Anna Testowa",
        "Beata Przykład",
        "anna.synthetic@example.test",
        "48111222333",
        "Syntetyczna notatka testowa",
    ):
        assert direct_pii not in serialized_result


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("environment", "change_ticket"),
    [
        ("production", CHANGE_TICKET),
        ("prod", CHANGE_TICKET),
        ("development", CHANGE_TICKET),
        ("staging", ""),
        ("staging", "not a ticket"),
    ],
)
async def test_apply_rejects_wrong_environment_or_change_ticket_before_sql(
    environment: str,
    change_ticket: str,
) -> None:
    planned = _planner_result()

    with pytest.raises(MigrationGateError):
        await _apply_offline(
            plan=planned.plan,
            report=planned.report,
            environment=environment,
            change_ticket=change_ticket,
        )


@pytest.mark.asyncio
async def test_apply_rejects_report_errors_before_sql() -> None:
    planned = _planner_result()
    report_with_error = planned.report.model_copy(
        update={
            "errors": [
                MigrationIssue(
                    code="synthetic_reconciliation_error",
                    entity="Client",
                    message="Synthetic non-PII test error",
                )
            ]
        }
    )

    with pytest.raises(MigrationGateError):
        await _apply_offline(plan=planned.plan, report=report_with_error)


@pytest.mark.asyncio
async def test_apply_rejects_tenant_and_count_mismatches_before_sql() -> None:
    planned = _planner_result()
    wrong_tenant_report = planned.report.model_copy(update={"tenant_id": OTHER_TENANT_ID})
    mismatched_counts = dict(planned.report.planned_counts)
    mismatched_counts["clients"] += 1
    wrong_counts_report = planned.report.model_copy(update={"planned_counts": mismatched_counts})

    with pytest.raises(MigrationGateError):
        await _apply_offline(plan=planned.plan, report=wrong_tenant_report)
    with pytest.raises(MigrationGateError):
        await _apply_offline(plan=planned.plan, report=wrong_counts_report)


@pytest.mark.asyncio
async def test_apply_rejects_expected_or_recomputed_fingerprint_mismatch() -> None:
    planned = _planner_result()

    with pytest.raises(MigrationGateError):
        await _apply_offline(
            plan=planned.plan,
            report=planned.report,
            expected_plan_fingerprint="0" * 64,
        )

    tampered_clients = [dict(client) for client in planned.plan.clients]
    tampered_clients[0]["firstName"] = "Tampered"
    tampered_plan = planned.plan.model_copy(update={"clients": tampered_clients})

    with pytest.raises(MigrationGateError):
        await _apply_offline(plan=tampered_plan, report=planned.report)


def test_fixture_itself_remains_a_clean_reconciliation_input() -> None:
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    legacy_export = LegacyExport.model_validate(payload)

    result = build_migration_plan(
        legacy_export,
        TENANT_ID,
        owner_admin_legacy_id=OWNER_ADMIN_LEGACY_ID,
    )

    assert result.report.errors == []
    assert result.report.planned_counts == {
        "clients": 2,
        "clientNotes": 1,
        "formSubmissions": 1,
        "adminUsers": 1,
        "adminMemberships": 1,
        "visits": 1,
        "signatureVerifications": 0,
    }
