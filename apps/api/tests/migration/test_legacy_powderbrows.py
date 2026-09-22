from __future__ import annotations

import json
import stat
from pathlib import Path
from typing import Any, cast
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.migration_tools.legacy_exporter import (
    EXPECTED_TABLE_COLUMNS,
    create_legacy_export,
    create_legacy_inventory,
)
from app.migration_tools.legacy_powderbrows import (
    LegacyExport,
    PlannerResult,
    build_migration_plan,
    load_legacy_export,
    write_private_json,
)

FIXTURE_PATH = (
    Path(__file__).resolve().parents[1] / "fixtures" / "legacy_powderbrows_v1.synthetic.json"
)
TENANT_ID = UUID("aaaaaaaa-0000-0000-0000-000000000001")
OWNER_ADMIN_LEGACY_ID = "40000000-0000-0000-0000-000000000001"


def _fixture_payload() -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))


def _validated_fixture() -> LegacyExport:
    return load_legacy_export(FIXTURE_PATH)


def _build_plan(
    legacy_export: LegacyExport,
    tenant_id: UUID = TENANT_ID,
) -> PlannerResult:
    return build_migration_plan(
        legacy_export,
        tenant_id,
        owner_admin_legacy_id=OWNER_ADMIN_LEGACY_ID,
    )


def test_planner_is_deterministic_and_reconciles_synthetic_fixture() -> None:
    legacy_export = _validated_fixture()

    first = _build_plan(legacy_export)
    second = _build_plan(legacy_export)

    assert first.report.errors == []
    assert first.report.plan_fingerprint == second.report.plan_fingerprint
    assert first.report.mappings == second.report.mappings
    assert first.report.source_counts == {
        "clients": 2,
        "clientNotes": 1,
        "consentForms": 1,
        "adminUsers": 1,
        "treatmentHistories": 1,
        "otpVerifications": 2,
    }
    assert first.report.planned_counts == {
        "clients": 2,
        "clientNotes": 1,
        "formSubmissions": 1,
        "adminUsers": 1,
        "adminMemberships": 1,
        "visits": 1,
        "signatureVerifications": 0,
    }
    assert first.plan.client_notes[0]["category"] == "UWAGA"
    assert first.plan.clients[0]["phoneNormalized"] == "48111222333"
    assert first.plan.memberships[0]["role"] == "OWNER"
    assert first.plan.form_submissions[0]["visitId"] == first.plan.visits[0]["id"]
    assert "formSubmissionId" not in first.plan.visits[0]

    legacy_answers = first.plan.form_submissions[0]["answers"]["legacyPowderBrows"]
    assert "podpisDane" not in legacy_answers
    assert "podpisRodo" not in legacy_answers
    assert "auditLog" not in legacy_answers
    unsupported_codes = {item.code for item in first.report.unsupported}
    assert "legacy_sensitive_signature_artifacts" in unsupported_codes
    assert "legacy_signature_verification_unverifiable" in unsupported_codes
    assert "legacy_entity_intentionally_omitted" in unsupported_codes

    serialized_report = json.dumps(
        first.report.model_dump(mode="json", by_alias=True), ensure_ascii=False
    )
    for direct_pii in (
        "Anna Testowa",
        "Beata Przykład",
        "anna.synthetic@example.test",
        "48111222333",
        "ul. Testowa 1",
    ):
        assert direct_pii not in serialized_report


def test_possible_duplicate_clients_are_reported_but_never_merged() -> None:
    payload = _fixture_payload()
    payload["records"]["clients"][1]["imieNazwisko"] = "  ANNA   testowa  "
    legacy_export = LegacyExport.model_validate(payload)

    result = _build_plan(legacy_export)

    assert result.report.planned_counts["clients"] == 2
    assert any(warning.code == "possible_duplicate_client" for warning in result.report.warnings)
    assert len(result.report.mappings["clients"]) == 2


def test_unknown_form_type_is_an_error_and_unsupported_record() -> None:
    payload = _fixture_payload()
    payload["records"]["consentForms"][0]["type"] = "FUTURE_UNKNOWN_FORM"
    legacy_export = LegacyExport.model_validate(payload)

    result = _build_plan(legacy_export)

    assert result.report.planned_counts["formSubmissions"] == 0
    assert any(error.code == "unknown_form_type" for error in result.report.errors)
    assert any(
        item.code == "unknown_form_type" and not item.record_planned
        for item in result.report.unsupported
    )


def test_missing_references_are_reported_without_fallback() -> None:
    payload = _fixture_payload()
    payload["records"]["clientNotes"][0]["clientId"] = "missing-client"
    payload["records"]["consentForms"][0]["clientId"] = "missing-client"
    payload["records"]["treatmentHistories"][0]["formId"] = "missing-form"
    legacy_export = LegacyExport.model_validate(payload)

    result = _build_plan(legacy_export)

    error_codes = [error.code for error in result.report.errors]
    assert error_codes.count("missing_client_reference") == 2
    assert "missing_form_reference" in error_codes
    assert result.report.planned_counts["clientNotes"] == 0
    assert result.report.planned_counts["formSubmissions"] == 0
    assert result.report.planned_counts["visits"] == 0


def test_unknown_note_category_is_not_silently_mapped() -> None:
    payload = _fixture_payload()
    payload["records"]["clientNotes"][0]["category"] = "UNKNOWN_CATEGORY"
    legacy_export = LegacyExport.model_validate(payload)

    result = _build_plan(legacy_export)

    assert result.report.planned_counts["clientNotes"] == 0
    assert any(error.code == "unknown_note_category" for error in result.report.errors)


def test_owner_is_never_selected_by_admin_sort_order() -> None:
    result = build_migration_plan(_validated_fixture(), TENANT_ID)

    assert any(error.code == "owner_admin_unresolved" for error in result.report.errors)
    assert {membership["role"] for membership in result.plan.memberships} == {"UNRESOLVED"}


def test_global_user_uuid_depends_on_email_not_tenant_or_legacy_id() -> None:
    first_payload = _fixture_payload()
    second_payload = _fixture_payload()
    second_payload["records"]["adminUsers"][0]["id"] = "40000000-0000-0000-0000-000000000099"
    first_export = LegacyExport.model_validate(first_payload)
    second_export = LegacyExport.model_validate(second_payload)

    first = _build_plan(first_export)
    second = build_migration_plan(
        second_export,
        UUID("bbbbbbbb-0000-0000-0000-000000000002"),
        owner_admin_legacy_id="40000000-0000-0000-0000-000000000099",
    )

    assert first.plan.users[0]["id"] == second.plan.users[0]["id"]


def test_export_validator_rejects_reconciliation_count_mismatch() -> None:
    payload = _fixture_payload()
    payload["recordCounts"]["clients"] = 999

    with pytest.raises(ValidationError, match="does not match exported records"):
        LegacyExport.model_validate(payload)


def test_private_json_writer_uses_0600_and_never_overwrites(tmp_path: Path) -> None:
    target = tmp_path / "migration-report.json"

    write_private_json(target, {"safe": "synthetic"})

    assert stat.S_IMODE(target.stat().st_mode) == 0o600
    with pytest.raises(FileExistsError):
        write_private_json(target, {"safe": "replacement"})
    assert json.loads(target.read_text(encoding="utf-8")) == {"safe": "synthetic"}


class _FakeTransaction:
    def __init__(self, connection: _FakeConnection) -> None:
        self.connection = connection

    async def __aenter__(self) -> None:
        self.connection.transaction_entered = True

    async def __aexit__(
        self,
        exception_type: type[BaseException] | None,
        exception: BaseException | None,
        traceback: object | None,
    ) -> None:
        return None


class _FakeConnection:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload
        self.transaction_entered = False
        self.closed = False
        self.queries: list[str] = []

    def transaction(self, *, isolation: str, readonly: bool) -> _FakeTransaction:
        assert isolation == "repeatable_read"
        assert readonly is True
        return _FakeTransaction(self)

    async def fetchval(self, query: str) -> str | int:
        self.queries.append(query)
        if "transaction_read_only" in query:
            return "on"
        for table_name, record_key in {
            "Client": "clients",
            "ClientNote": "clientNotes",
            "ConsentForm": "consentForms",
            "AdminUser": "adminUsers",
            "TreatmentHistory": "treatmentHistories",
        }.items():
            if f'"{table_name}"' in query:
                return len(self.payload["records"][record_key])
        if '"OtpVerification"' in query:
            return 2
        raise AssertionError("unexpected scalar query")

    async def fetch(self, query: str, *parameters: object) -> list[dict[str, str]]:
        self.queries.append(query)
        if "information_schema.columns" in query:
            assert parameters == (sorted(EXPECTED_TABLE_COLUMNS),)
            return [
                {"table_name": table_name, "column_name": column_name}
                for table_name, columns in sorted(EXPECTED_TABLE_COLUMNS.items())
                for column_name in sorted(columns)
            ]
        table_to_key = {
            '"Client"': "clients",
            '"ClientNote"': "clientNotes",
            '"ConsentForm"': "consentForms",
            '"AdminUser"': "adminUsers",
            '"TreatmentHistory"': "treatmentHistories",
        }
        for table_name, record_key in table_to_key.items():
            if table_name in query:
                return [
                    {"payload": json.dumps(record)}
                    for record in self.payload["records"][record_key]
                ]
        raise AssertionError("unexpected table query")

    async def close(self) -> None:
        self.closed = True


@pytest.mark.asyncio
async def test_exporter_uses_read_only_transaction_and_redacts_sensitive_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = _fixture_payload()
    payload["records"]["consentForms"][0]["podpisDane"] = "synthetic-base64"
    payload["records"]["consentForms"][0]["auditLog"] = {"synthetic": True}
    payload["records"]["adminUsers"][0]["passwordHash"] = "synthetic-hash"
    connection = _FakeConnection(payload)

    async def fake_connect(source_dsn: str) -> _FakeConnection:
        assert source_dsn == "postgresql://synthetic-source"
        return connection

    monkeypatch.setattr("app.migration_tools.legacy_exporter.asyncpg.connect", fake_connect)

    legacy_export = await create_legacy_export(
        "postgresql://synthetic-source", include_sensitive=False
    )

    assert connection.transaction_entered
    assert connection.closed
    assert all(query.lstrip().startswith("SELECT") for query in connection.queries)
    assert legacy_export.mode == "restricted-records"
    form = legacy_export.records.consent_forms[0]
    assert form.data_signature is None
    assert form.audit_log is None
    assert legacy_export.records.admin_users[0].password_hash is None
    assert "podpisDane" in legacy_export.redactions[f"ConsentForm:{form.id}"]


@pytest.mark.asyncio
async def test_default_inventory_reads_counts_but_no_records(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = _fixture_payload()
    connection = _FakeConnection(payload)

    async def fake_connect(source_dsn: str) -> _FakeConnection:
        assert source_dsn == "postgresql://synthetic-source"
        return connection

    monkeypatch.setattr("app.migration_tools.legacy_exporter.asyncpg.connect", fake_connect)

    inventory = await create_legacy_inventory("postgresql://synthetic-source")

    assert inventory.mode == "inventory"
    assert inventory.record_counts == payload["recordCounts"]
    assert not any("row_to_json" in query for query in connection.queries)
    assert connection.closed


def test_inventory_is_explicitly_rejected_by_planner(tmp_path: Path) -> None:
    payload = _fixture_payload()
    inventory_path = tmp_path / "inventory.json"
    inventory_payload = {
        "schemaVersion": "powderbrows-legacy-inventory/v1",
        "exportedAt": payload["exportedAt"],
        "mode": "inventory",
        "source": payload["source"],
        "recordCounts": payload["recordCounts"],
        "omitted": payload["omitted"],
    }
    inventory_path.write_text(json.dumps(inventory_payload), encoding="utf-8")

    with pytest.raises(ValueError, match="counts only and cannot be planned"):
        load_legacy_export(inventory_path)


@pytest.mark.asyncio
async def test_exporter_rejects_schema_drift_before_reading_records(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = _fixture_payload()

    class DriftedConnection(_FakeConnection):
        async def fetch(self, query: str, *parameters: object) -> list[dict[str, str]]:
            rows = await super().fetch(query, *parameters)
            if "information_schema.columns" in query:
                return [
                    row
                    for row in rows
                    if not (row["table_name"] == "Client" and row["column_name"] == "telefon")
                ]
            return rows

    connection = DriftedConnection(payload)

    async def fake_connect(source_dsn: str) -> DriftedConnection:
        return connection

    monkeypatch.setattr("app.migration_tools.legacy_exporter.asyncpg.connect", fake_connect)

    with pytest.raises(RuntimeError, match="schema does not match export v1"):
        await create_legacy_export("postgresql://synthetic-source", include_sensitive=False)

    assert not any("row_to_json" in query for query in connection.queries)
    assert connection.closed
