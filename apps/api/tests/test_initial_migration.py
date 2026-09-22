from __future__ import annotations

import ast
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
MIGRATION_PATH = API_ROOT / "alembic" / "versions" / "20260719_0001_initial_beautydocs.py"
TENANT_CONTEXT_PATH = API_ROOT / "app" / "db" / "tenant_context.py"

EXPECTED_TENANT_OWNED_TABLES = {
    "tenant_memberships",
    "clients",
    "client_notes",
    "tenant_form_templates",
    "visits",
    "form_submissions",
    "signature_verifications",
    "file_objects",
    "audit_events",
}


def _migration_source() -> str:
    return MIGRATION_PATH.read_text(encoding="utf-8")


def _assigned_literal(source: str, variable_name: str) -> object:
    module = ast.parse(source)
    for node in module.body:
        if isinstance(node, ast.Assign):
            names = [target.id for target in node.targets if isinstance(target, ast.Name)]
            if variable_name in names:
                return ast.literal_eval(node.value)
    raise AssertionError(f"{variable_name} is not defined")


def test_initial_migration_lists_every_tenant_owned_table_for_rls() -> None:
    configured_tables = set(_assigned_literal(_migration_source(), "TENANT_OWNED_TABLES"))

    assert configured_tables == EXPECTED_TENANT_OWNED_TABLES


def test_initial_migration_enables_and_forces_rls() -> None:
    source = _migration_source()

    assert "ENABLE ROW LEVEL SECURITY" in source
    assert "FORCE ROW LEVEL SECURITY" in source
    assert "CREATE POLICY" in source
    assert "WITH CHECK" in source
    assert "current_setting('app.tenant_id', true)" in source


def test_tenant_context_is_transaction_local() -> None:
    source = TENANT_CONTEXT_PATH.read_text(encoding="utf-8")

    assert "set_config(:setting_name, :tenant_id, true)" in source
    assert 'TENANT_SETTING = "app.tenant_id"' in source


def test_migration_protects_published_versions_and_audit_log() -> None:
    source = _migration_source()

    assert "protect_published_template_version" in source
    assert "OLD.published_at IS NOT NULL" in source
    assert "reject_audit_event_mutation" in source
    assert "BEFORE UPDATE OR DELETE ON audit_events" in source


def test_migration_does_not_make_client_name_or_phone_unique() -> None:
    source = _migration_source()

    assert "uq_clients_name" not in source
    assert "uq_clients_phone" not in source
    assert "uq_client_tenant_id" in source
