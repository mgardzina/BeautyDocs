from pathlib import Path

from sqlalchemy import CheckConstraint, UniqueConstraint

from app.db.base import Base
from app.models import AuthSession, ClientNote, User, Visit  # noqa: F401

API_ROOT = Path(__file__).resolve().parents[1]
MIGRATION = API_ROOT / "alembic" / "versions" / "20260719_0002_auth_sessions_rbac.py"
SESSION_MANAGEMENT_MIGRATION = (
    API_ROOT / "alembic" / "versions" / "20260818_0031_user_session_management.py"
)


def test_auth_session_stores_only_unique_digest_and_expiry_state() -> None:
    table = Base.metadata.tables["auth_sessions"]

    assert "token" not in table.c
    assert set(table.c) >= {
        table.c.id,
        table.c.user_id,
        table.c.token_digest,
        table.c.expires_at,
        table.c.revoked_at,
    }
    assert any(
        isinstance(constraint, UniqueConstraint)
        and tuple(column.name for column in constraint.columns) == ("token_digest",)
        for constraint in table.constraints
    )
    assert any(
        isinstance(constraint, CheckConstraint)
        and "char_length(token_digest) = 64" in str(constraint.sqltext)
        for constraint in table.constraints
    )
    constraint_sql = {
        str(constraint.sqltext)
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint)
    }
    assert "token_digest ~ '^[0-9a-f]{64}$'" in constraint_sql
    assert "expires_at > created_at" in constraint_sql


def test_lockout_and_legacy_parity_fields_are_registered() -> None:
    assert {"failed_login_attempts", "locked_until"} <= set(Base.metadata.tables["users"].c.keys())
    assert "category" in Base.metadata.tables["client_notes"].c
    assert "anaesthesia" in Base.metadata.tables["visits"].c


def test_auth_migration_forces_session_rls_and_self_membership_policy() -> None:
    source = MIGRATION.read_text(encoding="utf-8")

    assert 'revision: str = "20260719_0002"' in source
    assert 'down_revision: str | None = "20260719_0001"' in source
    assert "ALTER TABLE auth_sessions FORCE ROW LEVEL SECURITY" in source
    assert "current_setting('app.session_digest', true)" in source
    assert "current_setting('app.user_id', true)" in source
    assert "tenant_memberships_self_select" in source
    assert "client_notes" in source and "category_allowed" in source
    assert "visits" in source and "anaesthesia" in source


def test_password_change_migration_scopes_session_management_to_current_user() -> None:
    source = SESSION_MANAGEMENT_MIGRATION.read_text(encoding="utf-8")

    assert 'revision: str = "20260818_0031"' in source
    assert 'down_revision: str | None = "20260816_0030"' in source
    assert "auth_sessions_user_select" in source
    assert "auth_sessions_user_update" in source
    assert "current_setting('app.user_id', true)" in source
    assert "FOR UPDATE" in source
