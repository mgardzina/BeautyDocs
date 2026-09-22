"""Add consumer_registrations for the e-mail-first client sign-up flow.

Revision ID: 20260825_0035
Revises: 20260825_0034
Create Date: 2026-08-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260825_0035"
down_revision: str | None = "20260825_0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "consumer_registrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("email_normalized", sa.String(length=320), nullable=False),
        sa.Column("verification_code_hash", sa.String(length=64), nullable=True),
        sa.Column(
            "verification_code_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "verification_attempts",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("registration_token_hash", sa.String(length=64), nullable=True),
        sa.Column(
            "registration_token_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id", name="pk_consumer_registrations"),
        sa.UniqueConstraint(
            "email_normalized", name="uq_consumer_registration_email"
        ),
        sa.CheckConstraint(
            "email_normalized = lower(email_normalized)",
            name="consumer_registration_email_lowercase",
        ),
        sa.CheckConstraint(
            "verification_attempts >= 0",
            name="consumer_registration_attempts_nonnegative",
        ),
        sa.CheckConstraint(
            "verification_code_hash IS NULL OR verification_code_hash ~ '^[0-9a-f]{64}$'",
            name="consumer_registration_code_hash_sha256",
        ),
        sa.CheckConstraint(
            "registration_token_hash IS NULL OR registration_token_hash ~ '^[0-9a-f]{64}$'",
            name="consumer_registration_token_hash_sha256",
        ),
    )
    op.create_index(
        "ix_consumer_registrations_token",
        "consumer_registrations",
        ["registration_token_hash"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_consumer_registrations_token", table_name="consumer_registrations"
    )
    op.drop_table("consumer_registrations")
