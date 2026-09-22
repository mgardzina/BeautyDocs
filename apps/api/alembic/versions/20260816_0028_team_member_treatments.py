"""Add treatment assignments to salon team profiles.

Revision ID: 20260816_0028
Revises: 20260816_0027
Create Date: 2026-08-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260816_0028"
down_revision: str | None = "20260816_0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "team_members",
        sa.Column(
            "all_treatments",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "team_members",
        sa.Column(
            "treatment_codes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.create_check_constraint(
        "team_member_treatment_codes_array",
        "team_members",
        "jsonb_typeof(treatment_codes) = 'array'",
    )


def downgrade() -> None:
    op.drop_constraint(
        "team_member_treatment_codes_array",
        "team_members",
        type_="check",
    )
    op.drop_column("team_members", "treatment_codes")
    op.drop_column("team_members", "all_treatments")
