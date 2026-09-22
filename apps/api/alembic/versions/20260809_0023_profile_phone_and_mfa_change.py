"""Add personal phone and MFA replacement challenges.

Revision ID: 20260809_0023
Revises: 20260809_0022
Create Date: 2026-08-09
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260809_0023"
down_revision: str | None = "20260809_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("phone_normalized", sa.String(length=32), nullable=True)
    )
    op.drop_constraint(
        op.f("ck_user_mfa_challenges_purpose_allowed"),
        "user_mfa_challenges",
        type_="check",
    )
    op.create_check_constraint(
        "purpose_allowed",
        "user_mfa_challenges",
        "purpose IN ('ENROLLMENT', 'LOGIN', 'DISABLE', 'CHANGE')",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("ck_user_mfa_challenges_purpose_allowed"),
        "user_mfa_challenges",
        type_="check",
    )
    op.create_check_constraint(
        "purpose_allowed",
        "user_mfa_challenges",
        "purpose IN ('ENROLLMENT', 'LOGIN', 'DISABLE')",
    )
    op.drop_column("users", "phone_normalized")
