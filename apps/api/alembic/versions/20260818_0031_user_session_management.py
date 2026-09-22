"""Allow authenticated users to revoke their own login sessions.

Revision ID: 20260818_0031
Revises: 20260816_0030
Create Date: 2026-08-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260818_0031"
down_revision: str | None = "20260816_0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

USER_EXPRESSION = "user_id = NULLIF(current_setting('app.user_id', true), '')::uuid"


def upgrade() -> None:
    # Token-scoped access still authenticates the incoming request. Once the
    # API has set app.user_id for that request, these policies let a user see
    # and revoke only sessions belonging to the same account.
    op.execute(
        "CREATE POLICY auth_sessions_user_select ON auth_sessions "
        f"FOR SELECT USING ({USER_EXPRESSION})"
    )
    op.execute(
        "CREATE POLICY auth_sessions_user_update ON auth_sessions "
        f"FOR UPDATE USING ({USER_EXPRESSION}) WITH CHECK ({USER_EXPRESSION})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY auth_sessions_user_update ON auth_sessions")
    op.execute("DROP POLICY auth_sessions_user_select ON auth_sessions")
