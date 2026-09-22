"""Add consumer-owned links to online-booked visits.

Revision ID: 20260808_0018
Revises: 20260808_0017
Create Date: 2026-08-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260808_0018"
down_revision: str | None = "20260808_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "consumer_appointments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "consumer_account_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("booking_token_digest", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "char_length(booking_token_digest) = 64",
            name="ck_consumer_appointments_booking_token_digest_sha256",
        ),
        sa.ForeignKeyConstraint(
            ["consumer_account_id"],
            ["consumer_accounts.id"],
            name="fk_consumer_appointments_consumer_account_id_consumer_accounts",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_consumer_appointments_tenant_id_tenants",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "visit_id"],
            ["visits.tenant_id", "visits.id"],
            name="fk_consumer_appointment_visit",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_consumer_appointments"),
        sa.UniqueConstraint(
            "tenant_id",
            "visit_id",
            name="uq_consumer_appointment_tenant_visit",
        ),
        sa.UniqueConstraint(
            "booking_token_digest",
            name="uq_consumer_appointment_booking_token",
        ),
    )
    op.create_index(
        "ix_consumer_appointments_account_created",
        "consumer_appointments",
        ["consumer_account_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_consumer_appointments_account_created",
        table_name="consumer_appointments",
    )
    op.drop_table("consumer_appointments")
