"""Add an optional salon logo (stored as a bounded data URL) to tenants.

Revision ID: 20260823_0032
Revises: 20260818_0031
Create Date: 2026-08-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260823_0032"
down_revision: str | None = "20260818_0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("logo_image", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "logo_image")
