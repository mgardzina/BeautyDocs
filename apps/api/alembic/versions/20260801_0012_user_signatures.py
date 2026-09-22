"""Add self-managed signatures to user accounts.

Revision ID: 20260801_0012
Revises: 20260801_0011
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260801_0012"
down_revision: str | None = "20260801_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("signature_data_url", sa.Text(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("signature_updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "signature_updated_at")
    op.drop_column("users", "signature_data_url")
