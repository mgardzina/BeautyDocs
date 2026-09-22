"""Add optional SMS and authenticator-app MFA for client (consumer) accounts.

Revision ID: 20260913_0037
Revises: 20260912_0036
Create Date: 2026-09-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260913_0037"
down_revision: str | None = "20260912_0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "consumer_accounts", sa.Column("mfa_method", sa.String(length=16), nullable=True)
    )
    op.add_column(
        "consumer_accounts",
        sa.Column("mfa_phone_normalized", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "consumer_accounts",
        sa.Column("mfa_totp_secret_encrypted", sa.Text(), nullable=True),
    )
    op.add_column(
        "consumer_accounts",
        sa.Column("mfa_enabled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "consumer_accounts",
        sa.Column("mfa_last_used_counter", sa.BigInteger(), nullable=True),
    )
    op.create_check_constraint(
        "consumer_mfa_method_allowed",
        "consumer_accounts",
        "mfa_method IS NULL OR mfa_method IN ('SMS', 'TOTP')",
    )
    op.create_check_constraint(
        "consumer_mfa_configuration_valid",
        "consumer_accounts",
        "(mfa_method IS NULL AND mfa_phone_normalized IS NULL "
        "AND mfa_totp_secret_encrypted IS NULL AND mfa_enabled_at IS NULL "
        "AND mfa_last_used_counter IS NULL) OR "
        "(mfa_method = 'SMS' AND mfa_phone_normalized IS NOT NULL "
        "AND mfa_totp_secret_encrypted IS NULL AND mfa_enabled_at IS NOT NULL "
        "AND mfa_last_used_counter IS NULL) OR "
        "(mfa_method = 'TOTP' AND mfa_phone_normalized IS NULL "
        "AND mfa_totp_secret_encrypted IS NOT NULL AND mfa_enabled_at IS NOT NULL)",
    )

    op.create_table(
        "consumer_mfa_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("consumer_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("purpose", sa.String(length=16), nullable=False),
        sa.Column("method", sa.String(length=16), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("otp_digest", sa.String(length=255), nullable=True),
        sa.Column("phone_normalized", sa.String(length=32), nullable=True),
        sa.Column("totp_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("destination_masked", sa.String(length=64), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("provider", sa.String(length=32), nullable=True),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("requested_ip_address", sa.String(length=64), nullable=True),
        sa.Column("requested_user_agent", sa.String(length=512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "purpose IN ('ENROLLMENT', 'LOGIN', 'DISABLE', 'CHANGE')",
            name="purpose_allowed",
        ),
        sa.CheckConstraint("method IN ('SMS', 'TOTP')", name="method_allowed"),
        sa.CheckConstraint(
            "status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED')",
            name="status_allowed",
        ),
        sa.CheckConstraint("attempt_count >= 0", name="attempt_count_nonnegative"),
        sa.CheckConstraint("expires_at > created_at", name="expiry_after_creation"),
        sa.ForeignKeyConstraint(
            ["consumer_account_id"],
            ["consumer_accounts.id"],
            name="fk_consumer_mfa_challenge_account",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_consumer_mfa_challenges"),
    )
    op.create_index(
        "ix_consumer_mfa_challenges_account_created",
        "consumer_mfa_challenges",
        ["consumer_account_id", "created_at"],
    )
    op.create_index(
        "ix_consumer_mfa_challenges_expires",
        "consumer_mfa_challenges",
        ["expires_at"],
    )
    # No RLS here: consumer tables are not tenant-owned and are scoped by
    # consumer_account_id at the query level, same as every other consumer
    # table (see ConsumerMfaChallenge docstring).


def downgrade() -> None:
    op.drop_index(
        "ix_consumer_mfa_challenges_expires", table_name="consumer_mfa_challenges"
    )
    op.drop_index(
        "ix_consumer_mfa_challenges_account_created", table_name="consumer_mfa_challenges"
    )
    op.drop_table("consumer_mfa_challenges")
    op.drop_constraint(
        op.f("ck_consumer_accounts_consumer_mfa_configuration_valid"),
        "consumer_accounts",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_consumer_accounts_consumer_mfa_method_allowed"),
        "consumer_accounts",
        type_="check",
    )
    op.drop_column("consumer_accounts", "mfa_last_used_counter")
    op.drop_column("consumer_accounts", "mfa_enabled_at")
    op.drop_column("consumer_accounts", "mfa_totp_secret_encrypted")
    op.drop_column("consumer_accounts", "mfa_phone_normalized")
    op.drop_column("consumer_accounts", "mfa_method")
