"""Align salon team phones with self-managed staff account data.

Revision ID: 20260823_0033
Revises: 20260823_0032
Create Date: 2026-08-23
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260823_0033"
down_revision: str | None = "20260823_0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # A linked profile may use only the phone managed by its account owner.
    # This also replaces any legacy value previously entered by a salon admin.
    op.execute(
        """
        UPDATE team_members AS team_member
        SET phone = app_user.phone_normalized,
            phone_normalized = app_user.phone_normalized
        FROM tenant_memberships AS membership
        JOIN users AS app_user ON app_user.id = membership.user_id
        WHERE team_member.tenant_id = membership.tenant_id
          AND team_member.membership_id = membership.id
        """
    )
    # Profiles without an account cannot have a self-managed personal number.
    op.execute(
        """
        UPDATE team_members
        SET phone = NULL,
            phone_normalized = NULL
        WHERE membership_id IS NULL
        """
    )


def downgrade() -> None:
    # Legacy admin-entered phone values cannot be reconstructed safely.
    pass
