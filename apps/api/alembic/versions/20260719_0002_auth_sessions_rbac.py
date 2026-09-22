"""Add DB-backed auth sessions, self-membership RLS, and legacy parity fields.

Revision ID: 20260719_0002
Revises: 20260719_0001
Create Date: 2026-07-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260719_0002"
down_revision: str | None = "20260719_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TENANT_EXPRESSION = "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid"
USER_EXPRESSION = "user_id = NULLIF(current_setting('app.user_id', true), '')::uuid"
SESSION_EXPRESSION = "token_digest = NULLIF(current_setting('app.session_digest', true), '')"


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "failed_login_attempts",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.add_column(
        "users",
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "failed_login_attempts_nonnegative",
        "users",
        "failed_login_attempts >= 0",
    )

    op.create_table(
        "auth_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "char_length(token_digest) = 64",
            name="token_digest_sha256",
        ),
        sa.CheckConstraint(
            "token_digest ~ '^[0-9a-f]{64}$'",
            name="token_digest_lowercase_hex",
        ),
        sa.CheckConstraint(
            "expires_at > created_at",
            name="expiry_after_creation",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_auth_session_user",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_auth_sessions"),
        sa.UniqueConstraint("token_digest", name="uq_auth_sessions_token_digest"),
    )
    op.create_index(
        "ix_auth_sessions_user_expires",
        "auth_sessions",
        ["user_id", "expires_at"],
    )
    op.create_index(
        "ix_auth_sessions_expires",
        "auth_sessions",
        ["expires_at"],
    )
    op.execute("ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE auth_sessions FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY auth_sessions_token_access ON auth_sessions "
        f"FOR ALL USING ({SESSION_EXPRESSION}) WITH CHECK ({SESSION_EXPRESSION})"
    )

    op.execute("DROP POLICY tenant_memberships_tenant_isolation ON tenant_memberships")
    op.execute(
        "CREATE POLICY tenant_memberships_self_select ON tenant_memberships "
        f"FOR SELECT USING ({USER_EXPRESSION})"
    )
    op.execute(
        "CREATE POLICY tenant_memberships_tenant_insert ON tenant_memberships "
        f"FOR INSERT WITH CHECK ({TENANT_EXPRESSION})"
    )

    op.add_column(
        "client_notes",
        sa.Column(
            "category",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'NOTATKA'"),
        ),
    )
    op.create_check_constraint(
        "category_allowed",
        "client_notes",
        "category IN ('NOTATKA', 'ALERGIA', 'UWAGA', 'PREFERENCJA')",
    )
    op.add_column(
        "visits",
        sa.Column("anaesthesia", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("visits", "anaesthesia")
    op.drop_constraint(
        op.f("ck_client_notes_category_allowed"),
        "client_notes",
        type_="check",
    )
    op.drop_column("client_notes", "category")

    op.execute("DROP POLICY tenant_memberships_tenant_insert ON tenant_memberships")
    op.execute("DROP POLICY tenant_memberships_self_select ON tenant_memberships")
    op.execute(
        "CREATE POLICY tenant_memberships_tenant_isolation ON tenant_memberships "
        f"FOR ALL USING ({TENANT_EXPRESSION}) WITH CHECK ({TENANT_EXPRESSION})"
    )

    op.drop_table("auth_sessions")
    op.drop_constraint(
        op.f("ck_users_failed_login_attempts_nonnegative"),
        "users",
        type_="check",
    )
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")
