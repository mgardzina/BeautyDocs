"""Add explicit salon directory visibility.

Revision ID: 20260808_0016
Revises: 20260808_0015
Create Date: 2026-08-08
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260808_0016"
down_revision: str | None = "20260808_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column(
            "directory_visible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index(
        "ix_tenants_directory_visibility",
        "tenants",
        ["directory_visible", "status", "city"],
    )


def downgrade() -> None:
    op.drop_index("ix_tenants_directory_visibility", table_name="tenants")
    op.drop_column("tenants", "directory_visible")
