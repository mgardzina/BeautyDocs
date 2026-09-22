from __future__ import annotations

from pathlib import Path

MIGRATION = (
    Path(__file__).parents[1]
    / "alembic"
    / "versions"
    / "20260823_0033_self_managed_team_phone.py"
)


def test_team_phone_migration_uses_only_linked_account_phone() -> None:
    source = MIGRATION.read_text(encoding="utf-8")

    assert 'down_revision: str | None = "20260823_0032"' in source
    assert "app_user.phone_normalized" in source
    assert "team_member.membership_id = membership.id" in source
    assert "WHERE membership_id IS NULL" in source
    assert "phone_normalized = NULL" in source
