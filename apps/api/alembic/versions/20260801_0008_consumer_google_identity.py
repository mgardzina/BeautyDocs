"""Add Google identity support for consumer accounts.

Revision ID: 20260801_0008
Revises: 20260801_0007
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260801_0008"
down_revision: str | None = "20260801_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("consumer_accounts", "phone", nullable=True)
    op.alter_column("consumer_accounts", "phone_normalized", nullable=True)
    op.alter_column("consumer_accounts", "phone_verified_at", nullable=True)
    op.add_column(
        "consumer_accounts",
        sa.Column("email_normalized", sa.String(length=320), nullable=True),
    )
    op.execute(
        "UPDATE consumer_accounts SET email_normalized = lower(trim(email)) WHERE email IS NOT NULL"
    )
    op.create_index(
        "ix_consumer_accounts_email_normalized",
        "consumer_accounts",
        ["email_normalized"],
    )

    op.create_table(
        "consumer_google_identities",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("consumer_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("google_subject", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("email_normalized", sa.String(length=320), nullable=False),
        sa.Column("hosted_domain", sa.String(length=255), nullable=True),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["consumer_account_id"],
            ["consumer_accounts.id"],
            name="fk_consumer_google_identity_account",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_consumer_google_identities"),
        sa.UniqueConstraint(
            "google_subject",
            name="uq_consumer_google_identity_subject",
        ),
        sa.UniqueConstraint(
            "consumer_account_id",
            name="uq_consumer_google_identity_account",
        ),
    )
    op.create_index(
        "ix_consumer_google_identity_email",
        "consumer_google_identities",
        ["email_normalized"],
    )


def downgrade() -> None:
    op.drop_table("consumer_google_identities")
    op.drop_index(
        "ix_consumer_accounts_email_normalized",
        table_name="consumer_accounts",
    )
    op.drop_column("consumer_accounts", "email_normalized")
    op.execute("DELETE FROM consumer_accounts WHERE phone_normalized IS NULL")
    op.alter_column("consumer_accounts", "phone_verified_at", nullable=False)
    op.alter_column("consumer_accounts", "phone_normalized", nullable=False)
    op.alter_column("consumer_accounts", "phone", nullable=False)
