from __future__ import annotations

from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
MIGRATION_PATH = API_ROOT / "alembic" / "versions" / "20260728_0005_team_member_signatures.py"


def _migration_source() -> str:
    return MIGRATION_PATH.read_text(encoding="utf-8")


def test_team_members_are_tenant_isolated_and_owner_profiles_are_backfilled() -> None:
    source = _migration_source()

    assert "ALTER TABLE team_members ENABLE ROW LEVEL SECURITY" in source
    assert "ALTER TABLE team_members FORCE ROW LEVEL SECURITY" in source
    assert "CREATE POLICY team_members_tenant_isolation" in source
    assert "INSERT INTO team_members" in source
    assert "WHERE membership.role = 'OWNER'" in source


def test_submission_practitioner_reference_is_tenant_scoped() -> None:
    source = _migration_source()

    assert '"practitioner_team_member_id"' in source
    assert '"fk_submission_tenant_practitioner"' in source
    assert '["tenant_id", "practitioner_team_member_id"]' in source
    assert '["tenant_id", "id"]' in source
    assert 'ondelete="RESTRICT"' in source


def test_team_profile_membership_reference_is_tenant_scoped() -> None:
    source = _migration_source()

    assert '"fk_team_member_tenant_membership"' in source
    assert '["tenant_id", "membership_id"]' in source
    assert '["tenant_memberships.tenant_id", "tenant_memberships.id"]' in source
