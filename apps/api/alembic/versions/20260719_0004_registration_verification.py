"""Add account verification fields for self-service registration.

Revision ID: 20260719_0004
Revises: 20260719_0003
Create Date: 2026-07-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260719_0004"
down_revision: str | None = "20260719_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("verification_code_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "verification_code_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "verification_attempts",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    # Existing accounts were created before self-service verification existed;
    # treat them as already verified so they can keep signing in.
    op.execute("UPDATE users SET email_verified_at = created_at")
    op.create_check_constraint(
        "verification_attempts_nonnegative",
        "users",
        "verification_attempts >= 0",
    )
    op.create_check_constraint(
        "verification_code_hash_sha256",
        "users",
        "verification_code_hash IS NULL OR verification_code_hash ~ '^[0-9a-f]{64}$'",
    )


def downgrade() -> None:
    op.drop_constraint("verification_code_hash_sha256", "users", type_="check")
    op.drop_constraint("verification_attempts_nonnegative", "users", type_="check")
    op.drop_column("users", "verification_attempts")
    op.drop_column("users", "verification_code_expires_at")
    op.drop_column("users", "verification_code_hash")
    op.drop_column("users", "email_verified_at")
