from pathlib import Path

from sqlalchemy import CheckConstraint

from app.db.base import Base
from app.models import User, UserMfaChallenge  # noqa: F401

API_ROOT = Path(__file__).resolve().parents[1]
MIGRATION = API_ROOT / "alembic" / "versions" / "20260809_0022_optional_account_mfa.py"
PROFILE_MIGRATION = (
    API_ROOT
    / "alembic"
    / "versions"
    / "20260809_0023_profile_phone_and_mfa_change.py"
)


def test_optional_mfa_schema_keeps_secrets_and_short_lived_challenges_server_side() -> None:
    users = Base.metadata.tables["users"]
    challenges = Base.metadata.tables["user_mfa_challenges"]

    assert {
        "mfa_method",
        "mfa_phone_normalized",
        "mfa_totp_secret_encrypted",
        "mfa_enabled_at",
        "mfa_last_used_counter",
    } <= set(users.c.keys())
    assert "totp_secret" not in users.c
    assert {"otp_digest", "expires_at", "attempt_count", "status"} <= set(
        challenges.c.keys()
    )
    assert any(
        isinstance(constraint, CheckConstraint)
        and "mfa_method = 'TOTP'" in str(constraint.sqltext)
        for constraint in users.constraints
    )


def test_mfa_challenge_migration_forces_scoped_rls() -> None:
    source = MIGRATION.read_text(encoding="utf-8")

    assert 'revision: str = "20260809_0022"' in source
    assert 'down_revision: str | None = "20260809_0021"' in source
    assert "ALTER TABLE user_mfa_challenges FORCE ROW LEVEL SECURITY" in source
    assert "current_setting('app.mfa_challenge_id', true)" in source
    assert "current_setting('app.user_id', true)" in source


def test_profile_and_mfa_change_migration_extends_existing_schema() -> None:
    source = PROFILE_MIGRATION.read_text(encoding="utf-8")

    assert 'revision: str = "20260809_0023"' in source
    assert 'down_revision: str | None = "20260809_0022"' in source
    assert '"users", sa.Column("phone_normalized"' in source
    assert "'CHANGE'" in source
