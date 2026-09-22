"""Add e-mail verification state to consumer accounts.

Revision ID: 20260801_0011
Revises: 20260801_0010
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260801_0011"
down_revision: str | None = "20260801_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "consumer_accounts",
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "consumer_accounts",
        sa.Column("verification_code_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "consumer_accounts",
        sa.Column(
            "verification_code_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "consumer_accounts",
        sa.Column(
            "verification_attempts",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "consumer_verification_attempts_nonnegative",
        "consumer_accounts",
        "verification_attempts >= 0",
    )
    op.create_check_constraint(
        "consumer_verification_code_hash_sha256",
        "consumer_accounts",
        "verification_code_hash IS NULL OR verification_code_hash ~ '^[0-9a-f]{64}$'",
    )

    # Password accounts created before this migration were activated immediately.
    # Preserve their ability to sign in after verification becomes mandatory.
    op.execute(
        "UPDATE consumer_accounts "
        "SET email_verified_at = created_at "
        "WHERE password_hash IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_constraint(
        "consumer_verification_code_hash_sha256",
        "consumer_accounts",
        type_="check",
    )
    op.drop_constraint(
        "consumer_verification_attempts_nonnegative",
        "consumer_accounts",
        type_="check",
    )
    op.drop_column("consumer_accounts", "verification_attempts")
    op.drop_column("consumer_accounts", "verification_code_expires_at")
    op.drop_column("consumer_accounts", "verification_code_hash")
    op.drop_column("consumer_accounts", "email_verified_at")
