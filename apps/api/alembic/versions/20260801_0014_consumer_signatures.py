"""Add self-managed reusable signatures to consumer accounts.

Revision ID: 20260801_0014
Revises: 20260801_0013
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260801_0014"
down_revision: str | None = "20260801_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "consumer_accounts",
        sa.Column("signature_data_url", sa.Text(), nullable=True),
    )
    op.add_column(
        "consumer_accounts",
        sa.Column("signature_updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("consumer_accounts", "signature_updated_at")
    op.drop_column("consumer_accounts", "signature_data_url")
