"""Add a salon-specific duration to form templates.

Revision ID: 20260809_0020
Revises: 20260809_0019
Create Date: 2026-08-09
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260809_0020"
down_revision: str | None = "20260809_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tenant_form_templates",
        sa.Column(
            "duration_minutes",
            sa.Integer(),
            nullable=False,
            server_default="60",
        ),
    )
    op.create_check_constraint(
        "duration_minutes_valid",
        "tenant_form_templates",
        "duration_minutes >= 15 AND duration_minutes <= 480",
    )


def downgrade() -> None:
    op.drop_constraint(
        "duration_minutes_valid",
        "tenant_form_templates",
        type_="check",
    )
    op.drop_column("tenant_form_templates", "duration_minutes")
