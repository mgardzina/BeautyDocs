"""Allow tenant-scoped membership reads after a tenant is selected.

Revision ID: 20260719_0003
Revises: 20260719_0002
Create Date: 2026-07-19
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260719_0003"
down_revision: str | None = "20260719_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TENANT_EXPRESSION = "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid"


def upgrade() -> None:
    # The existing self-select policy remains in place for discovering a user's
    # memberships before a tenant is selected. PostgreSQL ORs permissive SELECT
    # policies, so this additional policy only exposes rows for the explicit,
    # transaction-local tenant context.
    op.execute(
        "CREATE POLICY tenant_memberships_tenant_select ON tenant_memberships "
        f"FOR SELECT USING ({TENANT_EXPRESSION})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY tenant_memberships_tenant_select ON tenant_memberships")
